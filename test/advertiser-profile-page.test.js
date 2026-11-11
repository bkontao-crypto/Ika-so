// Profil public annonceur : une présentation pour une agence, une autre pour un particulier, et jamais de rubrique inventée.
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { installDom, allText } from "./helpers/fake-dom.mjs";

register("./helpers/public-resolver.mjs", import.meta.url);
const app = installDom();
const { S } = await import("/js/core/state.js");
const mod = await import("/js/pages/advertiser.js");

const base = {
  id: "u1", name: "Agence Kanu", displayRole: "Agence", restricted: false, memberSince: "2022-03-01T00:00:00Z", memberDays: 900,
  agencyVerified: true, agencyName: "Agence Kanu", phoneVerifiedBySms: true,
  experience: { listingsEver: 9, listingsNow: 2, closed: 3, titleChecked: 1, contactsReceived: 40 },
  rating: { average: 4.5, count: 2, distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 } },
  trust: { level: "ESTABLISHED", label: "Profil établi", met: 4, total: 5, notice: "Visitez toujours le bien.", criteria: [{ ok: true, label: "Numéro vérifié" }, { ok: false, label: "Avis reçus" }] },
  listings: [{ id: "l1", title: "Villa ACI", category: "Villa", transactionType: "Vente", price: 185000000, neighborhood: "ACI 2000", city: "Bamako", surfaceLabel: "320 m²", imageUrl: "/media/a.jpg", documentVerified: true }],
  profile: { bio: "Nous accompagnons vos projets.", zones: ["ACI 2000"], address: "Rue 12", hours: "Lun-Sam", foundedYear: 2022, contact: { canCall: true, canWhatsapp: false }, coverUrl: null, avatarUrl: null },
  history: { published: 9, rejected: 0, closed: 3 }, best: [], worst: [], viewer: { signedIn: false, canReview: false, reason: "", mine: null },
};
const serve = (data) => { globalThis.fetch = async (url) => ({ ok: true, status: 200, json: async () => (String(url).includes("/reviews") ? [] : data) }); };

test("agence : en-tête, onglets et colonne de présentation", async () => {
  serve(base); S.user = null;
  await mod.advertiserPage("u1");
  const t = allText(app);
  assert.match(t, /Agence Kanu/); assert.match(t, /Agence vérifiée/); assert.match(t, /Agence immobilière/);
  assert.match(t, /À propos/); assert.match(t, /Contacter l'agence/);
  assert.match(t, /Annonces immobilières \(1\)/); assert.match(t, /185/);
  assert.match(t, /Spécialités/); assert.match(t, /Vente/);
  assert.doesNotMatch(t, /Équipe & collaborateurs/, "aucun panneau Équipe sans donnée réelle (l'onglet reste, le panneau n'est pas ouvert)");
  assert.ok(app.children[0].className.includes("pa-agency") || app.children[0].tag === "div");
});

test("particulier : présentation de la personne, sans mention d'agence", async () => {
  serve({ ...base, name: "Awa Traoré", displayRole: "Particulier", agencyVerified: false, agencyName: null, phoneVerifiedBySms: false,
    profile: { bio: "", zones: [], contact: { canCall: false, canWhatsapp: false, needsLogin: true } }, listings: [], rating: { average: 0, count: 0, distribution: {} } });
  await mod.advertiserPage("u2");
  const t = allText(app);
  assert.match(t, /Awa Traoré/); assert.match(t, /Particulier/); assert.match(t, /Contacter l'annonceur/);
  assert.match(t, /Aucune annonce en ligne/); assert.match(t, /pas encore d'avis/);
  assert.doesNotMatch(t, /Agence vérifiée|À propos de l'agence/);
  assert.match(t, /n'affiche pas son numéro/);
});

test("son propre profil : bouton de modification, pas de formulaire de contact", async () => {
  serve({ ...base, viewer: { signedIn: true, self: true, canReview: false, reason: "", mine: null } });
  await mod.advertiserPage("u1");
  const t = allText(app);
  assert.match(t, /Modifier mon profil/); assert.doesNotMatch(t, /Contacter l'agence/);
});
