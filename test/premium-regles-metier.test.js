// Règles métier du parcours Premium corrigées sur la branche fix/premium-regles-metier, sur fausse base (sans PostgreSQL) :
//   1. notification et reçu quand le paiement est confirmé ;
//   2. remboursement d'un dossier Premium refusé = fin des jours Premium du paiement concerné ;
//   3. exception « téléphone » : le serveur et l'écran appliquent la même règle.
import test from "node:test";
import assert from "node:assert/strict";
import { createPayments } from "../server/services/payments.js";
import { createPremiumRequests } from "../server/services/premium-requests.js";
import { createAdvertiserCenter } from "../server/services/advertiser-center.js";
import { createServices } from "../server/services/index.js";
import { getConfig } from "../server/config.js";
import { normalizeRules } from "../server/lib/account-rules.js";
import { formatReceiptEmail } from "../server/lib/receipt-email.js";
import { createFakeProvider, sign } from "../server/payments/providers.js";

const settle = () => new Promise((resolve) => setTimeout(resolve, 50)); // l'envoi du reçu est asynchrone (meilleur effort)
const CREATED = new Date("2026-11-20T10:00:00Z");

// ---------------------------------------------------------------------------
// 1. Notification et reçu après paiement confirmé
// ---------------------------------------------------------------------------

function webhookSetup({ kind = "PREMIUM" } = {}) {
  const log = [];
  const seen = new Set();
  const pay = { id: "pay1", status: "PENDING" };
  const row = () => ({ id: pay.id, user_id: "u1", listing_id: kind === "PREMIUM" ? null : "l1", kind, days: 30, amount_xof: 5000, status: pay.status, offer_code: "PREMIUM_30", applied_at: null, origin: "autre" });
  const query = async (sql, params = []) => {
    log.push({ sql, params });
    if (/insert into ika_payment_events/.test(sql)) { if (seen.has(params[1])) return []; seen.add(params[1]); return [{ event_id: params[1] }]; }
    if (/select \* from ika_payments where provider/.test(sql)) return [row()];
    if (/set status = 'PAID'/.test(sql)) { const moved = pay.status !== "PAID"; pay.status = "PAID"; return moved ? [{ id: pay.id }] : []; }
    if (/set applied_at = now\(\)/.test(sql)) return [row()];
    if (/update ika_profiles set premium_until/.test(sql)) return [{ user_id: "u1" }];
    if (/from ika_offers where code/.test(sql)) return [{ label: "Premium, 30 jours" }];
    if (/from ika_invoices i join ika_users u/.test(sql)) return [{ number: "IKA-2026-000001", label: "Premium, 30 jours", name: "<b>Awa</b>" }];
    return [];
  };
  const db = { query, transaction: (fn) => fn({ query }) };
  const sent = [];
  const services = createServices({
    db,
    config: getConfig({ NODE_ENV: "test", BOOTSTRAP_ADMIN: "false" }),
    sendSms: async () => ({}),
    paymentProvider: createFakeProvider({ secret: "s" }),
    notifier: { notify: async (userId, message) => { sent.push({ userId, ...message }); } },
  });
  const hook = (eventId) => {
    const raw = JSON.stringify({ eventId, providerRef: `fake_${pay.id}`, status: "PAID", amountXof: 5000 });
    return services.payments.webhook(raw, { "x-ika-signature": sign("s", raw) });
  };
  const siteNotifications = () => log.filter((l) => /ika_notifications/.test(l.sql) && l.params.includes("Paiement Premium confirmé"));
  return { hook, sent, siteNotifications };
}

test("paiement Premium confirmé : notification sur le site et reçu envoyé par les canaux choisis", async () => {
  const { hook, sent, siteNotifications } = webhookSetup();
  assert.equal((await hook("e1")).ok, true);
  await settle();
  const notes = siteNotifications();
  assert.equal(notes.length, 1);
  assert.ok(notes[0].params.includes("u1"));
  assert.equal(sent.length, 1);
  assert.equal(sent[0].userId, "u1");
  assert.deepEqual(sent[0].channels, ["email", "sms", "whatsapp"]);
  assert.ok(sent[0].text.includes("IKA-2026-000001"));
});

test("paiement confirmé : une relance du fournisseur ou une 2e notification n'envoie rien de plus", async () => {
  const { hook, sent, siteNotifications } = webhookSetup();
  await hook("e1");
  await settle();
  const again = await hook("e1"); // même événement : déjà vu
  assert.equal(again.duplicate, true);
  await hook("e2"); // autre événement pour un paiement déjà payé
  await settle();
  assert.equal(siteNotifications().length, 1);
  assert.equal(sent.length, 1);
});

test("mise à la une payée : reçu envoyé, mais pas de notification Premium", async () => {
  const { hook, sent, siteNotifications } = webhookSetup({ kind: "BOOST" });
  await hook("e1");
  await settle();
  assert.equal(siteNotifications().length, 0);
  assert.equal(sent.length, 1);
});

test("reçu : le nom du profil est échappé dans le HTML du courriel, pas dans le texte brut", () => {
  const r = formatReceiptEmail({ reference: "IKA-1", amountXof: 5000, offerName: "<i>Premium</i>", userName: "<b>Awa</b>", invoiceUrl: 'https://x.ml/f?a="1"' });
  assert.ok(r.html.includes("&lt;b&gt;Awa&lt;/b&gt;"));
  assert.ok(!r.html.includes("<b>Awa</b>"));
  assert.ok(r.html.includes("&lt;i&gt;Premium&lt;/i&gt;"));
  assert.ok(r.html.includes("&quot;1&quot;"));
  assert.ok(r.text.includes("<b>Awa</b>"));
});

// ---------------------------------------------------------------------------
// 2. Remboursement d'un dossier Premium refusé : les jours Premium du paiement partent avec lui
// ---------------------------------------------------------------------------

function refundSetup(payment) {
  const log = [];
  const audit = [];
  const q = { query: async (sql, params = []) => { log.push({ sql, params }); return /from ika_payments where user_id = \$1 and kind = 'PREMIUM' and status = 'PAID'/.test(sql) ? (payment ? [payment] : []) : []; } };
  const accounts = { audit: async (...args) => { audit.push(args); } };
  const payments = createPayments({ db: { query: q.query, transaction: (fn) => fn(q) } }, accounts, createFakeProvider({ secret: "s" }));
  return { payments, q, log, audit };
}
const PAID_PREMIUM = { id: "pay1", user_id: "u1", listing_id: null, kind: "PREMIUM", days: 30, status: "PAID", applied_at: new Date("2026-11-19T10:00:00Z") };

test("remboursement d'un dossier refusé : paiement REFUNDED, jours Premium retirés, octroi supprimé, audit écrit", async () => {
  const { payments, q, log, audit } = refundSetup(PAID_PREMIUM);
  const out = await payments.refundForRejectedPremium(q, { userId: "u1", requestCreatedAt: CREATED, by: "staff1" });
  assert.deepEqual(out, { refunded: true, paymentId: "pay1" });
  const lookup = log.find((l) => /kind = 'PREMIUM' and status = 'PAID'/.test(l.sql));
  assert.equal(lookup.params[0], "u1");
  assert.equal(lookup.params[1], CREATED); // le paiement concerné est celui d'avant le dépôt du dossier
  assert.ok(/for update/.test(lookup.sql));
  const refund = log.find((l) => /update ika_payments set status = 'REFUNDED'/.test(l.sql));
  assert.equal(refund.params[0], "pay1");
  assert.match(refund.params[1], /Dossier Premium refusé/);
  assert.equal(refund.params[2], "staff1");
  assert.equal(refund.params[4], false); // reste « à confirmer » chez le fournisseur
  const profile = log.find((l) => /update ika_profiles set premium_until = case/.test(l.sql));
  assert.deepEqual(profile.params, ["u1", "30"]);
  const grants = log.find((l) => /delete from ika_premium_grants where payment_id/.test(l.sql));
  assert.deepEqual(grants.params, ["pay1"]);
  assert.ok(log.indexOf(refund) < log.indexOf(profile));
  assert.equal(audit.length, 1);
  assert.equal(audit[0][0], "staff1");
  assert.equal(audit[0][1], "PAYMENT_REFUND");
  assert.equal(audit[0][4], q); // même transaction que le remboursement
});

test("remboursement d'un dossier refusé : aucun paiement Premium encore payé = rien n'est modifié", async () => {
  const { payments, q, log, audit } = refundSetup(null);
  assert.deepEqual(await payments.refundForRejectedPremium(q, { userId: "u1", requestCreatedAt: CREATED, by: "staff1" }), { refunded: false });
  assert.ok(!log.some((l) => /update ika_/.test(l.sql) || /delete from/.test(l.sql)));
  assert.equal(audit.length, 0);
});

test("remboursement : un paiement jamais appliqué est marqué remboursé sans toucher aux jours Premium", async () => {
  const { payments, q, log } = refundSetup({ ...PAID_PREMIUM, applied_at: null });
  assert.equal((await payments.refundForRejectedPremium(q, { userId: "u1", requestCreatedAt: CREATED, by: "staff1" })).refunded, true);
  assert.ok(log.some((l) => /update ika_payments set status = 'REFUNDED'/.test(l.sql)));
  assert.ok(!log.some((l) => /update ika_profiles/.test(l.sql)));
});

function stepSetup({ refundFails = false } = {}) {
  const steps = [];
  const calls = [];
  const refund = { id: "rf1", request_id: "r1", user_id: "u1", status: "OPEN" };
  const q = async (sql, args = []) => {
    if (/select \* from ika_premium_refunds where id/.test(sql)) return [refund];
    if (/select created_at from ika_premium_requests where id/.test(sql)) return [{ created_at: CREATED }];
    if (/insert into ika_premium_refund_steps/.test(sql)) { steps.push({ step: args[1] }); return [{ step: args[1] }]; }
    if (/select count\(\*\)::int as n from ika_premium_refund_steps/.test(sql)) return [{ n: steps.length }];
    return [];
  };
  const db = { query: q, transaction: async (fn) => fn({ query: q }) };
  const payments = { refundForRejectedPremium: async (tx, args) => { calls.push({ tx, ...args }); if (refundFails) throw new Error("échec remboursement"); return { refunded: true }; } };
  const svc = createPremiumRequests({ db, accounts: {}, notify: async () => {}, superadminSettings: null, moderationAudit: { log: async () => {} }, payments });
  return { svc, calls };
}

test("suivi de remboursement : seule l'étape « Remboursement effectué » retire les jours Premium, dans la même transaction", async () => {
  const { svc, calls } = stepSetup();
  await svc.completeRefundStep("a1", "rf1", 1);
  await svc.completeRefundStep("a1", "rf1", 3);
  assert.equal(calls.length, 0);
  await svc.completeRefundStep("a1", "rf1", 2);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].userId, "u1");
  assert.equal(calls[0].requestCreatedAt, CREATED);
  assert.equal(calls[0].by, "a1");
  assert.equal(typeof calls[0].tx.query, "function");
});

test("suivi de remboursement : si le retrait des jours échoue, l'étape n'est pas validée en silence", async () => {
  const { svc } = stepSetup({ refundFails: true });
  await assert.rejects(svc.completeRefundStep("a1", "rf1", 2), /échec remboursement/);
});

// ---------------------------------------------------------------------------
// 3. Exception « téléphone » : même règle côté serveur et côté écran
// ---------------------------------------------------------------------------

function centerSetup({ staffRole = null, phoneConfirmedForPremium = true, exceptions = [], withRules = true } = {}) {
  const profile = { staff_role: staffRole, premium_until: null, phone_verified_at: null, phone_channel: null, agency_verified_at: null, agency_name: null, full_name: "Awa", display_role: null, account_status: "ACTIVE", title_checked: 0 };
  const db = { query: async (sql) => (/from ika_profiles p where p\.user_id/.test(sql) ? [profile] : []) };
  const ruleExceptions = withRules ? {
    official: async () => ({ ...normalizeRules(null), phoneConfirmedForPremium }),
    activeKeys: async () => new Set(exceptions),
    acquired: async () => null,
  } : undefined;
  return createAdvertiserCenter({ db, accounts: {}, ruleExceptions });
}

test("accès : le numéro est exigé pour demander ou payer le Premium, sauf exception « téléphone » ou règle désactivée", async () => {
  assert.equal((await centerSetup().access("u1")).phoneRequiredForPremium, true);
  assert.equal((await centerSetup({ exceptions: ["phone"] }).access("u1")).phoneRequiredForPremium, false);
  assert.equal((await centerSetup({ exceptions: ["certification"] }).access("u1")).phoneRequiredForPremium, true); // une autre exception ne dispense pas du numéro
  assert.equal((await centerSetup({ phoneConfirmedForPremium: false }).access("u1")).phoneRequiredForPremium, false);
});

test("accès : sans service de règles la règle historique s'applique ; le Super Administrateur n'est jamais bloqué", async () => {
  assert.equal((await centerSetup({ withRules: false }).access("u1")).phoneRequiredForPremium, true);
  assert.equal((await centerSetup({ staffRole: "SUPERADMIN" }).access("u1")).phoneRequiredForPremium, false);
});

test("l'exception « téléphone » ne dispense pas du numéro pour ouvrir le centre : l'ouverture suit la règle de certification", async () => {
  const access = await centerSetup({ exceptions: ["phone"] }).access("u1");
  assert.equal(access.phoneRequiredForPremium, false);
  assert.equal(access.phoneVerified, false);
  assert.equal(access.eligible, false);
});

function checkoutSetup(phoneRequired) {
  const query = async (sql, params = []) => {
    if (/from ika_offers where code/.test(sql)) return [{ code: "PREMIUM_30", label: "Premium, 30 jours", days: 30, price_xof: 5000, kind: "PREMIUM" }];
    if (/select user_id from ika_profiles/.test(sql)) return [{ user_id: "u1" }];
    if (/insert into ika_payments/.test(sql)) return [];
    if (/from ika_users u left join/.test(sql)) return [{ name: "Awa", email: "a@x.ml", phone: "70000000" }];
    if (/select \* from ika_payments where id/.test(sql)) return [{ id: params[0], kind: "PREMIUM", status: "PENDING", days: 30, amount_xof: 5000 }];
    return [];
  };
  const db = { query, transaction: (fn) => fn({ query }) };
  const accounts = { requireActive: async () => {}, requireVerifiedPhone: async () => { throw new Error("Numéro à confirmer"); }, audit: async () => {} };
  return createPayments({ db }, accounts, createFakeProvider({ secret: "s" }), null, null, phoneRequired);
}

test("paiement Premium : numéro non confirmé accepté si une exception dispense le compte, refusé sinon", async () => {
  const dispensed = await checkoutSetup(async () => false).checkout("u1", { offerCode: "PREMIUM_30" });
  assert.equal(dispensed.payment.kind, "PREMIUM");
  await assert.rejects(checkoutSetup(async () => true).checkout("u1", { offerCode: "PREMIUM_30" }), /Numéro à confirmer/);
});

// ---------------------------------------------------------------------------
// Bonus : prix des formules compatibles avec CinetPay
// ---------------------------------------------------------------------------

function offerSetup(providerName) {
  const query = async (sql) => (/update ika_offers/.test(sql) ? [{ code: "PREMIUM_30" }] : []);
  const db = { query, transaction: (fn) => fn({ query }) };
  const accounts = { requirePermission: async () => {}, audit: async () => {} };
  return createPayments({ db }, accounts, { ...createFakeProvider({ secret: "s" }), name: providerName });
}

test("prix d'une formule : CinetPay n'accepte que les multiples de 5 FCFA, les autres fournisseurs ne sont pas limités", async () => {
  await assert.rejects(offerSetup("cinetpay").setOffer("s1", "PREMIUM_30", { priceXof: 4999, active: true }), /multiples de 5/);
  assert.deepEqual(await offerSetup("cinetpay").setOffer("s1", "PREMIUM_30", { priceXof: 5000, active: true }), { ok: true });
  assert.deepEqual(await offerSetup("paydunya").setOffer("s1", "PREMIUM_30", { priceXof: 4999, active: true }), { ok: true });
});
