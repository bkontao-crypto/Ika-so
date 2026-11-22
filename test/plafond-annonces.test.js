// Plafond d'annonces actives par type de compte : réglage du superadmin, 0 = illimité, personnel exempté.
import test from "node:test";
import assert from "node:assert/strict";
import { createListings } from "../server/services/listings.js";

const input = { title: "Terrain à ACI 2000", description: "Terrain plat de 300 m² près de la route goudronnée.", category: "Terrain", transactionType: "Vente", price: 15_000_000, surfaceM2: 300, neighborhood: "ACI 2000", surfaceLabel: "300 m²", roadAccess: "Goudronné", declaredDocument: "Titre Foncier", imageUrls: ["/media/a.jpg"] };
function mk({ cap, used, role = "USER" }) {
  const db = { query: async (sql) => { if (/count\(\*\)::int as n from ika_listings where owner_id/.test(sql)) return [{ n: used }]; throw new Error("STOP_APRES_PLAFOND"); } };
  const accounts = { assertCanPublishListing: async () => ({ staff_role: role, phone_verified_at: new Date(), phone: "+22376000000" }) };
  const svc = createListings({ db }, accounts, { assertNotBlacklisted: async () => {} }, async () => cap);
  return svc;
}
test("plafond atteint : l'annonce est refusée avec un message clair", async () => {
  await assert.rejects(mk({ cap: 3, used: 3 }).create("u1", input), /Plafond atteint : 3 annonces/);
});
test("sous le plafond, 0 (illimité) ou personnel : le contrôle de plafond ne bloque pas", async () => {
  for (const o of [{ cap: 3, used: 2 }, { cap: 0, used: 99 }, { cap: 1, used: 5, role: "ADMIN" }]) {
    await assert.rejects(mk(o).create("u1", input), (e) => !/Plafond atteint/.test(String(e.message)));
  }
});
