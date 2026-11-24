// Exactement deux emplacements Superadmin : fausse base, on vérifie la règle et le SQL émis.
import test from "node:test";
import assert from "node:assert/strict";
import { createModeration } from "../server/services/moderation.js";

function fakeDb(handlers = []) {
  const calls = [];
  const query = async (sql, params = []) => {
    calls.push({ sql, params });
    for (const [re, fn] of handlers) if (re.test(sql)) return fn(sql, params);
    return [];
  };
  return { calls, query, transaction: async (fn) => fn({ query }) };
}

function make({ held, targetRole }) {
  const db = fakeDb([
    [/select staff_role, account_status from ika_profiles/, () => [{ staff_role: "SUPERADMIN", account_status: "ACTIVE" }]],
    [/select staff_role from ika_profiles/, () => [{ staff_role: targetRole }]],
    [/count\(\*\)::int as n from ika_profiles where staff_role = 'SUPERADMIN'\s*$/, () => [{ n: held }]],
    [/update ika_profiles set staff_role/, () => [{ user_id: "t1" }]],
    [/account_status = 'ACTIVE'\s*$/, () => [{ n: 2 }]],
  ]);
  const accounts = { requireStaff: async () => ({}), audit: async () => {} };
  return { db, moderation: createModeration({ db }, accounts, {}) };
}
const promoted = (db) => db.calls.some((c) => /update ika_profiles set staff_role/.test(c.sql));

test("deux Superadmin déjà en place : la promotion d'un troisième est refusée", async () => {
  const { db, moderation } = make({ held: 2, targetRole: "ADMIN" });
  await assert.rejects(moderation.setStaffRole("s1", "t1", "SUPERADMIN"), /deux emplacements/);
  assert.equal(promoted(db), false);
});

test("un seul Superadmin en place : le deuxième peut être promu", async () => {
  const { db, moderation } = make({ held: 1, targetRole: "ADMIN" });
  assert.deepEqual(await moderation.setStaffRole("s1", "t1", "SUPERADMIN"), { ok: true });
  assert.equal(promoted(db), true);
});

test("un compte déjà Superadmin garde son emplacement : réattribution acceptée même avec deux titulaires", async () => {
  const { moderation } = make({ held: 2, targetRole: "SUPERADMIN" });
  assert.deepEqual(await moderation.setStaffRole("s1", "t1", "SUPERADMIN"), { ok: true });
});

test("rétrograder ou nommer un autre rôle n'est pas bloqué par le plafond", async () => {
  const { moderation } = make({ held: 2, targetRole: "USER" });
  assert.deepEqual(await moderation.setStaffRole("s1", "t1", "ADMIN"), { ok: true });
});
