// Décision finale d'un dossier Premium : SMS générique (jamais le motif), seulement si la personne a activé les SMS et confirmé son numéro.
import test from "node:test";
import assert from "node:assert/strict";
import { createNotifier } from "../server/lib/notifier.js";

const mk = (row) => {
  const sms = [];
  const db = { query: async () => [row] };
  const n = createNotifier({ db, config: { publicUrl: "https://ika.test" }, sendSms: async (to, text) => sms.push({ to, text }) });
  return { n, sms };
};
const ok = { email: "a@ex.com", phone: "+22376000000", phone_verified_at: new Date(), phone_channel: "SMS", sms_enabled: true, email_enabled: false };
const note = { kind: "PREMIUM", title: "Demande Premium non retenue", body: "Motif : pièce illisible", link: "#/devenir-premium" };

test("décision Premium : SMS générique envoyé, sans motif ni détail", async () => {
  const { n, sms } = mk(ok);
  assert.equal((await n.deliver("u1", note)).sms, true);
  assert.match(sms[0].text, /dossier Premium/);
  assert.doesNotMatch(sms[0].text, /illisible|Motif/);
});

test("décision Premium : pas de SMS sans opt-in ou sans numéro confirmé par SMS", async () => {
  for (const row of [{ ...ok, sms_enabled: false }, { ...ok, phone_verified_at: null }, { ...ok, phone_channel: "DEMO" }]) {
    const { n, sms } = mk(row);
    assert.equal((await n.deliver("u1", note)).sms, undefined);
    assert.equal(sms.length, 0);
  }
});

test("autres notifications Premium hors décision : inchangé pour les types non SMS", async () => {
  const { n, sms } = mk(ok);
  await n.deliver("u1", { kind: "SEARCH_MATCH", title: "x" });
  assert.equal(sms.length, 0);
});
