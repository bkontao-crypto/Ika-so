// Profil : ville modifiable par tous les rôles, nettoyage, et présence dans la vue publique.
import test from "node:test";
import assert from "node:assert/strict";
import { allowedFields, publicProfileView, sanitizeProfileInput } from "../server/lib/advertiser-profile.js";

test("profil : la ville est modifiable pour tous les types de compte", () => {
  for (const role of ["Propriétaire direct", "Démarcheur mandaté", "Agence immobilière"]) assert.ok(allowedFields(role).has("city"), role);
});

test("profil : la ville est nettoyée, tronquée à 60 caractères et effaçable", () => {
  assert.equal(sanitizeProfileInput({ city: "  Bamako  " }, "Propriétaire direct").city, "Bamako");
  assert.equal(sanitizeProfileInput({ city: "x".repeat(200) }, "Propriétaire direct").city.length, 60);
  assert.equal(sanitizeProfileInput({ city: "   " }, "Propriétaire direct").city, null);
});

test("profil : la vue publique expose la ville", () => {
  assert.equal(publicProfileView({ city: "Kati" }, { agencyVerified: false, signedIn: false, phone: null }).city, "Kati");
  assert.equal(publicProfileView(null, { agencyVerified: false, signedIn: false, phone: null }).city, null);
});
