// Interrupteurs commentaires, avis et messagerie : seules la publication et l'envoi sont fermés, côté serveur.
// Base dédiée (créée puis supprimée) : le réglage est global et ne doit pas gêner les tests lancés en parallèle.
import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";

const url = process.env.DATABASE_URL_TEST;
const skip = url ? false : "DATABASE_URL_TEST absent : test d'intégration PostgreSQL ignoré.";

test("Commentaires, avis, messagerie : activés par défaut, écritures fermées côté serveur, lecture, retrait et modération conservés", { skip }, async () => {
  assert.match(new URL(url).pathname, /test/i);
  const { createDb } = await import("../server/db.js");
  const { migrate } = await import("../server/migrate.js");
  const { createApp } = await import("../server/app.js");
  const { getConfig } = await import("../server/config.js");
  const { createServices } = await import("../server/services/index.js");
  const name = `ika_test_communaute_${process.pid}`;
  const admin = createDb(url);
  await admin.query(`create database ${name}`);
  const target = new URL(url); target.pathname = `/${name}`;
  const db = createDb(target.href);
  let server;
  try {
    await migrate(db, () => {});
    const config = getConfig({ NODE_ENV: "test", DATABASE_URL: target.href, BOOTSTRAP_ADMIN: "true" });
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
    const seller = await register("vendeur");
    const buyer = await register("acheteur");
    await db.query("insert into ika_listings (id, owner_id, title, category, transaction_type, price, neighborhood, surface_label, description, image_url, owner_name, owner_phone, owner_role, status) values ('lst_essai', $1, 'Maison essai', 'Maison', 'Vente', 1000000, 'ACI 2000', '200 m²', 'Annonce d''essai', '/media/essai.jpg', 'Essai vendeur', '76000000', 'Propriétaire', 'PUBLISHED')", [seller.id]);
    await db.query("insert into ika_publications (id, user_id, content, kind) values ('pub_essai', $1, 'Publication d''essai', 'ACTUALITE')", [seller.id]);

    const setModules = async (modules) => assert.equal((await call(boss.cookie, "/staff/superadmin-settings/main", "PUT", { value: { modules } })).status, 200);
    const ok = async (promise, label) => { const r = await promise; assert.ok(r.status >= 200 && r.status < 300, `${label} → ${r.status} ${JSON.stringify(r.body)}`); return r.body; };
    const post = (who, path, body = {}) => call(who.cookie, path, "POST", body);
    const writes = (threadId, reviewId) => ({
      comments: [[buyer, "/listings/lst_essai/comments", { body: "Question sur le bien" }], [buyer, "/social/PUBLICATION/pub_essai/comments", { body: "Très belle publication" }]],
      reviews: [[buyer, `/advertisers/${seller.id}/reviews`, { rating: 4, body: "Bon échange, bien conforme à l'annonce." }], [seller, `/reviews/${reviewId}/reply`, { body: "Merci pour votre retour." }]],
      messaging: [[buyer, "/listings/lst_essai/messages", { body: "Toujours disponible ?" }], [seller, `/me/threads/${threadId}/messages`, { body: "Oui, disponible." }], [buyer, "/discover/pub_essai/contact", { body: "Je suis intéressé." }]],
    });
    const counts = async () => (await db.query("select (select count(*) from ika_comments)::int as comments, (select count(*) from ika_reviews)::int as reviews, (select count(*) from ika_messages)::int as messages, (select string_agg(coalesce(body,'') || coalesce(reply_body,''), '|') from ika_reviews) as textes"))[0];

    // Par défaut (aucun réglage) : tout est ouvert.
    const first = await ok(post(buyer, "/listings/lst_essai/messages", { body: "Bonjour, une visite est-elle possible ?" }), "premier message");
    const threadId = first.threadId;
    await ok(post(buyer, `/advertisers/${seller.id}/reviews`, { rating: 5, body: "Annonceur joignable et honnête." }), "premier avis");
    const [{ id: reviewId }] = await db.query("select id from ika_reviews");
    for (const [key, list] of Object.entries(writes(threadId, reviewId))) for (const [who, path, body] of list) await ok(post(who, path, body), `${key} ouvert ${path}`);
    assert.deepEqual((await call("", "/superadmin-settings/public")).body.modules ?? {}, {});

    // Chaque coupure ne ferme que ses propres écritures, y compris pour le Super Administrateur ; rien n'est écrit.
    for (const closed of ["comments", "reviews", "messaging"]) {
      await setModules({ [closed]: false });
      assert.equal((await call("", "/superadmin-settings/public")).body.modules[closed], false);
      const before = await counts();
      for (const [who, path, body] of writes(threadId, reviewId)[closed]) {
        for (const actor of [who, boss]) {
          const r = await post(actor, path, body);
          assert.equal(r.status, 403, `${closed} ${path} → ${r.status}`);
          assert.match(r.body.error, /désactivé/);
        }
      }
      assert.deepEqual(await counts(), before, `${closed} : aucune écriture`);
      // Témoin : les deux autres familles restent ouvertes.
      const others = writes(threadId, reviewId);
      for (const key of Object.keys(others).filter((k) => k !== closed)) { const [who, path, body] = others[key][0]; await ok(post(who, path, body), `${key} reste ouvert pendant ${closed}`); }
    }

    // Tout coupé : lecture, signalement, blocage, modération et retrait restent possibles, données intactes.
    await setModules({ comments: false, reviews: false, messaging: false });
    const kept = await counts();
    const listed = await ok(call("", "/listings/lst_essai/comments"), "lire les commentaires");
    assert.ok(listed.length >= 1);
    await ok(call("", "/social/PUBLICATION/pub_essai/comments"), "lire les commentaires de publication");
    assert.ok((await ok(call("", `/advertisers/${seller.id}/reviews`), "lire les avis")).length === 1);
    assert.ok((await ok(call(buyer.cookie, `/me/threads/${threadId}`), "lire la conversation")).messages.length >= 2);
    await ok(call(seller.cookie, "/me/threads"), "liste des conversations");
    assert.deepEqual(await counts(), kept);
    const [comment] = await db.query("select id from ika_comments limit 1");
    await ok(post(seller, `/comments/${comment.id}/report`, { reason: "Publicité ou spam" }), "signaler un commentaire");
    await ok(post(seller, `/reviews/${reviewId}/report`, { reason: "Autre" }), "signaler un avis");
    await ok(post(buyer, `/me/threads/${threadId}/report`, { reason: "Autre", details: "Essai de signalement" }), "signaler une personne");
    await ok(post(buyer, `/me/threads/${threadId}/block`), "bloquer");
    await ok(post(buyer, `/me/threads/${threadId}/unblock`), "débloquer");
    await ok(post(boss, `/staff/comments/${comment.id}/hide`, { reason: "Essai de modération" }), "masquer un commentaire");
    await ok(post(seller, `/reviews/${reviewId}/reply/delete`), "retirer sa réponse");
    await ok(post(buyer, `/advertisers/${seller.id}/reviews/delete`), "supprimer son avis");

    // Réouverture : la publication reprend.
    await setModules({ comments: true, reviews: true, messaging: true });
    await ok(post(buyer, "/listings/lst_essai/comments", { body: "De nouveau possible" }), "commentaire après réouverture");
    await ok(post(buyer, `/me/threads/${threadId}/messages`, { body: "De nouveau possible" }), "message après réouverture");
    await ok(post(buyer, `/advertisers/${seller.id}/reviews`, { rating: 3, body: "Nouvel avis après réouverture." }), "avis après réouverture");
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
