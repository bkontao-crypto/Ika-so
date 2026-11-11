// Vérification sur PostgreSQL réel du circuit « demande annonceur » (hors livraison).
const ROOT = process.argv[2];
const { createDb } = await import(`${ROOT}/server/db.js`);
const { getConfig } = await import(`${ROOT}/server/config.js`);
const { createServices } = await import(`${ROOT}/server/services/index.js`);
const { planRetention, applyRetention } = await import(`${ROOT}/server/lib/retention.js`);
const { findOrphans } = await import(`${ROOT}/server/lib/orphan-files.js`);

const db = createDb(process.env.DATABASE_URL);
const config = getConfig({ NODE_ENV: "development", PAYMENT_PROVIDER: "fake", PAYMENT_WEBHOOK_SECRET: "s" });
const s = createServices({ db, config, sendSms: async () => {} });
let fails = 0;
const ok = (n, c, d = "") => { console.log(`${c ? "OK   " : "ECHEC"} ${n}${d ? " — " + d : ""}`); if (!c) fails++; };
const step = async (n, fn) => { try { return await fn(); } catch (e) { ok(n, false, e.message); return undefined; } };
const rand = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.from(Array.from({ length: 600 }, (_, i) => (i * 37) % 256))]);
const pdf = "data:application/pdf;base64," + rand.toString("base64");

const reg = async (name, email) => { const r = await s.accounts.register({ name, email, password: "motdepasse123", acceptTerms: true }); return r.user?.id ?? r.id ?? r.userId; };
const stamp = Date.now();
const agency = await step("inscription agence", () => reg("Agence Test", `ag${stamp}@x.ml`));
const staff = await step("inscription modérateur", () => reg("Modo Test", `mo${stamp}@x.ml`));
ok("ids obtenus", !!agency && !!staff, `${agency} ${staff}`);
await db.query("update ika_profiles set staff_role = 'ADMIN' where user_id = $1", [staff]);

const app = await step("soumission demande agence", () => s.advertiserApplications.submit(agency, { type: "AGENCE", agencyName: "Agence Test", phone: "70000000", city: "Bamako" }));
ok("demande créée PENDING", app?.status === "PENDING");
const d1 = await step("ajout pièce RCCM", () => s.advertiserApplications.addDocument(agency, app.id, { label: "RCCM", fileData: pdf }));
ok("pièce ajoutée", d1?.count === 1);
await step("ajout pièce identité", () => s.advertiserApplications.addDocument(agency, app.id, { label: "PIECE_IDENTITE", fileData: pdf }));
const list = await step("liste équipe", () => s.advertiserApplications.listForStaff(staff, { status: "PENDING" }));
const row = list?.find((r) => r.id === app.id);
ok("liste équipe : 2 pièces visibles sans contenu", row?.documents?.length === 2 && !JSON.stringify(row).includes("fileData"));
const view = await step("lecture pièce", () => s.advertiserApplications.viewDocument(staff, app.id, row.documents[0].id));
ok("lecture pièce : contenu identique", view?.fileData === pdf);
const aud = await db.query("select count(*)::int n from ika_audit where action = 'VIEW_APPLICATION_DOCUMENT'");
ok("lecture journalisée", aud[0].n === 1);
await step("NEED_INFO", () => s.advertiserApplications.decide(staff, app.id, { action: "NEED_INFO", note: "Joindre statuts" }));
const d3 = await step("ajout après demande d'infos", () => s.advertiserApplications.addDocument(agency, app.id, { label: "AUTRE", fileData: pdf }));
ok("ajout après NEED_INFO", d3?.count === 3);
const dec = await step("APPROVE", () => s.advertiserApplications.decide(staff, app.id, { action: "APPROVE", note: "" }));
ok("approuvée", dec?.status === "APPROVED");
const exp = (await db.query("select documents_expire_at, (documents_expire_at between now() + interval '364 days' and now() + interval '366 days') as one_year from ika_advertiser_applications where id=$1", [app.id]))[0];
ok("échéance ≈ 1 an après décision", exp.one_year === true, String(exp.documents_expire_at));
await step("retraitement refusé", async () => { try { await s.advertiserApplications.decide(staff, app.id, { action: "REJECT", note: "x" }); ok("retraitement refusé", false); } catch { ok("retraitement refusé", true); } });
const mine = await step("listMine", () => s.advertiserApplications.listMine(agency));
ok("listMine : 3 pièces", mine?.[0]?.documents_count === 3);
const role = (await db.query("select display_role from ika_profiles where user_id=$1", [agency]))[0];
ok("rôle d'affichage attribué", role?.display_role === "Agence immobilière", role?.display_role);

// Rappel : hors fenêtre, puis dans la fenêtre
ok("rappel hors fenêtre : 0", (await s.advertiserApplications.notifyExpiringDocuments()) === 0);
await db.query("update ika_advertiser_applications set documents_expire_at = now() + interval '10 days' where id=$1", [app.id]);
ok("rappel dans la fenêtre : 1", (await s.advertiserApplications.notifyExpiringDocuments()) === 1);
ok("rappel unique : 0 ensuite", (await s.advertiserApplications.notifyExpiringDocuments()) === 0);
const notif = await db.query("select count(*)::int n from ika_notifications where user_id=$1 and kind='ADVERTISER_DOCS_EXPIRING'", [agency]);
ok("notification créée", notif[0].n === 1);
const rn = await step("renouvellement", () => s.advertiserApplications.renewDocuments(agency, app.id));
ok("renouvelé, rappel réarmé", rn?.ok === true && (await db.query("select documents_expiry_notified_at is null as r from ika_advertiser_applications where id=$1", [app.id]))[0].r === true);

// Export (sans contenu)
const exp2 = await step("export données", () => s.rights.exportData(agency));
const exported = JSON.stringify(exp2 ?? {});
ok("export contient la demande, sans contenu de fichier", exported.includes("advertiserApplications") && !exported.includes(rand.toString("base64").slice(0, 40)));

// Orphelins : les fichiers rattachés ne sont pas orphelins
await db.query("update stored_files set created_at = now() - interval '10 days'");
const orph = await findOrphans(db, { minAgeHours: 24 });
ok("pièces jointes jamais comptées comme orphelines", orph.totalCount === 0, `orphelins=${orph.totalCount}`);

// Purge : simulation puis application
await db.query("update ika_advertiser_applications set documents_expire_at = now() - interval '1 day' where id=$1", [app.id]);
const plan = await planRetention(db);
const pa = plan.find((p) => p.key === "application_documents");
ok("simulation purge : 1 demande", pa?.count === 1, JSON.stringify(pa));
const before = (await db.query("select count(*)::int n from stored_files"))[0].n;
await step("purge appliquée", () => applyRetention(db, { actor: "test" }));
const after = (await db.query("select count(*)::int n from stored_files"))[0].n;
const st = (await db.query("select status, documents from ika_advertiser_applications where id=$1", [app.id]))[0];
ok("purge : fichiers effacés, décision conservée", after === before - 3 && st.status === "APPROVED" && st.documents.length === 0, `fichiers ${before}->${after}`);

// Suppression de compte avec pièces
const u2 = await reg("Particulier", `pa${stamp}@x.ml`);
const a2 = await s.advertiserApplications.submit(u2, { type: "PARTICULIER" });
await s.advertiserApplications.addDocument(u2, a2.id, { label: "PIECE_IDENTITE", fileData: pdf });
const f0 = (await db.query("select count(*)::int n from stored_files"))[0].n;
await step("suppression de compte", () => s.rights.deleteAccount(u2, { password: "motdepasse123", confirm: "SUPPRIMER" }));
const f1 = (await db.query("select count(*)::int n from stored_files"))[0].n;
ok("suppression de compte : pièce effacée", f1 === f0 - 1 && (await db.query("select count(*)::int n from ika_advertiser_applications where user_id=$1", [u2]))[0].n === 0, `fichiers ${f0}->${f1}`);

console.log(fails ? `\n${fails} ÉCHEC(S)` : "\nTOUT OK");
await db.close();
process.exit(fails ? 1 : 0);
