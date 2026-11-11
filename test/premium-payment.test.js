// Achat du Premium : même circuit que la mise à la une, sur fausse base (sans PostgreSQL).
import test from "node:test";
import assert from "node:assert/strict";
import { createPayments } from "../server/services/payments.js";
import { createFakeProvider, sign } from "../server/payments/providers.js";

function setup() {
  const log = [];
  const pay = { id: null, status: "PENDING", applied_at: null };
  const query = async (sql, params = []) => {
    log.push({ sql, params });
    if (/from ika_offers where code/.test(sql)) return [{ code: "PREMIUM_30", label: "Premium, 30 jours", days: 30, price_xof: 5000, kind: "PREMIUM" }];
    if (/select user_id from ika_profiles/.test(sql)) return [{ user_id: "u1" }];
    if (/from ika_payments where user_id = \$1 and kind = 'PREMIUM'/.test(sql)) return [];
    if (/insert into ika_payments/.test(sql)) { pay.id = params[0]; return []; }
    if (/from ika_users u left join/.test(sql)) return [{ name: "Awa", email: "a@x.ml", phone: "70000000" }];
    if (/insert into ika_payment_events/.test(sql)) return [{ event_id: params[1] }];
    if (/select \* from ika_payments where provider/.test(sql)) return [{ id: pay.id, user_id: "u1", listing_id: null, kind: "PREMIUM", days: 30, amount_xof: 5000, status: pay.status, offer_code: "PREMIUM_30" }];
    if (/set status = 'PAID'/.test(sql)) { pay.status = "PAID"; return [{ id: pay.id }]; }
    if (/set applied_at = now\(\)/.test(sql)) return [{ id: pay.id, user_id: "u1", listing_id: null, kind: "PREMIUM", days: 30, amount_xof: 5000, offer_code: "PREMIUM_30" }];
    if (/update ika_profiles set premium_until/.test(sql)) return [{ user_id: "u1" }];
    if (/select \* from ika_payments where id/.test(sql)) return [{ id: pay.id, kind: "PREMIUM", status: "PENDING", days: 30, amount_xof: 5000 }];
    return [];
  };
  const db = { query, transaction: (fn) => fn({ query }) };
  const accounts = { requireActive: async () => {}, audit: async () => {} };
  return { log, pay, payments: createPayments({ db }, accounts, createFakeProvider({ secret: "s" })) };
}

test("checkout Premium : paiement sans annonce, créé en PENDING", async () => {
  const { log, payments } = setup();
  const r = await payments.checkout("u1", { offerCode: "PREMIUM_30" });
  const ins = log.find((l) => /insert into ika_payments/.test(l.sql));
  assert.ok(ins && /values \(\$1,\$2,null,/.test(ins.sql) && /'PREMIUM'/.test(ins.sql) && ins.params[1] === "u1" && ins.params[4] === 5000);
  assert.equal(r.payment.kind, "PREMIUM");
});

test("webhook confirmé : le Premium est prolongé de 30 jours et l'octroi est historisé", async () => {
  const { log, pay, payments } = setup();
  await payments.checkout("u1", { offerCode: "PREMIUM_30" });
  const raw = JSON.stringify({ eventId: "e1", providerRef: `fake_${pay.id}`, status: "PAID", amountXof: 5000 });
  const r = await payments.webhook(raw, { "x-ika-signature": sign("s", raw) });
  assert.equal(r.ok, true);
  const up = log.find((l) => /update ika_profiles set premium_until/.test(l.sql));
  assert.deepEqual(up.params, ["u1", "30"]);
  assert.ok(log.some((l) => /insert into ika_premium_grants/.test(l.sql) && l.params[4] === pay.id));
  assert.ok(!log.some((l) => /update ika_listings/.test(l.sql)));
});

test("suivi Premium : types d'événements et origines en liste blanche", async () => {
  const { buildEvent, EVENT_TYPES, premiumOrigin } = await import("../server/lib/analytics-events.js");
  assert.ok(EVENT_TYPES.includes("premium_cta_clicked") && EVENT_TYPES.includes("premium_checkout_started"));
  assert.equal(premiumOrigin("espace-hero"), "espace-hero");
  assert.equal(premiumOrigin("<script>"), "autre");
  const e = buildEvent("premium_cta_clicked", { metadata: { from: "espace-hero", note: "secret" } }, { eventId: "e1" });
  assert.deepEqual(e.metadata, { from: "espace-hero" });
  const p = buildEvent("payment_completed", { metadata: { kind: "PREMIUM", from: "espace-card", x: 1 } }, { eventId: "e2" });
  assert.deepEqual(p.metadata, { kind: "PREMIUM", from: "espace-card" });
});

test("checkout Premium : l'origine du clic est gardée sur le paiement (liste fermée)", async () => {
  const { log, payments } = setup();
  await payments.checkout("u1", { offerCode: "PREMIUM_30", from: "espace-teaser" });
  const ins = log.find((l) => /insert into ika_payments/.test(l.sql));
  assert.equal(ins.params[6], "espace-teaser");
  const s2 = setup();
  await s2.payments.checkout("u1", { offerCode: "PREMIUM_30", from: "n'importe quoi" });
  assert.equal(s2.log.find((l) => /insert into ika_payments/.test(l.sql)).params[6], "autre");
});
