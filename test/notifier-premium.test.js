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

// WhatsApp : décision Premium seulement, désactivé par défaut, jamais sans réglage superadmin + consentement + numéro confirmé.
const mkWa = (row, on) => {
  const wa = [];
  const n = createNotifier({ db: { query: async () => [row] }, config: { publicUrl: "https://ika.test" }, sendWhatsapp: async (to) => wa.push(to), whatsappOn: async () => on });
  return { n, wa };
};
const waRow = { email: "a@ex.com", phone: "+22376000000", phone_verified_at: new Date(), phone_channel: "SMS", sms_enabled: false, email_enabled: false, whatsapp_enabled: true };
test("WhatsApp : envoyé à la décision Premium quand tout est réuni", async () => {
  const { n, wa } = mkWa(waRow, true);
  assert.equal((await n.deliver("u1", note)).whatsapp, true);
  assert.deepEqual(wa, ["+22376000000"]);
});
test("WhatsApp : rien si réglage éteint, sans consentement, sans numéro confirmé ou autre type de notification", async () => {
  for (const [row, on, nt] of [[waRow, false, note], [{ ...waRow, whatsapp_enabled: false }, true, note], [{ ...waRow, phone_verified_at: null }, true, note], [waRow, true, { ...note, kind: "MESSAGE" }]]) {
    const { n, wa } = mkWa(row, on);
    assert.equal((await n.deliver("u1", nt)).whatsapp, undefined);
    assert.equal(wa.length, 0);
  }
});
test("WhatsApp : activer la préférence est refusé tant que le canal n'est pas disponible", async () => {
  const { n } = mkWa(waRow, false);
  await assert.rejects(n.setPrefs("u1", { whatsapp: true }), /pas encore disponible/);
});
