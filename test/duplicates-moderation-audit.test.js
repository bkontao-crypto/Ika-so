// BUG-003 lot 2 : services duplicates et moderation-audit, avec une base simulée (aucune base réelle requise).
import test from "node:test";
import assert from "node:assert/strict";
import { findSimilar, sameOwnerTitle } from "../server/services/duplicates.js";
import { createModerationAudit } from "../server/services/moderation-audit.js";

const fakeDb = (rows = []) => { const calls = []; return { calls, async query(sql, params) { calls.push({ sql, params }); return rows; } }; };

test("findSimilar : prix invalide → aucune requête", async () => {
  for (const price of [0, -5, "abc", undefined]) {
    const db = fakeDb();
    assert.deepEqual(await findSimilar(db, { price }), []);
    assert.equal(db.calls.length, 0, `price=${price}`);
  }
});

test("findSimilar : fourchette ±5 %, exclusion, propriétaire, et filtrage final par surface", async () => {
  const input = { price: 1000, category: "MAISON", transactionType: "SALE", neighborhood: "Badalabougou", surfaceM2: 100 };
  const db = fakeDb([
    { id: "a", ...input, surfaceM2: 102 },
    { id: "b", ...input, surfaceM2: 200 },
    { id: "c", ...input, surfaceM2: null },
  ]);
  assert.deepEqual(await findSimilar(db, input, { excludeId: "x", ownerId: "o1" }), ["a", "c"]);
  assert.deepEqual(db.calls[0].params, ["x", "MAISON", "SALE", "Badalabougou", 950, 1050, "o1"]);
  await findSimilar(db, { ...input, price: 999.5 });
  assert.deepEqual(db.calls[1].params.slice(4), [949, 1050, null]);
  assert.equal(db.calls[1].params[0], "");
});

test("sameOwnerTitle : renvoie l'identifiant ou null", async () => {
  const db = fakeDb([{ id: "L1" }]);
  assert.equal(await sameOwnerTitle(db, "o1", "Villa", "L9"), "L1");
  assert.deepEqual(db.calls[0].params, ["o1", "Villa", "L9"]);
  assert.equal(await sameOwnerTitle(fakeDb([]), "o1", "Villa"), null);
});

test("moderation-audit.log : refuse sans acteur, action ou type ; sérialise les détails", async () => {
  const db = fakeDb([{ id: 7, created_at: "t" }]);
  const audit = createModerationAudit({ db });
  assert.equal(await audit.log("", { action: "A", targetType: "T" }), null);
  assert.equal(await audit.log("u", { targetType: "T" }), null);
  assert.equal(await audit.log("u", { action: "A" }), null);
  assert.equal(db.calls.length, 0);
  assert.deepEqual(await audit.log("u", { action: "A", targetType: "T", details: { k: 1 } }), { id: 7, created_at: "t" });
  assert.deepEqual(db.calls[0].params, ["u", "A", "T", null, '{"k":1}']);
  await audit.log("u", { action: "A", targetType: "T", targetId: "z" });
  assert.deepEqual(db.calls[1].params, ["u", "A", "T", "z", null]);
  assert.equal(await createModerationAudit({ db: fakeDb([]) }).log("u", { action: "A", targetType: "T" }), null);
});

test("moderation-audit.list : filtres, bornes limit/offset", async () => {
  const db = fakeDb([]);
  const audit = createModerationAudit({ db });
  await audit.list();
  assert.doesNotMatch(db.calls[0].sql, /where/);
  assert.deepEqual(db.calls[0].params, [50, 0]);
  await audit.list({ targetType: "LISTING", targetId: "l1", actorId: "u1", limit: 9999, offset: -3 });
  assert.match(db.calls[1].sql, /where target_type = \$1 and target_id = \$2 and actor_id = \$3/);
  assert.match(db.calls[1].sql, /limit \$4 offset \$5/);
  assert.deepEqual(db.calls[1].params, ["LISTING", "l1", "u1", 200, 0]);
  await audit.list({ limit: 0 });
  assert.deepEqual(db.calls[2].params, [1, 0]);
});
