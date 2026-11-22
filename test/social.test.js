import test from "node:test";
import assert from "node:assert/strict";
import { createSocial } from "../server/services/social.js";

function mk({ target = true, liked = false } = {}) {
  const calls = [], notes = [];
  const db = { query: async (sql, a = []) => {
    calls.push(sql);
    if (/from ika_listings where id/.test(sql) || /from ika_publications where id/.test(sql) || /from ika_comments where id/.test(sql)) return target ? [{ id: a[0], author: "author", label: "x" }] : [];
    if (/delete from ika_likes/.test(sql)) return liked ? [{ 1: 1 }] : [];
    if (/select count\(\*\)::int as n from ika_likes/.test(sql)) return [{ n: liked ? 0 : 1 }];
    return [];
  } };
  const accounts = { ensureProfile: async () => ({ full_name: "Awa", account_status: "ACTIVE" }), assertCanPublish: () => {} };
  return { svc: createSocial({ db, accounts, notify: async (u, n) => notes.push([u, n.kind]) }), calls, notes };
}
test("j'aime : ajoute puis retire ; cible inconnue refusée ; type inconnu refusé", async () => {
  assert.deepEqual(await mk().svc.toggleLike("u1", "PUBLICATION", "p1"), { liked: true, likes: 1 });
  assert.deepEqual(await mk({ liked: true }).svc.toggleLike("u1", "COMMENT", "c1"), { liked: false, likes: 0 });
  await assert.rejects(mk({ target: false }).svc.toggleLike("u1", "LISTING", "x"), /introuvable/);
  await assert.rejects(mk().svc.toggleLike("u1", "AUTRE", "x"), /inconnue/);
});
test("commentaire : trop court refusé, on ne commente pas un commentaire, l'auteur est prévenu", async () => {
  const { svc, calls, notes } = mk();
  await assert.rejects(svc.addComment("u1", "PUBLICATION", "p1", "a"), /trop court/);
  await assert.rejects(svc.addComment("u1", "COMMENT", "c1", "bonjour"), /annonce ou une publication/);
  await svc.addComment("u1", "PUBLICATION", "p1", "Très belle maison");
  assert.ok(calls.some((s) => /insert into ika_comments \(id, publication_id/.test(s)));
  assert.deepEqual(notes, [["author", "COMMENT"]]);
  await svc.addComment("u1", "LISTING", "l1", "Prix négociable ?");
  assert.ok(calls.some((s) => /insert into ika_comments \(id, listing_id/.test(s)));
});
