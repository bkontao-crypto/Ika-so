// Service de centralisation des contacts, sans base réelle : faux accès base et faux réglages.
import test from "node:test";
import assert from "node:assert/strict";
import { createContactCentral, pickCategory } from "../server/services/contact-central.js";

const CENTRAL = { phone: "+22370000000", whatsapp: "+22371111111" };
function make({ setting = undefined, category = { premium: false, agency: false, advertiser: false }, listingRow = { owner_id: "u-owner", contact_mode: null, contact_custom_phone: null, contact_custom_whatsapp: null }, failSettings = false, staff = "SUPERADMIN", staffRows = [{ user_id: "a1" }] } = {}) {
  const calls = { db: [], saved: [], audit: [] };
  const db = { async query(sql, params) {
    calls.db.push(sql.trim().split(/\s+/).slice(0, 4).join(" "));
    if (/from ika_listings where id/.test(sql)) return listingRow ? [listingRow] : [];
    if (/from ika_profiles p where p.user_id/.test(sql)) return category ? [category] : [];
    if (/join ika_users u/.test(sql)) return staffRows.filter((r) => params[0].includes(r.user_id));
    throw new Error(`requête inattendue : ${sql}`);
  } };
  const superadminSettings = {
    async get() { if (failSettings) throw new Error("base indisponible"); return setting; },
    async set(actor, key, value) { calls.saved.push({ actor, key, value }); return { key, value }; },
  };
  const accounts = { async requireStaff(id, role) { if (id !== "root" || staff !== role) throw Object.assign(new Error("Accès refusé."), { status: 403 }); } };
  const moderationAudit = { async log(actor, entry) { calls.audit.push({ actor, entry }); } };
  return { cc: createContactCentral({ db, superadminSettings, accounts, moderationAudit }), calls };
}
const base = (phone = "+22377000000") => async () => ({ phone });
const ON = (cats, extra = {}) => ({ enabled: true, categories: Object.fromEntries(cats.map((k) => [k, true])), central: CENTRAL, recipients: [], ...extra });

test("réglage absent : le numéro du propriétaire sort, sans aucune lecture supplémentaire en base", async () => {
  const { cc, calls } = make();
  assert.deepEqual(await cc.wrapContact(base(), "u1", "l1", "CALL"), { phone: "+22377000000" });
  assert.deepEqual(calls.db, []);
});

test("erreur de lecture du réglage : jamais d'activation implicite", async () => {
  const { cc } = make({ failSettings: true });
  assert.deepEqual(await cc.wrapContact(base(), "u1", "l1", "WHATSAPP"), { phone: "+22377000000" });
});

test("catégorie activée : Appeler et WhatsApp utilisent les coordonnées d'IKA SÔ", async () => {
  const { cc } = make({ setting: ON(["STANDARD"]), });
  assert.equal((await cc.wrapContact(base(), "u1", "l1", "CALL")).phone, CENTRAL.phone);
  assert.equal((await cc.wrapContact(base(), "u1", "l1", "WHATSAPP")).phone, CENTRAL.whatsapp);
});

test("catégorie non activée : le propriétaire garde son contact", async () => {
  const { cc } = make({ setting: ON(["AGENCY"]) });
  assert.equal((await cc.wrapContact(base(), "u1", "l1", "CALL")).phone, "+22377000000");
});

test("propriétaire premium et agence : la catégorie Premium décide", async () => {
  const cat = { premium: true, agency: true, advertiser: true };
  const a = make({ setting: ON(["AGENCY"]), category: cat });
  assert.equal((await a.cc.wrapContact(base(), "u1", "l1", "CALL")).phone, "+22377000000"); // Agence activée seule : Premium l'emporte, non couvert
  const b = make({ setting: ON(["PREMIUM"]), category: cat });
  assert.equal((await b.cc.wrapContact(base(), "u1", "l1", "CALL")).phone, CENTRAL.phone);
});

test("catégorie indéterminée (profil introuvable) : fonctionnement normal", async () => {
  const { cc } = make({ setting: ON(["STANDARD", "ADVERTISER", "AGENCY", "PREMIUM"]), category: null });
  assert.equal((await cc.wrapContact(base(), "u1", "l1", "CALL")).phone, "+22377000000");
});

test("aucune coordonnée centralisée : erreur claire, jamais le numéro du propriétaire", async () => {
  const { cc } = make({ setting: { ...ON(["STANDARD"]), central: {} } });
  await assert.rejects(() => cc.wrapContact(base(), "u1", "l1", "CALL"), (e) => e.status === 409 && !/77000000/.test(e.message));
});

test("mode personnalisé de l'annonce (C) et mode propriétaire (A)", async () => {
  const c = make({ setting: ON(["STANDARD"]), listingRow: { owner_id: "o", contact_mode: "CUSTOM", contact_custom_phone: "+22372222222", contact_custom_whatsapp: null } });
  assert.equal((await c.cc.wrapContact(base(), "u1", "l1", "WHATSAPP")).phone, "+22372222222");
  const a = make({ setting: ON(["STANDARD"]), listingRow: { owner_id: "o", contact_mode: "OWNER", contact_custom_phone: null, contact_custom_whatsapp: null } });
  assert.equal((await a.cc.wrapContact(base(), "u1", "l1", "CALL")).phone, "+22377000000");
});

test("réglages : refusés à un compte non Superadmin, côté serveur", async () => {
  const { cc, calls } = make({ staff: "ADMIN" });
  await assert.rejects(() => cc.saveSettings("root", { enabled: true }), (e) => e.status === 403);
  await assert.rejects(() => cc.getSettings("root"), (e) => e.status === 403);
  assert.deepEqual(calls.saved, []);
});

test("réglages : enregistrement validé, journalisé avec avant/après ; destinataire non autorisé refusé", async () => {
  const { cc, calls } = make({ staffRows: [{ user_id: "a1" }] });
  const saved = await cc.saveSettings("root", { enabled: true, categories: { AGENCY: true }, central: { phone: "+223 70 00 00 00" }, recipients: ["a1"] });
  assert.equal(saved.enabled, true);
  assert.equal(calls.saved.length, 1);
  assert.equal(calls.audit[0].entry.details.before.enabled, false);
  assert.equal(calls.audit[0].entry.details.after.categories.AGENCY, true);
  await assert.rejects(() => cc.saveSettings("root", { enabled: true, categories: { AGENCY: true }, central: { phone: "+22370000000" }, recipients: ["intrus"] }), (e) => e.status === 400);
  assert.equal(calls.saved.length, 1);
});

test("destinataires désignés : seuls les comptes encore autorisés sont retenus", async () => {
  const { cc } = make({ setting: ON(["STANDARD"], { recipients: ["a1", "b2"] }), staffRows: [{ user_id: "a1" }] });
  assert.deepEqual(await cc.activeRecipients(), ["a1"]);
});

test("pickCategory : Premium, puis Agence, puis Annonceur, puis Standard", () => {
  assert.equal(pickCategory({ premium: true, agency: true, advertiser: true }), "PREMIUM");
  assert.equal(pickCategory({ premium: false, agency: true, advertiser: true }), "AGENCY");
  assert.equal(pickCategory({ premium: false, agency: false, advertiser: true }), "ADVERTISER");
  assert.equal(pickCategory({}), "STANDARD");
  assert.equal(pickCategory(undefined), "STANDARD");
});
