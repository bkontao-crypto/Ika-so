// Règles métier pures (server/lib/rules.js) : rôles, codes SMS, téléphones, validation d'annonce, photos.
import test from "node:test";
import assert from "node:assert/strict";
import { assertCanSanction, assertStaffRoleChange, otpRequestAllowed, isSmsVerified, normalizePhone, validateListing, statusAfterOwnerEdit, assertDecision, assertSanction, canBeFeatured, assertImageUrl, assertPhotoList, formatPrice, pricePerSquareMeter, assertFeaturedCap } from "../server/lib/rules.js";

test("sanctions : modérateur restreint, seul un administrateur bannit, jamais un rang égal ou supérieur", () => {
  assert.throws(() => assertCanSanction("USER", "USER", "RESTRICTED"), /Réservé/);
  assert.throws(() => assertCanSanction("MODERATOR", "USER", "BANNED"), /administrateur/);
  assert.throws(() => assertCanSanction("ADMIN", "ADMIN", "RESTRICTED"), /rang égal/);
  assert.doesNotThrow(() => assertCanSanction("MODERATOR", "USER", "RESTRICTED"));
  assert.doesNotThrow(() => assertCanSanction("ADMIN", "MODERATOR", "BANNED"));
});

test("changement de rôle : super administrateur seulement, rôle connu", () => {
  assert.throws(() => assertStaffRoleChange("ADMIN", "MODERATOR"), /super administrateur/);
  assert.throws(() => assertStaffRoleChange("SUPERADMIN", "ROOT"), /inconnu/);
  assert.doesNotThrow(() => assertStaffRoleChange("SUPERADMIN", "ADMIN"));
});

test("codes SMS : 1 toutes les 30 s, 5 par heure ; seul le canal SMS donne le badge", () => {
  assert.equal(otpRequestAllowed(0, null, 1000).ok, true);
  assert.equal(otpRequestAllowed(5, null, 1000).ok, false);
  assert.equal(otpRequestAllowed(1, 1000, 20_000).ok, false);
  assert.equal(otpRequestAllowed(1, 1000, 31_001).ok, true);
  assert.equal(isSmsVerified("SMS"), true);
  assert.equal(isSmsVerified("DEMO"), false);
});

test("numéros maliens : 8 chiffres, 223…, 00223…, +223… ; le reste est refusé", () => {
  assert.equal(normalizePhone("70 12 34 56"), "+22370123456");
  assert.equal(normalizePhone("22370123456"), "+22370123456");
  assert.equal(normalizePhone("0022370123456"), "+22370123456");
  assert.equal(normalizePhone("+223 70 12 34 56"), "+22370123456");
  assert.equal(normalizePhone("+22370123"), null);
  assert.equal(normalizePhone("1234"), null);
  assert.equal(normalizePhone(70123456), null);
  assert.equal(normalizePhone("+33612345678"), "+33612345678");
});

const terrain = { title: "Terrain à ACI 2000", description: "Terrain plat de 300 m² près de la route goudronnée.", category: "Terrain", transactionType: "Vente", price: 15_000_000, surfaceM2: 300, neighborhood: "ACI 2000", surfaceLabel: "300 m²", roadAccess: "Goudronné", declaredDocument: "Titre Foncier", bedrooms: null, bathrooms: null, furnished: null };
const maison = { ...terrain, title: "Maison à Badalabougou", category: "Maison", surfaceM2: null, roadAccess: null, bedrooms: 3, bathrooms: 2, furnished: false, declaredDocument: "Bail", transactionType: "Location", price: 250_000 };

test("annonce : terrain et logement valides ne produisent aucune erreur", () => {
  assert.deepEqual(validateListing(terrain), []);
  assert.deepEqual(validateListing(maison), []);
});

test("annonce : un terrain exige accès routier, document et superficie", () => {
  const errors = validateListing({ ...terrain, roadAccess: null, declaredDocument: null, surfaceM2: null });
  assert.equal(errors.filter((e) => /terrain/.test(e)).length, 3);
});

test("annonce : un logement exige chambres, salles de bain, meublé, document", () => {
  const errors = validateListing({ ...maison, bedrooms: null, bathrooms: null, furnished: null, declaredDocument: null });
  assert.equal(errors.length, 4);
});

test("annonce : titre, description, prix et catégorie hors limites sont refusés", () => {
  const errors = validateListing({ ...terrain, title: "abc", description: "court", price: 0, category: "Château", transactionType: "Troc" });
  assert.ok(errors.length >= 5);
  assert.ok(validateListing({ ...terrain, price: 12.5 }).some((e) => /entier/.test(e)));
});

test("prix au m² : seulement pour un terrain avec superficie", () => {
  assert.equal(pricePerSquareMeter(15_000_000, 300, "Terrain"), 50_000);
  assert.equal(pricePerSquareMeter(15_000_000, 300, "Maison"), null);
  assert.equal(pricePerSquareMeter(15_000_000, 0, "Terrain"), null);
});

test("modification par le propriétaire : une annonce publiée repasse en contrôle", () => {
  assert.equal(statusAfterOwnerEdit("PUBLISHED"), "PENDING");
  assert.equal(statusAfterOwnerEdit("PUBLISHED", false), "PUBLISHED");
  assert.equal(statusAfterOwnerEdit("REJECTED"), "PENDING");
  assert.equal(statusAfterOwnerEdit("DRAFT"), "DRAFT");
});

test("décisions et sanctions : motif obligatoire pour refuser ou sanctionner", () => {
  assert.throws(() => assertDecision("REJECT", " "), /motif/);
  assert.throws(() => assertDecision("MAYBE", ""), /inconnue/);
  assert.doesNotThrow(() => assertDecision("APPROVE", ""));
  assert.throws(() => assertSanction("BANNED", ""), /motif/);
  assert.doesNotThrow(() => assertSanction("ACTIVE", ""));
  assert.throws(() => assertSanction("FOO", "x"), /inconnu/);
});

test("mise à la une : annonce publiée et visibilité normale ; plafond respecté", () => {
  assert.equal(canBeFeatured("PUBLISHED", "NORMAL"), true);
  assert.equal(canBeFeatured("PENDING", "NORMAL"), false);
  assert.equal(canBeFeatured("PUBLISHED", "HIDDEN"), false);
  assert.throws(() => assertFeaturedCap(3, 3), /Maximum/);
  assert.doesNotThrow(() => assertFeaturedCap(2, 3));
});

test("photos : chemins internes et data-URL image acceptés, adresses externes refusées", () => {
  assert.equal(assertImageUrl("/media/villa-badala.jpg"), "/media/villa-badala.jpg");
  assert.doesNotThrow(() => assertImageUrl("/api/media/123e4567-e89b-42d3-a456-426614174000"));
  assert.doesNotThrow(() => assertImageUrl("data:image/png;base64,AAAA"));
  assert.throws(() => assertImageUrl("https://evil.example/x.jpg"), /Photo refusée/);
  assert.throws(() => assertImageUrl("/media/../../etc/passwd"), /Photo refusée/);
  assert.throws(() => assertImageUrl("data:image/svg+xml;base64,AAAA"), /Photo refusée/);
  assert.deepEqual(assertPhotoList([" /media/a.jpg ", ""]), ["/media/a.jpg"]);
  assert.throws(() => assertPhotoList([]), /entre 1 et 5/);
  assert.throws(() => assertPhotoList(Array(6).fill("/media/a.jpg")), /entre 1 et 5/);
});

test("prix affiché en FCFA, « / mois » pour une location", () => {
  assert.match(formatPrice(250000, "Location"), /FCFA \/ mois$/);
  assert.match(formatPrice(250000, "Vente"), /FCFA$/);
});

const local = { ...terrain, title: "Boutique à Hamdallaye", category: "Local commercial", transactionType: "Location", price: 450_000, surfaceM2: 40, surfaceLabel: "40 m²", roadAccess: null, bedrooms: null, bathrooms: null, furnished: null, declaredDocument: "Bail" };
const bureau = { ...local, title: "Bureaux à l'ACI 2000", category: "Bureau", surfaceM2: 120, surfaceLabel: "120 m²" };

test("annonce : local commercial et bureau valides sans chambres ni salles de bain", () => {
  assert.deepEqual(validateListing(local), []);
  assert.deepEqual(validateListing(bureau), []);
});

test("annonce : local commercial et bureau exigent superficie en m² et document", () => {
  const errors = validateListing({ ...bureau, surfaceM2: null, declaredDocument: null });
  assert.equal(errors.length, 2);
  assert.ok(errors.every((e) => /local commercial ou un bureau/.test(e)));
});

test("catégories : familles terrain / logement / professionnel", async () => {
  const { CATEGORIES, isLand, isDwelling, isProfessional } = await import("../server/lib/rules.js");
  assert.ok(CATEGORIES.includes("Local commercial") && CATEGORIES.includes("Bureau"));
  assert.ok(isLand("Terrain") && !isLand("Bureau"));
  assert.ok(isDwelling("Studio") && !isDwelling("Local commercial"));
  assert.ok(isProfessional("Bureau") && isProfessional("Local commercial") && !isProfessional("Maison"));
  assert.equal(CATEGORIES.every((c) => isLand(c) || isDwelling(c) || isProfessional(c)), true);
});
