// Découvrir : favoris de publications (menu « ⋯ ») et marque `faved` du fil.
import test from "node:test";
import assert from "node:assert/strict";
import { createDiscover } from "../server/services/discover.js";
import { normalizeRules, DEFAULT_RULES } from "../server/lib/account-rules.js";

function world() {
  const favs = new Set();
  const q = async (sql, args = []) => {
    if (/select id from ika_publications where id/.test(sql)) return args[0] === "p1" ? [{ id: "p1" }] : [];
    if (/delete from ika_publication_favorites/.test(sql)) return favs.delete(`${args[0]}:${args[1]}`) ? [{ publication_id: args[1] }] : [];
    if (/insert into ika_publication_favorites/.test(sql)) { favs.add(`${args[0]}:${args[1]}`); return []; }
    if (/select publication_id from ika_publication_favorites/.test(sql)) return args[1].filter((id) => favs.has(`${args[0]}:${id}`)).map((id) => ({ publication_id: id }));
    if (/from ika_publication_favorites f join ika_publications/.test(sql)) return [...favs].filter((k) => k.startsWith(`${args[0]}:`)).map((k) => ({ id: k.split(":")[1], user_id: "a", content: "Texte", kind: "ACTUALITE", status: "PUBLISHED", created_at: new Date(), name: "Auteur", photos: [] }));
    return [];
  };
  const accounts = { requireActive: async () => ({}) };
  const d = createDiscover({ db: { query: q }, accounts, rules: { official: async () => normalizeRules({ ...DEFAULT_RULES }) }, engagement: {}, moderationAudit: {} });
  return { d, favs };
}

test("favori : ajout puis retrait au second appel", async () => {
  const { d, favs } = world();
  assert.deepEqual(await d.toggleFavorite("u1", "p1"), { on: true });
  assert.ok(favs.has("u1:p1"));
  assert.deepEqual(await d.toggleFavorite("u1", "p1"), { on: false });
  assert.equal(favs.size, 0);
});

test("favori : publication inconnue refusée", async () => {
  await assert.rejects(() => world().d.toggleFavorite("u1", "nope"), /introuvable/i);
});

test("favoris : la liste du membre est marquée faved", async () => {
  const { d } = world();
  await d.toggleFavorite("u1", "p1");
  const list = await d.listFavorites("u1");
  assert.equal(list.length, 1);
  assert.equal(list[0].faved, true);
  assert.deepEqual(await d.listFavorites("u2"), []);
});
