// Coupures CRM et Premium : contrôle serveur, vérifié sur PostgreSQL + Express réels.
// Base dédiée (créée puis supprimée) : le réglage est global et ne doit pas gêner les tests lancés en parallèle.
import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";

const url = process.env.DATABASE_URL_TEST;
const skip = url ? false : "DATABASE_URL_TEST absent : test d'intégration PostgreSQL ignoré.";

test("Coupures CRM et Premium : ouvertes par défaut, fermées côté serveur, données et suivi conservés", { skip }, async () => {
  assert.match(new URL(url).pathname, /test/i);
  const { createDb } = await import("../server/db.js");
  const { migrate } = await import("../server/migrate.js");
  const { createApp } = await import("../server/app.js");
  const { getConfig } = await import("../server/config.js");
  const { createServices } = await import("../server/services/index.js");
  const name = `ika_test_modules_${process.pid}`;
  const admin = createDb(url);
  await admin.query(`create database ${name}`);
  const target = new URL(url); target.pathname = `/${name}`;
  const db = createDb(target.href);
  let server;
  try {
    await migrate(db, () => {});
    const config = getConfig({ NODE_ENV: "test", DATABASE_URL: target.href, BOOTSTRAP_ADMIN: "true", PAYMENT_PROVIDER: "fake", PAYMENT_WEBHOOK_SECRET: "essai" });
    const app = createApp({ services: createServices({ db, config, sendSms: async () => ({}) }), config, health: () => db.query("select 1") });
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const call = async (cookie, path, method = "GET", body) => {
      const r = await fetch(base + path, { method, headers: { cookie, ...(body ? { "content-type": "application/json" } : {}) }, body: body && JSON.stringify(body) });
      const type = r.headers.get("content-type") ?? "";
      return { status: r.status, body: type.includes("json") ? await r.json() : await r.text(), cookie: r.headers.get("set-cookie")?.split(";")[0] };
    };
    const register = async (who) => {
      const r = await call("", "/auth/register", "POST", { name: `Essai ${who}`, email: `${who}@test.local`, password: "MotDePasse-Test-1", acceptTerms: true, dataConsent: "essential" });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      const [row] = await db.query("select id from ika_users where email = $1", [`${who}@test.local`]);
      return { cookie: r.cookie, id: row.id };
    };
    const boss = await register("patron");
    const user = await register("membre");
    const payer = await register("payeur");
    const waiting = await register("attente");

    const setModules = async (modules) => assert.equal((await call(boss.cookie, "/staff/superadmin-settings/main", "PUT", { value: { modules } })).status, 200);
    const rules = (await call(boss.cookie, "/staff/rules")).body.rules;
    assert.equal((await call(boss.cookie, "/staff/rules", "PUT", { value: { ...rules, phoneConfirmedForPremium: false } })).status, 200);
    const request = { months: 1, accountType: "INDIVIDUAL", phone: "76000000", acceptTerms: true };

    // Par défaut (aucun réglage) : tout est ouvert.
    assert.equal((await call(user.cookie, "/me/crm/stats")).status, 200);
    assert.equal((await call(user.cookie, "/me/center/access")).body.moduleOpen, true);
    const lead = await call(user.cookie, "/me/crm/leads", "POST", { contactName: "Lead conservé" });
    assert.equal(lead.status, 201);
    const pending = await call(waiting.cookie, "/premium/requests", "POST", request);
    assert.equal(pending.status, 201, JSON.stringify(pending.body));

    await db.query("update ika_offers set active = true, price_xof = 1000");
    assert.equal((await call(boss.cookie, "/staff/superadmin-settings/payments_policy", "PUT", { value: { onlineEnabled: true } })).status, 200);
    const offers = (await call(user.cookie, "/offers")).body.offers;
    const premiumOffer = offers.find((o) => o.kind === "PREMIUM");
    const boost = offers.find((o) => o.kind === "BOOST");
    assert.ok(premiumOffer && boost);
    // Un client a payé avant la coupure.
    await db.query("update ika_profiles set premium_until = now() + interval '20 days' where user_id = $1", [payer.id]);
    await db.query("insert into ika_payments (id, user_id, offer_code, kind, amount_xof, days, provider, status, paid_at, applied_at) values ('pay_essai', $1, $2, 'PREMIUM', 1000, 30, 'fake', 'PAID', now(), now())", [payer.id, premiumOffer.code]);

    await setModules({ crm: false, premium: false });

    // CRM fermé, pour le Super Administrateur aussi, quelle que soit l'écriture du chemin.
    const crmRoutes = [["/me/crm/insights"], ["/me/crm/stats"], ["/me/crm/leads"], ["/me/crm/leads.pdf"], [`/me/crm/leads/${lead.body.id}`], ["/ME/CRM/stats"],
      ["/me/crm/leads", "POST", { contactName: "Refusé" }], [`/me/crm/leads/${lead.body.id}`, "PUT", { status: "WON" }], ["/me/crm/remind-hot", "POST", {}],
      [`/me/crm/leads/${lead.body.id}/whatsapp`, "POST", { text: "x" }], [`/me/crm/leads/${lead.body.id}/whatsapp-template`, "POST", { template: "x" }], ["/me/whatsapp/templates"]];
    for (const who of [user, boss]) for (const [path, method, body] of crmRoutes) {
      const r = await call(who.cookie, path, method, body);
      assert.equal(r.status, 403, `${method ?? "GET"} ${path} → ${r.status}`);
      assert.match(r.body.error, /CRM est désactivé/);
    }
    // Premium fermé : centre, demande, achat.
    for (const path of ["/me/center", "/me/center/", "/me/center/map"]) assert.equal((await call(boss.cookie, path)).status, 403, path);
    const refused = await call(user.cookie, "/premium/requests", "POST", request);
    assert.equal(refused.status, 403);
    assert.match(refused.body.error, /Premium est désactivée/);
    const buy = await call(user.cookie, "/payments/checkout", "POST", { offerCode: premiumOffer.code });
    assert.equal(buy.status, 403);
    assert.match(buy.body.error, /Premium est désactivée/);
    const open = (await call(user.cookie, "/offers")).body.offers;
    assert.ok(open.every((o) => o.kind !== "PREMIUM"));
    assert.ok(open.some((o) => o.code === boost.code), "la mise à la une reste proposée");
    const boosted = await call(user.cookie, "/payments/checkout", "POST", { offerCode: boost.code, listingId: "inexistante" });
    assert.equal(boosted.status, 404, "la mise à la une n'est pas coupée par le module Premium");

    // Restent ouverts.
    assert.equal((await call(user.cookie, "/me/center/access")).body.moduleOpen, false);
    assert.equal((await call(user.cookie, "/me/center/standard")).status, 200);
    assert.equal((await call(payer.cookie, "/me/payments")).body.length, 1);
    assert.equal((await call(waiting.cookie, "/premium/requests/mine")).body.request.status, "PENDING");
    assert.equal((await call(waiting.cookie, `/premium/requests/${pending.body.id}/cancel`, "POST", {})).status, 200);
    assert.equal((await call(boss.cookie, "/staff/premium-requests")).status, 200);
    assert.equal((await call(user.cookie, "/premium/click", "POST", { from: "partenaires" })).status, 204);
    // Le client qui a déjà payé peut déposer son dossier ; ses droits ne bougent pas.
    const owed = await call(payer.cookie, "/premium/requests", "POST", request);
    assert.equal(owed.status, 201, JSON.stringify(owed.body));
    const [dossier] = await db.query("select paid from ika_premium_requests where id = $1", [owed.body.id]);
    assert.equal(dossier.paid, true);
    assert.equal((await call(payer.cookie, "/me/center/access")).body.premium, true);

    // Coupures indépendantes, puis réouverture : les données sont intactes.
    await setModules({ crm: true, premium: false });
    assert.equal((await call(user.cookie, "/me/crm/stats")).status, 200);
    assert.equal((await call(boss.cookie, "/me/center")).status, 403);
    await setModules({ crm: false, premium: true });
    assert.equal((await call(user.cookie, "/me/crm/stats")).status, 403);
    assert.equal((await call(boss.cookie, "/me/center")).status, 200);
    await setModules({ crm: true, premium: true });
    const back = await call(user.cookie, `/me/crm/leads/${lead.body.id}`);
    assert.equal(back.body.contact_name, "Lead conservé");
    assert.equal(back.body.status, "NEW");
    assert.equal((await db.query("select count(*)::int as n from ika_crm_leads"))[0].n, 1);
  } finally {
    server?.closeAllConnections?.();
    server?.close();
    await db.close();
    // Pas de « with (force) » : couper une connexion en cours de fermeture lève une erreur asynchrone. On attend qu'elles soient parties.
    for (let essai = 0; ; essai += 1) {
      try { await admin.query(`drop database if exists ${name}`); break; } catch (error) {
        if (essai >= 50) throw error;
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    await admin.close();
  }
});
