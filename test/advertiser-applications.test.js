// Demandes annonceur et restriction de publication : fausse base, on vérifie la logique et le SQL émis.
import test from "node:test";
import assert from "node:assert/strict";
import { createAdvertiserApplications } from "../server/services/advertiser-applications.js";
import { createAccounts } from "../server/services/accounts.js";

function fakeDb(handlers = []) {
  const calls = [];
  const query = async (sql, params = []) => {
    calls.push({ sql, params });
    for (const [re, fn] of handlers) if (re.test(sql)) return fn(sql, params);
    return [];
  };
  return { calls, query, transaction: async (fn) => fn({ query }) };
}
const staffAccounts = (extra = {}) => {
  const audits = [];
  return {
    audits,
    ensureProfile: async () => ({ account_status: "ACTIVE", full_name: "Awa" }),
    requireStaff: async (id) => { if (id !== "mod") { const e = new Error("Réservé."); e.status = 403; throw e; } return { staff_role: "MODERATOR" }; },
    audit: async (...a) => { audits.push(a); },
    ...extra,
  };
};
const rejects = (promise, re) => assert.rejects(promise, (e) => re.test(e.message));

test("une demande a un identifiant aléatoire (pas de collision dans la même milliseconde)", async () => {
  const db = fakeDb();
  const svc = createAdvertiserApplications({ db, accounts: staffAccounts() });
  const a = await svc.submit("u1", { type: "PARTICULIER" });
  const b = await svc.submit("u2", { type: "AGENCE", agencyName: "X" });
  assert.notEqual(a.id, b.id);
  assert.match(a.id, /^app_[0-9a-f-]{36}$/);
});

test("une seule demande en cours par compte", async () => {
  const db = fakeDb([[/status in \('PENDING', 'UNDER_REVIEW', 'ADDITIONAL_INFO_REQUIRED'\)/, () => [{ id: "app_x" }]]]);
  const svc = createAdvertiserApplications({ db, accounts: staffAccounts() });
  await rejects(svc.submit("u1", {}), /déjà une demande/);
});

test("décision : réservée à l'équipe, action connue, motif obligatoire hors approbation", async () => {
  const db = fakeDb([[/select \* from ika_advertiser_applications/, () => [{ id: "a1", user_id: "u1", status: "PENDING", display_role_requested: "Agence immobilière" }]]]);
  const svc = createAdvertiserApplications({ db, accounts: staffAccounts() });
  await rejects(svc.decide("u1", "a1", { action: "APPROVE" }), /Réservé/);
  await rejects(svc.decide("mod", "a1", { action: "constructor" }), /Action inconnue/);
  await rejects(svc.decide("mod", "a1", { action: "REJECT" }), /motif/i);
  await rejects(svc.decide("mod", "a1", { action: "NEED_INFO", note: "  " }), /motif/i);
});

test("décision : une demande déjà traitée ne se retraite pas", async () => {
  for (const status of ["APPROVED", "REJECTED", "CANCELLED"]) {
    const db = fakeDb([[/select \* from ika_advertiser_applications/, () => [{ id: "a1", user_id: "u1", status }]]]);
    const svc = createAdvertiserApplications({ db, accounts: staffAccounts() });
    await rejects(svc.decide("mod", "a1", { action: "APPROVE" }), /déjà traitée/);
    assert.ok(!db.calls.some((c) => /^update/.test(c.sql.trim())));
  }
});

test("approbation : statut, rôle affiché, journal et notification", async () => {
  const db = fakeDb([[/select \* from ika_advertiser_applications/, () => [{ id: "a1", user_id: "u1", status: "PENDING", display_role_requested: "Propriétaire direct" }]]]);
  const accounts = staffAccounts();
  const sent = [];
  const svc = createAdvertiserApplications({ db, accounts, notify: async (...a) => { sent.push(a); } });
  const r = await svc.decide("mod", "a1", { action: "APPROVE" });
  assert.equal(r.status, "APPROVED");
  assert.ok(db.calls.some((c) => /update ika_profiles set display_role/.test(c.sql) && c.params[1] === "u1"));
  assert.equal(accounts.audits[0][1], "ADVERTISER_APPLICATION_APPROVE");
  assert.equal(accounts.audits[0][2], null, "pas de clé étrangère annonce dans le journal");
  assert.equal(sent[0][0], "u1");
  assert.equal(sent[0][1].kind, "ADVERTISER_APPROVED");
});

test("demande d'infos : statut dédié, motif transmis, rôle inchangé ; un échec de notification n'annule rien", async () => {
  const db = fakeDb([[/select \* from ika_advertiser_applications/, () => [{ id: "a1", user_id: "u1", status: "UNDER_REVIEW" }]]]);
  const svc = createAdvertiserApplications({ db, accounts: staffAccounts(), notify: async () => { throw new Error("boom"); } });
  const r = await svc.decide("mod", "a1", { action: "NEED_INFO", note: "Envoyez une pièce d'identité." });
  assert.equal(r.status, "ADDITIONAL_INFO_REQUIRED");
  assert.ok(!db.calls.some((c) => /update ika_profiles/.test(c.sql)));
});

// --- restriction de publication ---
function accountsWith(profile, approved) {
  const db = fakeDb([
    [/from ika_profiles where user_id/, () => [profile]],
    [/from ika_advertiser_applications where user_id/, () => (approved ? [{ "?column?": 1 }] : [])],
  ]);
  return createAccounts({ db, config: {} });
}

test("publication : USER non approuvé refusé, avec renvoi vers « Devenir annonceur »", async () => {
  const acc = accountsWith({ user_id: "u1", staff_role: "USER", account_status: "ACTIVE" }, false);
  await rejects(acc.assertCanPublishListing("u1"), /Devenir annonceur/);
});

test("publication : USER approuvé et personnel acceptés ; compte restreint ou banni refusé même approuvé", async () => {
  const ok = await accountsWith({ user_id: "u1", staff_role: "USER", account_status: "ACTIVE" }, true).assertCanPublishListing("u1");
  assert.equal(ok.user_id, "u1");
  await accountsWith({ user_id: "m", staff_role: "MODERATOR", account_status: "ACTIVE" }, false).assertCanPublishListing("m");
  await rejects(accountsWith({ user_id: "u1", staff_role: "USER", account_status: "RESTRICTED" }, true).assertCanPublishListing("u1"), /bloqués/);
  await rejects(accountsWith({ user_id: "u1", staff_role: "USER", account_status: "BANNED" }, true).assertCanPublishListing("u1"), /bloqué/);
});

test("liste équipe : l'état du dernier RCCM du candidat est joint, sans exposer le fichier", async () => {
  const db = fakeDb();
  const svc = createAdvertiserApplications({ db, accounts: staffAccounts() });
  await svc.listForStaff("mod", { status: "PENDING" });
  const sql = db.calls.find((c) => /from ika_advertiser_applications a/.test(c.sql)).sql;
  assert.match(sql, /kind = 'AGENCE'/);
  assert.match(sql, /as agency_proof_status/);
  assert.ok(!/file_data|file_id/.test(sql));
});

// --- pièces jointes facultatives ---
const pdf = "data:application/pdf;base64," + Buffer.from("%PDF-1.4\n" + "x".repeat(400)).toString("base64");
const withApp = (row, files = []) => fakeDb([
  [/select status, documents from ika_advertiser_applications/, () => (row ? [row] : [])],
  [/select user_id, documents from ika_advertiser_applications/, () => (row ? [row] : [])],
  [/select mime_type, content from stored_files/, () => files],
]);

test("pièce jointe : facultative, étiquette connue sinon « autre », ajoutée à la demande ouverte du compte", async () => {
  const db = withApp({ status: "PENDING", documents: [] });
  const svc = createAdvertiserApplications({ db, accounts: staffAccounts() });
  const r = await svc.addDocument("u1", "a1", { label: "PIECE_IDENTITE", fileData: pdf });
  assert.equal(r.label, "PIECE_IDENTITE");
  assert.equal(r.count, 1);
  const r2 = await svc.addDocument("u1", "a1", { label: "constructor", fileData: pdf });
  assert.equal(r2.label, "AUTRE");
  const update = db.calls.find((c) => /update ika_advertiser_applications set documents/.test(c.sql));
  assert.ok(update.params[0] === "a1");
  assert.ok(db.calls.some((c) => /for update/.test(c.sql) && c.params[1] === "u1"), "demande verrouillée et limitée au compte");
});

test("pièce jointe : refus si demande inconnue ou close, fichier illisible, ou plus de cinq pièces", async () => {
  const mk = (row) => createAdvertiserApplications({ db: withApp(row), accounts: staffAccounts() });
  await rejects(mk(null).addDocument("u1", "a1", { fileData: pdf }), /introuvable/i);
  await rejects(mk({ status: "APPROVED", documents: [] }).addDocument("u1", "a1", { fileData: pdf }), /déjà traitée/);
  await rejects(mk({ status: "PENDING", documents: [] }).addDocument("u1", "a1", { fileData: "data:text/html;base64,AAAA" }), /Format refusé|illisible/);
  const five = Array.from({ length: 5 }, (_, i) => ({ id: "d" + i, fileId: "f" + i, label: "AUTRE" }));
  await rejects(mk({ status: "UNDER_REVIEW", documents: five }).addDocument("u1", "a1", { fileData: pdf }), /Cinq pièces/);
});

test("pièce jointe : acceptée aussi quand l'équipe a demandé des informations", async () => {
  const db = withApp({ status: "ADDITIONAL_INFO_REQUIRED", documents: [] });
  const svc = createAdvertiserApplications({ db, accounts: staffAccounts() });
  assert.equal((await svc.addDocument("u1", "a1", { fileData: pdf })).count, 1);
});

test("lecture d'une pièce : équipe seulement, pièce réellement jointe à la demande, lecture journalisée", async () => {
  const row = { user_id: "u1", documents: [{ id: "d1", fileId: "f1", label: "RCCM" }] };
  const files = [{ mime_type: "application/pdf", content: Buffer.from("%PDF-1.4") }];
  const accounts = staffAccounts();
  const svc = createAdvertiserApplications({ db: withApp(row, files), accounts });
  await rejects(svc.viewDocument("u1", "a1", "d1"), /Réservé/);
  await rejects(svc.viewDocument("mod", "a1", "autre"), /Pièce introuvable/);
  const out = await svc.viewDocument("mod", "a1", "d1");
  assert.match(out.fileData, /^data:application\/pdf;base64,/);
  assert.equal(accounts.audits.at(-1)[1], "VIEW_APPLICATION_DOCUMENT");
});

test("nettoyage des fichiers orphelins : les pièces jointes aux demandes sont considérées comme référencées", async () => {
  const { findOrphans } = await import("../server/lib/orphan-files.js");
  const db = fakeDb([[/count\(\*\)/, () => [{ n: 0, bytes: 0 }]]]);
  await findOrphans(db, {});
  assert.ok(db.calls.every((c) => /ika_advertiser_applications/.test(c.sql)));
});

// --- conservation d'une année, renouvelable ---
test("décision finale : échéance d'un an posée sur les pièces ; demande d'infos : aucune échéance", async () => {
  const db = fakeDb([[/select \* from ika_advertiser_applications/, () => [{ id: "a1", user_id: "u1", status: "PENDING" }]]]);
  const svc = createAdvertiserApplications({ db, accounts: staffAccounts() });
  await svc.decide("mod", "a1", { action: "REJECT", note: "Pièces illisibles." });
  const upd = db.calls.find((c) => /set status = \$1/.test(c.sql));
  assert.match(upd.sql, /documents_expire_at = case when \$1 in \('APPROVED', 'REJECTED'\)/);
  assert.match(upd.sql, /interval '1 year'/);
  assert.equal(upd.params[0], "REJECTED");
});

test("renouvellement : seulement le titulaire, demande décidée, pièces encore conservées ; repart d'aujourd'hui", async () => {
  const db = fakeDb([[/update ika_advertiser_applications set documents_expire_at/, (sql, p) => (p[1] === "u1" ? [{ documents_expire_at: "2027-11-10" }] : [])]]);
  const svc = createAdvertiserApplications({ db, accounts: staffAccounts() });
  const r = await svc.renewDocuments("u1", "a1");
  assert.equal(r.ok, true);
  const q = db.calls.at(-1).sql;
  assert.match(q, /documents_expire_at = now\(\) \+ interval '1 year'/, "à partir d'aujourd'hui : pas de cumul");
  assert.match(q, /user_id = \$2/);
  assert.match(q, /status in \('APPROVED', 'REJECTED'\)/);
  await rejects(svc.renewDocuments("u2", "a1"), /Aucune pièce conservée/);
});

test("conservation : simulation compte les pièces échues ; application efface les fichiers, garde la décision", async () => {
  const { planRetention, applyRetention } = await import("../server/lib/retention.js");
  const handlers = [
    [/count\(\*\)::int as n from ika_advertiser_applications where documents_expire_at/, () => [{ n: 2 }]],
    [/count\(\*\)/, () => [{ n: 0 }]],
    [/select id, documents from ika_advertiser_applications where documents_expire_at/, () => [{ id: "a1", documents: [{ fileId: "f1" }, { fileId: "f2" }] }]],
    [/with d as/, () => [{ n: 0 }]],
  ];
  const plan = await planRetention(fakeDb(handlers));
  assert.equal(plan.find((p) => p.key === "application_documents").count, 2);
  const db = fakeDb(handlers);
  const done = await applyRetention(db, { actor: "test" });
  assert.equal(done.find((d) => d.key === "application_documents").count, 2);
  assert.equal(db.calls.filter((c) => /delete from stored_files/.test(c.sql) && ["f1", "f2"].includes(c.params[0])).length, 2);
  const clear = db.calls.find((c) => /set documents = '\[\]'::jsonb, documents_expire_at = null/.test(c.sql));
  assert.equal(clear.params[0], "a1");
  assert.ok(!db.calls.some((c) => /delete from ika_advertiser_applications/.test(c.sql)), "la demande et sa décision sont conservées");
});

// --- rappel avant échéance ---
test("rappel : marque puis notifie, 30 jours avant l'échéance, une seule fois, sans supprimer", async () => {
  const sent = [];
  const db = fakeDb([[/update ika_advertiser_applications set documents_expiry_notified_at/, () => [
    { user_id: "u1", documents_expire_at: new Date("2027-01-05T10:00:00Z") },
    { user_id: "u2", documents_expire_at: new Date("2027-01-20T10:00:00Z") },
  ]]]);
  const svc = createAdvertiserApplications({ db, accounts: staffAccounts(), notify: async (u, n) => { sent.push([u, n]); } });
  assert.equal(await svc.notifyExpiringDocuments(), 2);
  const q = db.calls[0].sql;
  assert.match(q, /documents_expiry_notified_at is null/, "un seul rappel par échéance");
  assert.match(q, /interval '30 days'/);
  assert.match(q, /documents_expire_at > now\(\)/, "pas de rappel pour une échéance déjà passée");
  assert.match(q, /status in \('APPROVED', 'REJECTED'\)/);
  assert.ok(!db.calls.some((c) => /delete/i.test(c.sql)));
  assert.equal(sent[0][1].kind, "ADVERTISER_DOCS_EXPIRING");
  assert.match(sent[0][1].title, /05\/01\/2027/);
  assert.equal(sent[0][1].link, "#/devenir-annonceur");
});

test("rappel : un échec de notification n'empêche pas les autres ; sans notificateur, rien n'est marqué", async () => {
  const rows = [{ user_id: "u1", documents_expire_at: new Date("2027-01-05") }, { user_id: "u2", documents_expire_at: new Date("2027-01-06") }];
  let n = 0;
  const db = fakeDb([[/set documents_expiry_notified_at/, () => rows]]);
  const svc = createAdvertiserApplications({ db, accounts: staffAccounts(), notify: async () => { n += 1; if (n === 1) throw new Error("boom"); } });
  assert.equal(await svc.notifyExpiringDocuments(), 1);
  const silent = fakeDb();
  assert.equal(await createAdvertiserApplications({ db: silent, accounts: staffAccounts() }).notifyExpiringDocuments(), 0);
  assert.equal(silent.calls.length, 0);
});

test("renouvellement : remet le rappel à zéro pour la nouvelle échéance", async () => {
  const db = fakeDb([[/update ika_advertiser_applications set documents_expire_at/, () => [{ documents_expire_at: "2027-11-10" }]]]);
  await createAdvertiserApplications({ db, accounts: staffAccounts() }).renewDocuments("u1", "a1");
  assert.match(db.calls.at(-1).sql, /documents_expiry_notified_at = null/);
});
