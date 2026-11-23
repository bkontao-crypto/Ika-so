import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_STAR_POLICY, DOC_KINDS, normalizeStarPolicy } from "../server/lib/star-badge-policy.js";
import { createStarBadge } from "../server/services/star-badge.js";

// PNG minimal valide (> 200 octets de données) en data URL.
const png = () => `data:image/png;base64,${Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(400, 1)]).toString("base64")}`;

test("réglages : éteint par défaut, valeurs bornées, pièces inconnues ignorées, facultatif ≠ obligatoire", () => {
  const d = normalizeStarPolicy(null);
  assert.equal(d.enabled, false);
  assert.deepEqual(d.requirements.AGENCY.required, ["ID_CARD", "PHOTO", "COMPANY_REGISTER", "HQ_PROOF"]);
  assert.ok(!d.requirements.AGENCY.required.includes("RESIDENCE"), "agence : justificatif de siège à la place du certificat de résidence");
  assert.deepEqual(d.requirements.INDIVIDUAL.required, ["ID_CARD", "PHOTO", "RESIDENCE"]);
  assert.ok(d.requirements.INDIVIDUAL.optional.includes("SELFIE") && !d.requirements.INDIVIDUAL.required.includes("SELFIE"));
  const n = normalizeStarPolicy({ enabled: true, priceXof: -5, durationMonths: 999, reviewDelayDays: 0, retentionDays: 99999, requirements: { INDIVIDUAL: { required: ["ID_CARD", "BIDON", "SELFIE"], optional: ["SELFIE", "PHOTO"] } } });
  assert.equal(n.enabled, true);
  assert.equal(n.priceXof, DEFAULT_STAR_POLICY.priceXof);
  assert.equal(n.durationMonths, DEFAULT_STAR_POLICY.durationMonths);
  assert.equal(n.reviewDelayDays, DEFAULT_STAR_POLICY.reviewDelayDays);
  assert.equal(n.retentionDays, DEFAULT_STAR_POLICY.retentionDays);
  assert.deepEqual(n.requirements.INDIVIDUAL.required, ["ID_CARD", "SELFIE"]);
  assert.deepEqual(n.requirements.INDIVIDUAL.optional, ["PHOTO"]);
  assert.ok(Object.keys(DOC_KINDS).length === 6);
});

function setup({ policy = { enabled: true }, phoneOk = true } = {}) {
  const requests = []; const docs = []; const files = new Map(); const notes = []; const audit = []; const settings = { value: policy };
  const q = async (sql, args = []) => {
    if (/select user_id from ika_profiles/.test(sql)) return [{ user_id: args[0] }];
    if (/select \* from ika_star_requests where user_id = \$1 and status = any/.test(sql)) return requests.filter((r) => r.user_id === args[0] && args[1].includes(r.status)).slice(0, 1);
    if (/insert into ika_star_requests/.test(sql)) { const r = { id: args[0], user_id: args[1], account_type: args[2], status: "DRAFT" }; requests.push(r); return [r]; }
    if (/select id, file_id from ika_star_documents where request_id = \$1 and kind/.test(sql)) return docs.filter((d) => d.request_id === args[0] && d.kind === args[1]);
    if (/insert into stored_files/.test(sql)) { files.set(args[0], args[4]); return []; }
    if (/delete from ika_star_documents where id/.test(sql)) { docs.splice(docs.findIndex((d) => d.id === args[0]), 1); return []; }
    if (/delete from stored_files where id = \$1/.test(sql)) { files.delete(args[0]); return []; }
    if (/insert into ika_star_documents/.test(sql)) { docs.push({ id: args[0], request_id: args[1], kind: args[2], file_id: args[3], file_type: args[4] }); return []; }
    if (/select \* from ika_star_requests where user_id = \$1 and status = 'DRAFT'/.test(sql)) return requests.filter((r) => r.user_id === args[0] && r.status === "DRAFT");
    if (/select kind from ika_star_documents/.test(sql)) return docs.filter((d) => d.request_id === args[0]).map((d) => ({ kind: d.kind }));
    if (/update ika_star_requests set status = 'PENDING'/.test(sql)) { const r = requests.find((x) => x.id === args[0]); Object.assign(r, { status: "PENDING", phone: args[1] }); return []; }
    if (/select id from ika_star_requests where user_id = \$1 and status = any/.test(sql)) return requests.filter((r) => r.user_id === args[0] && args[1].includes(r.status)).map((r) => ({ id: r.id }));
    if (/select file_id from ika_star_documents where request_id/.test(sql)) return docs.filter((d) => d.request_id === args[0]).map((d) => ({ file_id: d.file_id }));
    if (/delete from ika_star_documents where request_id/.test(sql)) { for (let i = docs.length - 1; i >= 0; i--) if (docs[i].request_id === args[0]) docs.splice(i, 1); return []; }
    if (/delete from stored_files where id = any/.test(sql)) { for (const id of args[0]) files.delete(id); return []; }
    if (/update ika_star_requests set status = 'CANCELLED'/.test(sql)) { requests.find((r) => r.id === args[0]).status = "CANCELLED"; return []; }
    if (/from ika_star_documents d\s+join ika_star_requests r/.test(sql)) { const d = docs.find((x) => x.id === args[0] && x.request_id === args[1]); const r = requests.find((x) => x.id === args[1]); return d && r && r.status !== "DRAFT" ? [{ kind: d.kind, file_type: d.file_type, user_id: r.user_id, content: files.get(d.file_id) }] : []; }
    return [];
  };
  const db = { query: q, transaction: async (fn) => fn({ query: q }) };
  const accounts = { requireActive: async () => ({}), requireVerifiedPhone: async () => { if (!phoneOk) throw Object.assign(new Error("PHONE"), { code: "PHONE_REQUIRED" }); }, requireStaff: async () => ({}) };
  const svc = createStarBadge({ db, accounts, superadminSettings: { get: async () => settings.value, set: async (_a, _k, v) => { settings.value = v; } }, requestsHub: { notifyStaff: async (n) => notes.push(n) }, moderationAudit: { log: async (who, e) => audit.push({ who, ...e }) } });
  return { svc, requests, docs, files, notes, audit };
}

test("badge fermé : aucun dépôt de pièce ni envoi, et l'info publique indique « fermé »", async () => {
  const { svc, requests } = setup({ policy: null });
  await assert.rejects(() => svc.addDocument("u1", { accountType: "INDIVIDUAL", kind: "ID_CARD", fileData: png() }), /pas ouvert/);
  await assert.rejects(() => svc.submit("u1", { phone: "70000000", acceptTerms: true }), /pas ouvert/);
  assert.equal((await svc.publicInfo()).enabled, false);
  assert.equal(requests.length, 0);
});

test("dossier particulier : pièces obligatoires exigées, pièce non demandée refusée, envoi puis notification de l'équipe", async () => {
  const { svc, requests, notes, docs } = setup();
  await assert.rejects(() => svc.addDocument("u1", { accountType: "INDIVIDUAL", kind: "COMPANY_REGISTER", fileData: png() }), /pas demandée/);
  await assert.rejects(() => svc.addDocument("u1", { accountType: "INDIVIDUAL", kind: "ID_CARD", fileData: "data:text/plain;base64,AAAA" }), /Format refusé|illisible/);
  await svc.addDocument("u1", { accountType: "INDIVIDUAL", kind: "ID_CARD", fileData: png() });
  await svc.addDocument("u1", { accountType: "INDIVIDUAL", kind: "PHOTO", fileData: png() });
  await assert.rejects(() => svc.submit("u1", { phone: "70000000", acceptTerms: true }), /manquantes.*Certificat de résidence/);
  await assert.rejects(() => svc.submit("u1", { phone: "70000000", acceptTerms: false }), /accepter/);
  await svc.addDocument("u1", { accountType: "INDIVIDUAL", kind: "RESIDENCE", fileData: png() });
  const out = await svc.submit("u1", { phone: "+223 70 00 00 00", message: "Bonjour", acceptTerms: true });
  assert.equal(out.ok, true);
  assert.equal(requests[0].status, "PENDING");
  assert.equal(docs.length, 3);
  assert.equal(notes[0].module, "trust");
  await assert.rejects(() => svc.addDocument("u1", { accountType: "INDIVIDUAL", kind: "SELFIE", fileData: png() }), /déjà envoyé/);
});

test("agence : registre de commerce et justificatif de siège obligatoires ; remplacer une pièce supprime l'ancien fichier", async () => {
  const { svc, docs, files } = setup();
  for (const kind of ["ID_CARD", "PHOTO", "COMPANY_REGISTER"]) await svc.addDocument("a1", { accountType: "AGENCY", kind, fileData: png() });
  await assert.rejects(() => svc.submit("a1", { phone: "70000000", acceptTerms: true }), /Justificatif de siège/);
  const before = files.size;
  await svc.addDocument("a1", { accountType: "AGENCY", kind: "PHOTO", fileData: png() });
  assert.equal(files.size, before, "l'ancienne photo est supprimée du stockage");
  assert.equal(docs.filter((d) => d.kind === "PHOTO").length, 1);
});

test("téléphone non confirmé : envoi refusé quand le réglage l'exige", async () => {
  const { svc } = setup({ phoneOk: false });
  for (const kind of ["ID_CARD", "PHOTO", "RESIDENCE"]) await svc.addDocument("u2", { accountType: "INDIVIDUAL", kind, fileData: png() });
  await assert.rejects(() => svc.submit("u2", { phone: "70000000", acceptTerms: true }), (e) => e.code === "PHONE_REQUIRED");
});

test("retrait du dossier : pièces et fichiers supprimés ; lecture d'une pièce par l'équipe tracée et impossible tant que le dossier n'est pas envoyé", async () => {
  const { svc, docs, files, audit, requests } = setup();
  for (const kind of ["ID_CARD", "PHOTO", "RESIDENCE"]) await svc.addDocument("u3", { accountType: "INDIVIDUAL", kind, fileData: png() });
  const docId = docs[0].id; const reqId = requests[0].id;
  await assert.rejects(() => svc.viewDocument("staff1", reqId, docId), /introuvable/);
  await svc.submit("u3", { phone: "70000000", acceptTerms: true });
  const doc = await svc.viewDocument("staff1", reqId, docId);
  assert.match(doc.fileData, /^data:image\/png;base64,/);
  assert.equal(audit.at(-1).action, "STAR_DOCUMENT_VIEW");
  await svc.cancel("u3");
  assert.equal(docs.length, 0); assert.equal(files.size, 0); assert.equal(requests[0].status, "CANCELLED");
});

test("réglages enregistrés : normalisés et tracés", async () => {
  const { svc, audit } = setup();
  const saved = await svc.saveSettings("admin1", { enabled: true, priceXof: 15000, durationMonths: 6 });
  assert.equal(saved.priceXof, 15000);
  assert.equal((await svc.policy()).durationMonths, 6);
  assert.equal(audit.at(-1).action, "STAR_BADGE_SETTINGS_UPDATE");
});
