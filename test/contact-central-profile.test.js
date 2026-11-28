// Contact depuis le profil public d'un annonceur : même règle que les annonces, sans base réelle.
import test from "node:test";
import assert from "node:assert/strict";
import { createContactCentral } from "../server/services/contact-central.js";

const CENTRAL = { phone: "+22370000000", whatsapp: "+22371111111" };
const ON = (cats, extra = {}) => ({ enabled: true, categories: Object.fromEntries(cats.map((k) => [k, true])), central: CENTRAL, recipients: [], ...extra });

function make({ setting, category = { premium: false, agency: false, advertiser: false }, targetRows = [{ id: "adv1" }] } = {}) {
  const inserted = [];
  const db = { async query(sql, params) {
    if (/from ika_profiles p where p.user_id/.test(sql)) return category ? [category] : [];
    if (/from ika_users u join ika_profiles p/.test(sql)) return targetRows;
    if (/insert into ika_profile_contact_events/.test(sql)) { inserted.push(params); return []; }
    throw new Error(`requête inattendue : ${sql}`);
  } };
  const superadminSettings = { async get() { return setting; }, async set() {} };
  const accounts = { async requireActive() {}, async requireStaff() {} };
  return { cc: createContactCentral({ db, superadminSettings, accounts }), inserted };
}
const ownerBase = async () => ({ phone: "+22377000000" });

test("réglage éteint : l'ancien comportement du profil est conservé (aucun accès supplémentaire)", async () => {
  const { cc, inserted } = make();
  assert.deepEqual(await cc.wrapProfileContact(ownerBase, "visiteur", "adv1", "CALL"), { phone: "+22377000000" });
  assert.deepEqual(inserted, []);
});

test("catégorie activée : Appeler et WhatsApp du profil donnent les coordonnées d'IKA SÔ et l'événement est enregistré", async () => {
  const { cc, inserted } = make({ setting: ON(["STANDARD"]) });
  assert.deepEqual(await cc.wrapProfileContact(ownerBase, "visiteur", "adv1", "CALL"), { phone: CENTRAL.phone });
  assert.deepEqual(await cc.wrapProfileContact(ownerBase, "visiteur", "adv1", "WHATSAPP"), { phone: CENTRAL.whatsapp });
  assert.equal(inserted.length, 2);
  assert.deepEqual([inserted[0][1], inserted[0][2], inserted[0][3]], ["adv1", "visiteur", "CALL"]);
});

test("catégorie non activée : comportement d'origine du profil", async () => {
  const { cc } = make({ setting: ON(["AGENCY"]) });
  assert.deepEqual(await cc.wrapProfileContact(ownerBase, "visiteur", "adv1", "CALL"), { phone: "+22377000000" });
});

test("profil introuvable, propre profil, coordonnées absentes : refus sans fuite du numéro du propriétaire", async () => {
  await assert.rejects(() => make({ setting: ON(["STANDARD"]), targetRows: [] }).cc.wrapProfileContact(ownerBase, "visiteur", "adv1", "CALL"), (e) => e.status === 404);
  await assert.rejects(() => make({ setting: ON(["STANDARD"]) }).cc.wrapProfileContact(ownerBase, "adv1", "adv1", "CALL"), (e) => e.status === 400);
  await assert.rejects(() => make({ setting: { ...ON(["STANDARD"]), central: {} } }).cc.wrapProfileContact(ownerBase, "visiteur", "adv1", "CALL"), (e) => e.status === 409 && !/77000000/.test(e.message));
});

test("bloc du profil : les boutons suivent la règle active, sans numéro dans la réponse", async () => {
  const block = async () => ({ name: "Agence X", contact: { canCall: false, canWhatsapp: false, needsLogin: false } });
  const off = make({ setting: ON(["AGENCY"]) });
  assert.deepEqual((await off.cc.wrapProfileBlock(block, "adv1", { signedIn: false })).contact, { canCall: false, canWhatsapp: false, needsLogin: false });
  const on = make({ setting: ON(["STANDARD"]) });
  const out = await on.cc.wrapProfileBlock(block, "adv1", { signedIn: false });
  assert.deepEqual(out.contact, { canCall: true, canWhatsapp: true, needsLogin: true });
  assert.ok(!JSON.stringify(out).includes("+223"));
  assert.equal((await on.cc.wrapProfileBlock(block, "adv1", { signedIn: true })).contact.needsLogin, false);
  assert.equal(await on.cc.wrapProfileBlock(async () => null, "adv1", {}), null);
});
