// BUG-003 (lot 1) : tests des modules purs de server/lib/ qui n'étaient référencés par aucun test.
// Modules couverts : slug, blacklist, digest, price-history, user-reports, error-sink, permissions, search, drafts, trust.
// Aucun accès à la base ni au réseau : la base et fetch sont remplacés par des doublures.
import test from "node:test";
import assert from "node:assert/strict";

import { slugify, zoneSlug, zoneFromSlug, listingSlug, listingPath } from "../server/lib/slug.js";
import { normalizeBlacklistValue, assertNotBlacklisted } from "../server/lib/blacklist.js";
import { buildDigest, ALERT_MODES, DIGEST_MIN_GAP_MS } from "../server/lib/digest.js";
import { buildPriceHistory } from "../server/lib/price-history.js";
import { buildExcerpt, EXCERPT_MESSAGES, EXCERPT_CHARS } from "../server/lib/user-reports.js";
import { createWebhookSink } from "../server/lib/error-sink.js";
import { ROLE_PERMISSIONS, NON_DELEGABLE, ALL_PERMISSIONS, can, assertCanGrant } from "../server/lib/permissions.js";
import { normalizeText, readSearch, looksLikeSameProperty, matchesSearch, cleanSearchFilters, PAGE_MAX } from "../server/lib/search.js";
import { sanitizeDraft, isEmptyDraft, DRAFT_MAX_PHOTOS } from "../server/lib/drafts.js";
import { parseProofFile, median, priceAnomaly, PROOF_MAX_BYTES } from "../server/lib/trust.js";
import { TRANSACTIONS } from "../server/lib/rules.js";

const dataUrl = (type, size) => `data:${type};base64,${Buffer.alloc(size, 1).toString("base64")}`;

// --- slug ---------------------------------------------------------------------------------------
test("slug : accents, ponctuation et espaces deviennent des tirets propres", () => {
  assert.equal(slugify("Villa à Bamako – ACI 2000 !"), "villa-a-bamako-aci-2000");
  assert.equal(slugify("  --Été--  "), "ete");
  assert.equal(slugify(null), "");
  assert.equal(slugify(undefined), "");
});

test("slug : un quartier se retrouve par son adresse, quels que soient accents et casse", () => {
  const zone = zoneFromSlug("ACI-2000");
  assert.ok(zone, "ACI 2000 doit être retrouvé");
  assert.equal(zoneSlug(zone), "aci-2000");
  assert.equal(zoneFromSlug("quartier-qui-nexiste-pas"), null);
});

test("slug : l'adresse d'une annonce est coupée à 60 caractères, à la limite d'un mot", () => {
  const long = "Magnifique villa moderne avec jardin et garage dans un quartier calme et sécurisé de Bamako";
  const slug = listingSlug(long);
  assert.ok(slug.length <= 60);
  assert.ok(!slug.endsWith("-"));
  assert.ok(slugify(long).startsWith(slug));
  assert.equal(listingSlug("Belle villa"), "belle-villa");
  assert.equal(listingSlug("!!!"), "");
});

test("slug : listingPath encode l'identifiant et accepte un titre vide", () => {
  assert.equal(listingPath({ id: "abc 1", title: "Belle villa" }), "/a/abc%201/belle-villa");
  assert.equal(listingPath({ id: "abc", title: "" }), "/a/abc");
  assert.equal(listingPath({ id: "abc" }), "/a/abc");
});

// --- blacklist ----------------------------------------------------------------------------------
test("blacklist : normalisation d'un e-mail et d'un numéro", () => {
  assert.equal(normalizeBlacklistValue("EMAIL", "  Test@Mail.COM "), "test@mail.com");
  assert.equal(normalizeBlacklistValue("PHONE", "+223 70 12-34 56"), "+22370123456");
  assert.equal(normalizeBlacklistValue("EMAIL", null), "");
});

test("blacklist : valeur absente de la liste = accepté ; valeur listée = refus 403 au message neutre", async () => {
  const seen = [];
  const dbWith = (rows) => ({ query: async (sql, params) => { seen.push(params); return rows; } });

  await assert.doesNotReject(() => assertNotBlacklisted(dbWith([]), "EMAIL", "ok@mail.com"));
  assert.deepEqual(seen[0], ["EMAIL", "ok@mail.com"]);

  await assert.rejects(() => assertNotBlacklisted(dbWith([{}]), "EMAIL", "BAD@mail.com"), (e) => {
    assert.equal(e.status, 403);
    assert.match(e.message, /adresse/);
    return true;
  });
  await assert.rejects(() => assertNotBlacklisted(dbWith([{}]), "PHONE", "+223 70 00 00 00"), (e) => {
    assert.equal(e.status, 403);
    assert.match(e.message, /numéro/);
    return true;
  });
});

test("blacklist : une valeur vide n'interroge pas la base", async () => {
  let called = false;
  await assertNotBlacklisted({ query: async () => { called = true; return [{}]; } }, "EMAIL", "   ");
  assert.equal(called, false);
});

// --- digest -------------------------------------------------------------------------------------
test("digest : constantes et cas sans annonce", () => {
  assert.deepEqual(ALERT_MODES, ["INSTANT", "DAILY"]);
  assert.equal(DIGEST_MIN_GAP_MS, 23 * 3600 * 1000);
  assert.equal(buildDigest([]), null);
});

test("digest : une annonce, trois annonces, plus de trois annonces", () => {
  const item = (n) => ({ id: `id${n}`, title: `Titre ${n}`, neighborhood: "Badalabougou", label: "Ma recherche" });
  const one = buildDigest([item(1)]);
  assert.equal(one.title, "Nouvelle annonce : Titre 1");
  assert.equal(one.link, "#/annonce/id1");
  assert.match(one.body, /Ma recherche.*Badalabougou/);

  const three = buildDigest([item(1), item(2), item(3)]);
  assert.equal(three.title, "3 nouvelles annonces pour vos recherches");
  assert.equal(three.body, "Titre 1 ; Titre 2 ; Titre 3");

  const five = buildDigest([1, 2, 3, 4, 5].map(item));
  assert.equal(five.body, "Titre 1 ; Titre 2 ; Titre 3 et 2 autre(s)");
  assert.equal(five.link, "#/annonce/id1");
});

// --- price-history ------------------------------------------------------------------------------
test("historique de prix : un seul point ne montre rien", () => {
  assert.deepEqual(buildPriceHistory([]), []);
  assert.deepEqual(buildPriceHistory([{ price: 100, recorded_at: "2026-01-01" }]), []);
});

test("historique de prix : variation en FCFA et en % par rapport au point précédent", () => {
  const rows = [
    { price: "110000", recorded_at: new Date("2026-03-01T00:00:00Z") },
    { price: 100000, recorded_at: new Date("2026-02-01T00:00:00Z") },
    { price: 125000, recorded_at: "2026-01-01" },
  ];
  const out = buildPriceHistory(rows);
  assert.equal(out.length, 3);
  assert.equal(out[0].change, 10000);
  assert.equal(out[0].changePercent, 10);
  assert.equal(out[0].at, "2026-03-01T00:00:00.000Z");
  assert.equal(out[1].change, -25000);
  assert.equal(out[1].changePercent, -20);
  assert.deepEqual([out[2].change, out[2].changePercent], [null, null]);
});

test("historique de prix : les prix invalides sont ignorés", () => {
  const rows = [
    { price: 0, recorded_at: "a" }, { price: "abc", recorded_at: "b" },
    { price: 200, recorded_at: "c" }, { price: 100, recorded_at: "d" },
  ];
  const out = buildPriceHistory(rows);
  assert.equal(out.length, 2);
  assert.equal(out[0].changePercent, 100);
});

// --- user-reports -------------------------------------------------------------------------------
test("signalement : l'extrait garde les 10 derniers messages, tronqués, avec qui parle", () => {
  const messages = Array.from({ length: 12 }, (_, i) => ({
    sender_id: i % 2 ? "reported-1" : "reporter-1",
    body: i === 11 ? "x".repeat(EXCERPT_CHARS + 50) : `msg ${i}`,
    created_at: new Date("2026-05-01T10:00:00Z"),
  }));
  const out = buildExcerpt(messages, "reporter-1");
  assert.equal(out.length, EXCERPT_MESSAGES);
  assert.equal(out[0].body, "msg 2");
  assert.equal(out[0].from, "reporter");
  assert.equal(out[1].from, "reported");
  assert.equal(out.at(-1).body.length, EXCERPT_CHARS);
  assert.equal(out[0].at, "2026-05-01T10:00:00.000Z");
});

test("signalement : corps vide ou absent devient une chaîne vide", () => {
  const [m] = buildExcerpt([{ sender_id: "a", body: null, created_at: "2026-05-01" }], "a");
  assert.equal(m.body, "");
  assert.deepEqual(buildExcerpt([], "a"), []);
});

// --- error-sink ---------------------------------------------------------------------------------
test("suivi d'erreurs : sans adresse, aucun envoi", () => {
  assert.equal(createWebhookSink(""), null);
  assert.equal(createWebhookSink(undefined), null);
});

test("suivi d'erreurs : envoi POST en JSON, et une panne du service ne fait jamais tomber le site", async () => {
  const calls = [];
  const sink = createWebhookSink("https://exemple.test/hook", async (url, opts) => { calls.push({ url, opts }); });
  await sink({ level: "error", msg: "boom" });
  assert.equal(calls[0].url, "https://exemple.test/hook");
  assert.equal(calls[0].opts.method, "POST");
  assert.equal(calls[0].opts.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(calls[0].opts.body), { level: "error", msg: "boom" });

  const failing = createWebhookSink("https://exemple.test/hook", async () => { throw new Error("réseau coupé"); });
  await assert.doesNotReject(() => failing({ level: "error" }));
});

// --- permissions --------------------------------------------------------------------------------
test("permissions : la matrice est figée et hiérarchique (MODERATOR ⊂ ADMIN ⊂ SUPERADMIN)", () => {
  assert.ok(Object.isFrozen(ROLE_PERMISSIONS));
  assert.ok(Object.isFrozen(ROLE_PERMISSIONS.ADMIN));
  for (const p of ROLE_PERMISSIONS.MODERATOR) assert.ok(ROLE_PERMISSIONS.ADMIN.includes(p));
  for (const p of ROLE_PERMISSIONS.ADMIN) assert.ok(ROLE_PERMISSIONS.SUPERADMIN.includes(p));
  assert.ok(ROLE_PERMISSIONS.SUPERADMIN.length > ROLE_PERMISSIONS.ADMIN.length);
  assert.ok(ROLE_PERMISSIONS.ADMIN.length > ROLE_PERMISSIONS.MODERATOR.length);
});

test("permissions : refus par défaut selon le rôle", () => {
  assert.equal(can("MODERATOR", "moderation.review"), true);
  assert.equal(can("MODERATOR", "account.ban"), false);
  assert.equal(can("ADMIN", "account.ban"), true);
  assert.equal(can("ADMIN", "premium.decide"), false);
  assert.equal(can("SUPERADMIN", "premium.decide"), true);
  assert.equal(can("MODERATOR", "permission.inexistante"), false);
  assert.equal(can("NI_UN_ROLE", "moderation.review"), false);
});

test("permissions : une permission accordée à titre individuel fonctionne, sauf les non délégables", () => {
  assert.equal(can("MODERATOR", "account.ban", ["account.ban"]), true);
  assert.equal(can("ADMIN", "staff.role_change", ["staff.role_change"]), false);
  assert.equal(can("ADMIN", "permissions.grant", ["permissions.grant"]), false);
  assert.equal(can("MODERATOR", "inconnue", ["inconnue"]), false);
  for (const p of NON_DELEGABLE) assert.ok(ALL_PERMISSIONS.includes(p));
});

// BUG-004 : la doc de can() dit « rôle inconnu : refus » ; une permission accordée individuellement ne doit pas
// ouvrir de droits à un rôle inconnu (ni à un nom hérité de l'objet, comme « constructor »).
test("permissions : un rôle inconnu est refusé même avec une permission accordée", () => {
  assert.equal(can("NI_UN_ROLE", "account.ban", ["account.ban"]), false);
  assert.equal(can("USER", "account.ban", ["account.ban"]), false);
  assert.equal(can(undefined, "account.ban", ["account.ban"]), false);
  assert.equal(can(null, "moderation.review"), false);
  for (const role of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
    assert.equal(can(role, "moderation.review", ["moderation.review"]), false, role);
  }
});

test("permissions : règles d'octroi", () => {
  const ok = { actorId: "s1", actorRole: "SUPERADMIN", targetId: "a1", targetRole: "ADMIN", permission: "account.ban", reason: "Remplacement temporaire" };
  assert.doesNotThrow(() => assertCanGrant(ok));
  assert.throws(() => assertCanGrant({ ...ok, actorRole: "ADMIN" }), /Réservé au super administrateur/);
  assert.throws(() => assertCanGrant({ ...ok, targetId: "s1" }), /s'accorder/);
  assert.throws(() => assertCanGrant({ ...ok, permission: "nimporte.quoi" }), /inconnue/);
  assert.throws(() => assertCanGrant({ ...ok, permission: "staff.role_change" }), /non délégable/);
  assert.throws(() => assertCanGrant({ ...ok, targetRole: "SUPERADMIN" }), /administrateur ou un modérateur/);
  assert.throws(() => assertCanGrant({ ...ok, reason: "   " }), /Motif obligatoire/);
});

// --- search -------------------------------------------------------------------------------------
test("recherche : normalisation sans accents ni espaces superflus", () => {
  assert.equal(normalizeText("  Hamdallaye   ÉCOLE  "), "hamdallaye ecole");
  assert.equal(normalizeText(null), "");
});

test("recherche : valeurs par défaut et tri", () => {
  const d = readSearch();
  assert.equal(d.sort, "recent");
  assert.equal(d.limit, 24);
  assert.equal(d.offset, 0);
  assert.equal(d.maxPrice, null);
  assert.equal(readSearch({ query: "Villa" }).sort, "relevance");
  assert.equal(readSearch({ sort: "relevance" }).sort, "recent");
  assert.equal(readSearch({ sort: "n_importe_quoi" }).sort, "recent");
  assert.equal(readSearch({ sort: "price_asc" }).sort, "price_asc");
});

test("recherche : valeurs bornées et nettoyées", () => {
  assert.equal(readSearch({ limit: 1000 }).limit, PAGE_MAX);
  assert.equal(readSearch({ limit: -5 }).limit, 24);
  assert.equal(readSearch({ offset: 99999999 }).offset, 10_000);
  assert.equal(readSearch({ maxPrice: "abc" }).maxPrice, null);
  assert.equal(readSearch({ maxPrice: "15000000.4" }).maxPrice, 15000000);
  assert.equal(readSearch({ query: "x".repeat(200) }).q.length, 80);
  assert.equal(readSearch({ zone: "z".repeat(500) }).zone.length, 120);
});

test("recherche : deux annonces proches décrivent probablement le même bien", () => {
  const a = { transactionType: "Vente", category: "Villa", neighborhood: "Hamdallaye", price: 50_000_000, surfaceM2: 300 };
  assert.equal(looksLikeSameProperty(a, { ...a, price: 51_500_000, neighborhood: "HAMDALLAYE" }), true);
  assert.equal(looksLikeSameProperty(a, { ...a, price: 60_000_000 }), false);
  assert.equal(looksLikeSameProperty(a, { ...a, transactionType: "Location" }), false);
  assert.equal(looksLikeSameProperty(a, { ...a, category: "Terrain" }), false);
  assert.equal(looksLikeSameProperty(a, { ...a, neighborhood: "Kalaban" }), false);
  assert.equal(looksLikeSameProperty(a, { ...a, surfaceM2: 500 }), false);
  assert.equal(looksLikeSameProperty(a, { ...a, surfaceM2: undefined }), true);
});

test("recherche enregistrée : correspondance avec une annonce", () => {
  const card = { transactionType: "Location", category: "Appartement", neighborhood: "ACI 2000", price: 150_000, surfaceM2: 80, bedrooms: 3, title: "Bel appartement", description: "Proche de l'école, très lumineux" };
  assert.equal(matchesSearch({}, card), true);
  assert.equal(matchesSearch(undefined, card), true);
  assert.equal(matchesSearch({ transaction: "Location", maxPrice: 200_000, minSurface: 60, bedrooms: 2 }, card), true);
  assert.equal(matchesSearch({ transaction: "Vente" }, card), false);
  assert.equal(matchesSearch({ maxPrice: 100_000 }, card), false);
  assert.equal(matchesSearch({ minPrice: 200_000 }, card), false);
  assert.equal(matchesSearch({ minSurface: 100 }, card), false);
  assert.equal(matchesSearch({ bedrooms: 4 }, card), false);
  assert.equal(matchesSearch({ zone: "Kalaban" }, card), false);
  assert.equal(matchesSearch({ q: "ECOLE lumineux" }, card), true, "mots sans accents ni casse, tous requis");
  assert.equal(matchesSearch({ q: "école piscine" }, card), false);
});

test("recherche enregistrée : seuls les filtres connus sont gardés, bornés", () => {
  const out = cleanSearchFilters({ transaction: "Vente", maxPrice: "1000.6", minPrice: -3, injection: "<script>", q: "y".repeat(200), zone: "" });
  assert.deepEqual(Object.keys(out).sort(), ["maxPrice", "q", "transaction"]);
  assert.equal(out.maxPrice, 1001);
  assert.equal(out.q.length, 80);
  assert.deepEqual(cleanSearchFilters(), {});
});

// --- drafts -------------------------------------------------------------------------------------
test("brouillon : liste blanche, champs inconnus et valeurs hors liste retirés", () => {
  const out = sanitizeDraft({
    title: "Terrain à vendre\u0000", description: "d", transaction: "N'importe quoi", category: "Inexistante",
    pirate: "<script>", price: "15 000 000 FCFA", bedrooms: "3 chambres", furnished: "peut-être",
  });
  assert.equal(out.title, "Terrain à vendre");
  assert.equal(out.price, "15000000");
  assert.equal(out.bedrooms, "3");
  assert.ok(!("pirate" in out));
  assert.ok(!("transaction" in out));
  assert.ok(!("category" in out));
  assert.ok(!("furnished" in out));
});

test("brouillon : une valeur valide est conservée, une entrée invalide donne un brouillon vide", () => {
  assert.equal(sanitizeDraft({ transaction: TRANSACTIONS[0] }).transaction, TRANSACTIONS[0]);
  assert.equal(sanitizeDraft({ furnished: "oui" }).furnished, "oui");
  for (const bad of [null, undefined, "texte", 42, [], [1, 2]]) assert.deepEqual(sanitizeDraft(bad), {});
});

test("brouillon : seules les photos du site sont gardées, 10 au plus", () => {
  const photos = [
    "/media/a.jpg", "https://autre-site.test/x.jpg", "/media/../secret", "/media/dossier/b.jpg",
    "data:image/png;base64,AAAA", 42, ...Array.from({ length: 15 }, (_, i) => `/media/p${i}.jpg`),
  ];
  const out = sanitizeDraft({ photos }).photos;
  assert.equal(out.length, DRAFT_MAX_PHOTOS);
  assert.ok(out.every((u) => /^\/media\/[A-Za-z0-9._-]+$/.test(u)));
  assert.ok(!out.includes("/media/../secret"));
  assert.equal(sanitizeDraft({ photos: "pas un tableau" }).photos, undefined);
});

test("brouillon : longueurs bornées et détection d'un brouillon vide", () => {
  const out = sanitizeDraft({ title: "t".repeat(1000), description: "d".repeat(9000), price: "9".repeat(40) });
  assert.equal(out.title.length, 300);
  assert.equal(out.description.length, 4000);
  assert.equal(out.price.length, 15);
  assert.equal(isEmptyDraft({}), true);
  assert.equal(isEmptyDraft({ price: "  " }), true);
  assert.equal(isEmptyDraft({ title: "Un titre" }), false);
  assert.equal(isEmptyDraft({ surfaceM2: "120" }), false);
});

// --- trust (règles pures) -----------------------------------------------------------------------
test("justificatif : formats et tailles acceptés", () => {
  assert.deepEqual(parseProofFile(dataUrl("image/png", 300)), { type: "image/png", bytes: 300 });
  assert.equal(parseProofFile(dataUrl("application/pdf", 1000)).type, "application/pdf");
  assert.equal(parseProofFile(dataUrl("image/jpeg", 301)).bytes, 301, "taille exacte avec remplissage base64 '='");
  assert.equal(parseProofFile(dataUrl("image/webp", 302)).bytes, 302);
});

test("justificatif : fichiers refusés avec un message lisible", () => {
  assert.throws(() => parseProofFile("n'importe quoi"), /illisible/);
  assert.throws(() => parseProofFile(null), /illisible/);
  assert.throws(() => parseProofFile("data:image/png;base64,@@@"), /illisible/);
  assert.throws(() => parseProofFile(dataUrl("image/gif", 500)), /Format refusé/);
  assert.throws(() => parseProofFile(dataUrl("text/html", 500)), /Format refusé/);
  assert.throws(() => parseProofFile(dataUrl("image/png", 50)), /vide/);
  assert.throws(() => parseProofFile(dataUrl("image/png", PROOF_MAX_BYTES + 1000)), /trop lourd/);
});

test("médiane : cas pair, impair, vide, valeurs invalides", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), null);
  assert.equal(median([NaN, Infinity]), null);
  assert.equal(median([5, NaN, 1, 3]), 3);
});

test("prix anormal : seuils à 40 % et 250 % de la médiane, au moins 3 comparables", () => {
  const comparables = [100, 100, 100];
  assert.equal(priceAnomaly(100, comparables), null);
  assert.match(priceAnomaly(30, comparables).label, /inférieur/);
  assert.match(priceAnomaly(300, comparables).label, /supérieur/);
  assert.equal(priceAnomaly(40, comparables), null, "exactement 40 % : pas d'alerte");
  assert.equal(priceAnomaly(250, comparables), null, "exactement 250 % : pas d'alerte");
  assert.equal(priceAnomaly(30, [100, 100]), null, "moins de 3 comparables");
  assert.equal(priceAnomaly(0, comparables), null);
  assert.equal(priceAnomaly(-5, comparables), null);
  assert.equal(priceAnomaly(30, [0, 0, 0]), null, "médiane nulle");
});
