// Le Super Administrateur bénéficie de tous les avantages Premium, sans durée, sans numéro confirmé et sans certification.
import test from "node:test";
import assert from "node:assert/strict";
import { createAdvertiserCenter } from "../server/services/advertiser-center.js";

const center = (row) => createAdvertiserCenter({ db: { query: async () => [row] }, accounts: {}, ruleExceptions: null });
const row = (over = {}) => ({ staff_role: "USER", premium_until: null, phone_verified_at: null, agency_verified_at: null, title_checked: 0, full_name: "Test", display_role: null, account_status: "ACTIVE", ...over });

test("Super Administrateur : accès Premium complet sans abonnement, sans numéro ni certification", async () => {
  const a = await center(row({ staff_role: "SUPERADMIN" })).access("u1");
  assert.equal(a.premium, true);
  assert.equal(a.eligible, true);
  assert.equal(a.unlimited, true);
  assert.equal(a.phoneVerified, true);
  assert.equal(a.certificationOk, true);
  assert.equal(a.premiumUntil, null);
});

test("membre ordinaire sans abonnement : toujours bloqué (pas de régression)", async () => {
  const a = await center(row()).access("u2");
  assert.equal(a.premium, false);
  assert.equal(a.eligible, false);
  assert.notEqual(a.unlimited, true);
});

test("administrateur non superadmin : inchangé", async () => {
  const a = await center(row({ staff_role: "ADMIN" })).access("u3");
  assert.equal(a.eligible, false);
});
