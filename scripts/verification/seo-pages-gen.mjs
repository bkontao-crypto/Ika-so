// Génère, avec le VRAI code de rendu (server/seo), les pages publiques du serveur avec des données factices.
// Usage : node seo-pages-gen.mjs <dossier de sortie>   (utilisé par seo-contrast.py)
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as v from "../../server/seo/render.js";
import { legalPage, LEGAL_PAGES } from "../../server/seo/legal.js";
import { GUIDES } from "../../server/seo/guides.js";

const out = process.argv[2] ?? "pages";
mkdirSync(out, { recursive: true });
const base = "http://x";
const card = (o = {}) => ({ id: "l1", title: "Villa moderne avec piscine", category: "Maison", transactionType: "Vente", price: 150000000, neighborhood: "ACI 2000", city: "Bamako", imageUrl: "/media/villa-badala.jpg", surfaceLabel: "300 m²", featured: true, documentVerified: true, agencyVerified: true, agencyName: "Mali Habitat", phoneVerified: true, ownerName: "Fatoumata Diarra", ownerRole: "Agence", description: "Belle villa proche du fleuve.", roadAccess: "Route goudronnée", bedrooms: 4, bathrooms: 3, furnished: false, declaredDocument: "Titre foncier", photos: ["/media/villa-badala.jpg"], pricePerM2: 500000, ...o });
const zones = ["ACI 2000", "Badalabougou", "Korofina", "Hamdallaye"].map((name, i) => ({ name, count: i === 0 ? 2 : 0 }));
const bench = [{ category: "Terrain", transactionType: "Vente", count: 5, medianPrice: 25000000, low: 12000000, high: 40000000, medianPerM2: 50000 }];
const agency = { id: "a1", name: "Mali Habitat", listings: [card(), card({ id: "l2", featured: false, transactionType: "Location", price: 350000 })], reviews: { average: 4.5, count: 6 } };
const pages = {
  "quartiers": v.zonesIndex({ base, zones }),
  "quartier": v.zonePage({ base, zone: zones[0], data: { listings: [card(), card({ id: "l2", featured: false })], benchmarks: bench } }),
  "quartier-vide": v.zonePage({ base, zone: zones[1], data: { listings: [], benchmarks: [] } }),
  "annonce": v.listingPage({ base, data: { card: card(), similar: [card({ id: "l3", title: "Terrain ACI" })] } }),
  "annonce-sans-badge": v.listingPage({ base, data: { card: card({ documentVerified: false, agencyVerified: false, phoneVerified: false, bedrooms: null }), similar: [] } }),
  "agences-vide": v.agenciesPage({ base, agencies: [] }),
  "agences": v.agenciesPage({ base, agencies: [{ id: "a1", name: "Mali Habitat", listings: 2, reviews: { average: 4.5, count: 6 } }] }),
  "agence": v.agencyPage({ base, agency }),
  "guides": v.guidesIndex({ base }),
  "guide": v.guidePage({ base, guide: GUIDES[0] }),
  "introuvable": v.notFoundPage({ base, path: "/x" }),
};
for (const p of LEGAL_PAGES) { const html = legalPage({ base, page: p }); if (html) pages[p.path.slice(1)] = html; }
for (const [name, html] of Object.entries(pages)) writeFileSync(join(out, `${name}.html`), html);
console.log(Object.keys(pages).length);
