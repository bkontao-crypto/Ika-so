// Réglages de paiement (superadmin) : valeurs par défaut et bornes des durées d'approbation manuelle.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_POLICY, normalizePolicy } from "../server/lib/payment-policy.js";

test("sans réglage : paiement en ligne fermé, approbation manuelle jusqu'à 3 mois", () => {
  assert.deepEqual(normalizePolicy(null), DEFAULT_POLICY);
  assert.deepEqual(normalizePolicy({}), { onlineEnabled: false, manualPremiumMaxMonths: 3 });
});

test("la durée maximale est bornée à 1, 2 ou 3 mois", () => {
  assert.equal(normalizePolicy({ manualPremiumMaxMonths: 1 }).manualPremiumMaxMonths, 1);
  assert.equal(normalizePolicy({ manualPremiumMaxMonths: 2 }).manualPremiumMaxMonths, 2);
  assert.equal(normalizePolicy({ manualPremiumMaxMonths: 12 }).manualPremiumMaxMonths, 3);
  assert.equal(normalizePolicy({ manualPremiumMaxMonths: 0 }).manualPremiumMaxMonths, 3);
  assert.equal(normalizePolicy({ manualPremiumMaxMonths: "abc" }).manualPremiumMaxMonths, 3);
});

test("le paiement en ligne n'est ouvert que si la valeur est exactement true", () => {
  assert.equal(normalizePolicy({ onlineEnabled: true }).onlineEnabled, true);
  assert.equal(normalizePolicy({ onlineEnabled: "true" }).onlineEnabled, false);
  assert.equal(normalizePolicy({ onlineEnabled: 1 }).onlineEnabled, false);
});
