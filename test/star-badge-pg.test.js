// Badge Étoile, lot 2 : étapes, décision finale, validité cumulée, retrait, rappels d'expiration, effacement des pièces.
// PostgreSQL réel ; ignoré sans DATABASE_URL_TEST (base dont le nom contient « test »).
import test from "node:test";
import assert from "node:assert/strict";

const url = process.env.DATABASE_URL_TEST;
const skip = url ? false : "DATABASE_URL_TEST absent : test PostgreSQL ignoré.";
const png = `data:image/png;base64,${Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(400, 1)]).toString("base64")}`;

test("badge Étoile : étapes tracées, décision, renouvellement cumulé, retrait, rappels, effacement des pièces", { skip }, async () => {
  assert.match(new URL(url).pathname.replace(/^\//, ""), /test/i, "DATABASE_URL_TEST doit viser une base « test »");
  const { createDb } = await import("../server/db.js");
  const { migrate } = await import("../server/migrate.js");
  const { createStarBadge } = await import("../server/services/star-badge.js");
  const db = createDb(url);
  try {
    await migrate(db, () => {});
    await db.query("delete from ika_star_requests where user_id like 'sbtest-%'");
    await db.query("delete from ika_profiles where user_id like 'sbtest-%'");
    await db.query("delete from ika_users where id like 'sbtest-%'");
    for (const id of ["sbtest-u1", "sbtest-s1", "sbtest-s2"]) {
      await db.query("insert into ika_users (id, email, password_hash) values ($1, $2, 'x')", [id, `${id}@test.ml`]);
      await db.query("insert into ika_profiles (user_id, full_name) values ($1, $2)", [id, id]);
    }
    const policy = { enabled: true, durationMonths: 12, retentionDays: 0, requiredSteps: [1, 2, 3] };
    const notes = []; const audit = [];
    const svc = createStarBadge({ db, accounts: { requireActive: async () => ({}), requireVerifiedPhone: async () => ({}), requireStaff: async () => ({}) },
      superadminSettings: { get: async () => policy, set: async () => {} }, requestsHub: { notifyStaff: async () => {} },
      moderationAudit: { log: async (who, e) => audit.push({ who, ...e }) }, notify: async (userId, n) => notes.push({ userId, ...n }) });

    const file = async (kind) => svc.addDocument("sbtest-u1", { accountType: "INDIVIDUAL", kind, fileData: png });
    const submit = async () => { for (const k of ["ID_CARD", "PHOTO", "RESIDENCE"]) await file(k); await svc.submit("sbtest-u1", { phone: "70000000", acceptTerms: true }); return (await db.query("select id from ika_star_requests where user_id = 'sbtest-u1' and status = 'PENDING'"))[0].id; };

    // 1) étapes : on ne peut pas approuver tant qu'il en manque, une étape ne se valide qu'une fois, retrait avec motif
    const r1 = await submit();
    await assert.rejects(() => svc.decide("sbtest-s1", r1, { action: "APPROVE" }), /manquantes/);
    await svc.completeStep("sbtest-s1", r1, 1, { note: "ok" });
    await assert.rejects(() => svc.completeStep("sbtest-s2", r1, 1), /déjà validée/);
    await assert.rejects(() => svc.undoStep("sbtest-s2", r1, 1, { note: "" }), /pourquoi/);
    await svc.undoStep("sbtest-s2", r1, 1, { note: "pièce floue" });
    await svc.completeStep("sbtest-s1", r1, 1);
    await svc.completeStep("sbtest-s2", r1, 2);
    const last = await svc.completeStep("sbtest-s1", r1, 3);
    assert.equal(last.complete, true);
    const listed = (await svc.listForStaff()).requests.find((r) => r.id === r1);
    assert.deepEqual(listed.steps.map((s) => s.doneBy), ["sbtest-s1", "sbtest-s2", "sbtest-s1"], "chaque étape est attribuée à la personne qui l'a validée");

    // 2) approbation : validité 12 mois, annonceur notifié, badge actif
    const ok = await svc.decide("sbtest-s1", r1, { action: "APPROVE", note: "dossier complet" });
    assert.equal(ok.status, "APPROVED");
    const months = (new Date(ok.validUntil) - Date.now()) / 86_400_000;
    assert.ok(months > 360 && months < 370, `validité ~12 mois (${months})`);
    assert.match(notes.at(-1).title, /badge Étoile accordé/);
    assert.ok((await svc.mine("sbtest-u1")).badge, "badge actif");
    await assert.rejects(() => svc.decide("sbtest-s1", r1, { action: "REJECT", note: "trop tard" }), /déjà été traité/);

    // 3) renouvellement : la validité restante s'ajoute (pas de temps perdu)
    const r2 = await submit();
    for (const n of [1, 2, 3]) await svc.completeStep("sbtest-s1", r2, n);
    const renewed = await svc.decide("sbtest-s1", r2, { action: "APPROVE" });
    const total = (new Date(renewed.validUntil) - Date.now()) / 86_400_000;
    assert.ok(total > 725 && total < 735, `validité cumulée ~24 mois (${total})`);

    // 4) paiement exigé : approbation refusée tant que le dossier n'est pas marqué payé
    policy.paymentRequired = true;
    const r3 = await submit();
    for (const n of [1, 2, 3]) await svc.completeStep("sbtest-s1", r3, n);
    await assert.rejects(() => svc.decide("sbtest-s1", r3, { action: "APPROVE" }), /paiement/i);
    policy.paymentRequired = false;
    // refus : motif obligatoire, transmis à l'annonceur
    await assert.rejects(() => svc.decide("sbtest-s1", r3, { action: "REJECT", note: "" }), /motif/i);
    await svc.decide("sbtest-s1", r3, { action: "REJECT", note: "photo illisible" });
    assert.match(notes.at(-1).body, /photo illisible/);

    // 5) retrait : tous les badges valides du compte passent à REVOKED, motif obligatoire, badge plus actif
    await assert.rejects(() => svc.revoke("sbtest-s1", r2, { note: "" }), /motif/i);
    await svc.revoke("sbtest-s1", r2, { note: "pièce falsifiée" });
    const after = await svc.mine("sbtest-u1");
    assert.equal(after.badge, null);
    assert.equal((await db.query("select count(*)::int n from ika_star_requests where user_id = 'sbtest-u1' and status = 'APPROVED'"))[0].n, 0);
    assert.equal(audit.at(-1).action, "STAR_BADGE_REVOKE");

    // 6) rappels d'expiration (une seule fois) et effacement des pièces selon la durée de conservation
    const r4 = await submit();
    for (const n of [1, 2, 3]) await svc.completeStep("sbtest-s1", r4, n);
    await svc.decide("sbtest-s1", r4, { action: "APPROVE" });
    await db.query("update ika_star_requests set valid_until = now() + interval '10 days' where id = $1", [r4]);
    const s1 = await svc.sweep("sbtest-s1");
    assert.equal(s1.reminded, 1);
    assert.match(notes.at(-1).title, /expire bientôt/);
    assert.equal((await svc.sweep("sbtest-s1")).reminded, 0, "rappel envoyé une seule fois");
    assert.equal(s1.purged, 0, "conservation à 0 : aucune pièce effacée");
    const withDocs = (await db.query("select count(*)::int n from ika_star_documents where request_id = $1", [r4]))[0].n;
    assert.equal(withDocs, 3);
    policy.retentionDays = 30;
    await db.query("update ika_star_requests set decided_at = now() - interval '31 days' where id = $1", [r4]);
    const s2 = await svc.sweep("sbtest-s1");
    assert.ok(s2.purged >= 1);
    assert.equal((await db.query("select count(*)::int n from ika_star_documents where request_id = $1", [r4]))[0].n, 0);
    assert.ok((await db.query("select documents_purged_at from ika_star_requests where id = $1", [r4]))[0].documents_purged_at);
  } finally {
    await db.query("delete from ika_star_requests where user_id like 'sbtest-%'").catch(() => {});
    await db.query("delete from stored_files where id not in (select file_id from ika_star_documents) and content_type = 'image/png' and created_at > now() - interval '1 hour'").catch(() => {});
    await db.query("delete from ika_profiles where user_id like 'sbtest-%'").catch(() => {});
    await db.query("delete from ika_users where id like 'sbtest-%'").catch(() => {});
    await db.end?.();
  }
});
