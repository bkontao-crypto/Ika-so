// Pages publiques rendues côté serveur : lisibles sans JavaScript, indexables, rapides.
// Aucun numéro de téléphone n'y figure : le contact passe par l'application (connexion, compté).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { listingPath, zoneSlug } from "../lib/slug.js";
import { GUIDES, GUIDE_NOTICE } from "./guides.js";

export const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** JSON-LD sans risque de fermer la balise : « < » est écrit en clair Unicode. */
const jsonLd = (data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;

const number = new Intl.NumberFormat("fr-FR");
export const price = (value, transactionType) => `${number.format(value)} FCFA${transactionType === "Location" ? " / mois" : ""}`;
const cut = (text, max) => { const t = String(text ?? "").replace(/\s+/g, " ").trim(); return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`; };

/** Empreinte des fichiers du thème : l'adresse change quand la feuille de style change, donc jamais d'ancienne version en mémoire de l'appareil. */
const PUBLIC_DIR = new URL("../../public/", import.meta.url);
let assetStamp = { at: 0, value: "0" };
export function assetVersion() {
  if (Date.now() - assetStamp.at < 5000) return assetStamp.value;
  const hash = createHash("sha1");
  try { for (const f of ["css/ika.css", "css/seo.css", "js/seo-theme.js"]) hash.update(readFileSync(new URL(f, PUBLIC_DIR))); } catch { hash.update("absent"); }
  assetStamp = { at: Date.now(), value: hash.digest("hex").slice(0, 10) };
  return assetStamp.value;
}

/** Réglages du propriétaire (logo, mots-clés, mentions) : instantané partagé, renouvelé à chaque requête par routes/seo.js. */
let site = {};
export function setSite(value) { site = value ?? {}; }
/** index.html (application) avec titre, description, mots-clés et logo du propriétaire quand ils sont réglés ; sans réglage, le fichier reste identique. */
export function brandIndexHtml(page, s = {}) {
  const attr = (v) => esc(String(v).replace(/\s+/g, " ").trim());
  let out = page;
  if (s.title) out = out.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${attr(s.title)}</title>`);
  if (s.description) out = out.replace(/<meta name="description" content="[^"]*">/, () => `<meta name="description" content="${attr(s.description)}">`);
  if (s.keywords) out = out.replace(/(<meta name="description"[^>]*>)/, (m) => `${m}\n  <meta name="keywords" content="${attr(s.keywords)}">`);
  if (s.logoUrl) out = out.replace(/<span class="logo-mark(?: logo-mark-sm)?" aria-hidden="true">I<\/span>/g, () => `<img class="logo-img" src="${attr(s.logoUrl)}" alt="" height="40">`);
  return out;
}
const logoMark = (logoUrl) => (logoUrl ? `<img class="logo-img" src="${esc(logoUrl)}" alt="" height="32">` : '<span class="logo-mark" aria-hidden="true">I</span>');

export function layout({ base, path, title, description, noindex = false, image, ld = [], body }) {
  const url = `${base}${path}`;
  const img = image ? (image.startsWith("http") ? image : `${base}${image}`) : `${base}/media/terrain-aci.jpg`;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(cut(title, 70))}</title>
<meta name="description" content="${esc(cut(description, 160))}">
<meta name="robots" content="${noindex ? "noindex,follow" : "index,follow"}">
${site.keywords ? `<meta name="keywords" content="${esc(cut(site.keywords, 200))}">\n` : ""}
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Ika So"><meta property="og:locale" content="fr_ML">
<meta property="og:title" content="${esc(cut(title, 90))}"><meta property="og:description" content="${esc(cut(description, 200))}">
<meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(img)}">
<meta name="theme-color" content="#102c25">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="stylesheet" href="/css/ika.css?v=${assetVersion()}">
<link rel="stylesheet" href="/css/seo.css?v=${assetVersion()}">
<script src="/js/seo-theme.js?v=${assetVersion()}"></script>
${ld.map(jsonLd).join("\n")}
</head>
<body class="seo-page">
<a class="sr-only" href="#contenu">Aller au contenu</a>
<header class="site-header"><div class="site-header-inner">
  <a class="logo" href="/" aria-label="Ika So, accueil">${logoMark(site.logoUrl)}<span class="logo-word">ika so<i>.</i><small>L'immobilier simplement</small></span></a>
  <nav class="site-nav" aria-label="Navigation"><a href="/quartiers">Quartiers</a><a href="/agences">Agences</a><a href="/guides">Guides</a></nav>
  <div class="site-actions"><a class="btn-lime" href="/#/publier">Déposer<span class="long"> une annonce</span> ↗</a></div>
</div></header>
<main id="contenu" tabindex="-1">
${body}
</main>
<footer class="seo-footer"><p class="small muted">Ika So : l'immobilier au Mali, plus accessible. Ika So affiche ce que l'annonceur déclare ; un badge n'est donné qu'après un contrôle par l'équipe. <a href="/#/confiance">Confiance et limites</a> · <a href="/guides">Guides</a> · <a href="/quartiers">Quartiers</a>${site.mentions ? ' · <a href="/mentions-legales">Mentions légales</a>' : ""}</p></footer>
</body>
</html>`;
}

const breadcrumb = (base, items) => ({
  "@context": "https://schema.org", "@type": "BreadcrumbList",
  itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: `${base}${path}` })),
});

function card(item) {
  const href = listingPath(item);
  return `<article class="card listing">
  <div class="listing-wrap"><a class="listing-photo" href="${esc(href)}"><img src="${esc(item.imageUrl)}" alt="" loading="lazy" width="640" height="420"><span class="pill pill-white tag-tl">${esc(item.featured ? "À la une" : item.category)}</span><span class="pill pill-dark tag-tr">${item.transactionType === "Location" ? "À louer" : "À vendre"}</span></a></div>
  <div class="listing-body"><p class="loc">${esc(item.neighborhood)} • ${esc(item.category)}</p>
  <h2><a href="${esc(href)}">${esc(item.title)}</a></h2>
  <p class="lprice">${esc(price(item.price, item.transactionType))}</p>
  <div class="lfacts"><span>${esc(item.surfaceLabel)}</span></div>
  <div class="row">${item.documentVerified ? '<span class="pill pill-green">Titre foncier contrôlé</span>' : ""}${item.agencyVerified ? '<span class="pill pill-green">Agence vérifiée</span>' : ""}${item.phoneVerified ? '<span class="pill pill-green">Tél. vérifié par SMS</span>' : ""}</div></div>
</article>`;
}
const grid = (items) => (items.length ? `<div class="listing-grid">${items.map(card).join("\n")}</div>` : '<p class="card pad muted">Aucune annonce en ligne pour le moment.</p>');

function benchmarkTable(rows, intro) {
  if (!rows.length) return "";
  return `<section class="stack" aria-labelledby="reperes"><h2 id="reperes">Repères de prix</h2>
<p class="small muted">${esc(intro)} Calculés sur les annonces en ligne (au moins 3 par ligne) : ce ne sont ni une estimation officielle ni une promesse de prix.</p>
<div class="card pad"><table class="table"><thead><tr><th scope="col">Bien</th><th scope="col">Annonces</th><th scope="col">Prix médian</th><th scope="col">Fourchette</th><th scope="col">Médiane au m²</th></tr></thead><tbody>
${rows.map((r) => `<tr><th scope="row">${esc(r.category)} · ${esc(r.transactionType)}</th><td>${r.count}</td><td>${esc(price(r.medianPrice, r.transactionType))}</td><td>${esc(number.format(r.low))} à ${esc(price(r.high, r.transactionType))}</td><td>${r.medianPerM2 ? esc(`${number.format(r.medianPerM2)} FCFA`) : "—"}</td></tr>`).join("\n")}
</tbody></table></div></section>`;
}

export function zonesIndex({ base, zones }) {
  const body = `<h1 class="title">Terrains et logements par quartier à Bamako</h1>
<p>Choisissez un quartier pour voir les annonces en ligne, les repères de prix et les conseils d'achat.</p>
<ul class="stack">${zones.map((z) => `<li class="card pad row-between"><a href="/quartier/${zoneSlug(z)}"><strong>${esc(z.name)}</strong></a><span class="small muted">${z.count} annonce(s)</span></li>`).join("")}</ul>`;
  return layout({ base, path: "/quartiers", title: "Quartiers de Bamako : terrains et logements | Ika So", description: "Annonces de terrains et de logements par quartier à Bamako : ACI 2000, Badalabougou, Korofina, Hamdallaye et plus. Repères de prix et conseils.", body,
    ld: [breadcrumb(base, [["Accueil", "/"], ["Quartiers", "/quartiers"]])] });
}

export function zonePage({ base, zone, data }) {
  const n = data.listings.length;
  const slug = zoneSlug(zone);
  const body = `<nav class="small" aria-label="Fil d'Ariane"><a href="/">Accueil</a> › <a href="/quartiers">Quartiers</a> › ${esc(zone.name)}</nav>
<h1 class="title">Terrains et logements à ${esc(zone.name)}, Bamako</h1>
<p>${n ? `${n} annonce(s) en ligne à ${esc(zone.name)}.` : `Aucune annonce en ligne à ${esc(zone.name)} pour le moment.`} Chaque annonce est relue avant sa publication ; le document est déclaré par l'annonceur, sans garantie automatique.</p>
${grid(data.listings)}
${benchmarkTable(data.benchmarks, `À ${zone.name}.`)}
<section class="stack"><h2>Avant d'acheter à ${esc(zone.name)}</h2><p><a href="/guides/acheter-un-terrain-a-bamako">Acheter un terrain à Bamako : les étapes</a> · <a href="/guides/verifier-un-document-foncier">Vérifier un document foncier</a></p></section>
<p><a class="btn btn-primary" href="/#/">Chercher avec les filtres</a></p>`;
  return layout({ base, path: `/quartier/${slug}`, title: `Terrains et logements à ${zone.name}, Bamako | Ika So`, description: n ? `${n} annonce(s) à ${zone.name} : terrains, maisons, appartements. Repères de prix et conseils d'achat.` : `Annonces immobilières à ${zone.name}, Bamako.`,
    noindex: n === 0, image: data.listings[0]?.imageUrl, body,
    ld: [breadcrumb(base, [["Accueil", "/"], ["Quartiers", "/quartiers"], [zone.name, `/quartier/${slug}`]]),
      { "@context": "https://schema.org", "@type": "ItemList", name: `Annonces à ${zone.name}`, itemListElement: data.listings.slice(0, 20).map((l, i) => ({ "@type": "ListItem", position: i + 1, url: `${base}${listingPath(l)}`, name: l.title })) }] });
}

export function listingPage({ base, data }) {
  const l = data.card;
  const facts = [["Quartier", l.neighborhood], ["Superficie", l.surfaceLabel], l.roadAccess && ["Accès", l.roadAccess], l.bedrooms != null && ["Chambres", String(l.bedrooms)], l.bathrooms != null && ["Salles de bain", String(l.bathrooms)], l.furnished != null && ["Meublé", l.furnished ? "Oui" : "Non"], ["Document déclaré", l.declaredDocument ?? "non précisé"]].filter(Boolean);
  const photos = l.photos?.length ? l.photos : [l.imageUrl];
  const body = `<nav class="small" aria-label="Fil d'Ariane"><a href="/">Accueil</a> › <a href="/quartier/${zoneSlug({ name: l.neighborhood })}">${esc(l.neighborhood)}</a> › ${esc(l.title)}</nav>
<article class="card">
<div class="gallery-main"><img src="${esc(photos[0])}" alt="${esc(l.title)}" width="960" height="640"></div>
<div class="pad stack">
<p class="small muted">${esc(l.neighborhood)}, ${esc(l.city)}</p>
<h1 class="title">${esc(l.title)}</h1>
<p class="price">${esc(price(l.price, l.transactionType))}</p>${l.pricePerM2 ? `<p class="small muted">${esc(number.format(l.pricePerM2))} FCFA / m²</p>` : ""}
<div class="row"><span class="pill pill-dark">${esc(l.transactionType)}</span>${l.documentVerified ? '<span class="pill pill-green">Titre foncier contrôlé par l\'équipe</span>' : ""}${l.agencyVerified ? `<span class="pill pill-green">Agence vérifiée${l.agencyName ? ` : ${esc(l.agencyName)}` : ""}</span>` : ""}${l.phoneVerified ? '<span class="pill pill-green">Numéro vérifié par SMS</span>' : '<span class="pill">Numéro non vérifié par SMS</span>'}</div>
<p class="notice">Document déclaré par l'annonceur, sans garantie automatique. Ne versez aucun acompte avant la visite et le contrôle du document.</p>
<dl class="grid facts">${facts.map(([k, v]) => `<div class="fact"><dt>${esc(k)}</dt><dd><strong>${esc(v)}</strong></dd></div>`).join("")}</dl>
<p>${esc(l.description)}</p>
<p><a class="btn btn-primary" href="/#/annonce/${encodeURIComponent(l.id)}">Contacter l'annonceur</a> <a class="btn" href="/#/annonce/${encodeURIComponent(l.id)}">Demander une visite</a></p>
<p class="small muted">Annonce de ${esc(l.ownerName)} · ${esc(l.ownerRole)}. Le contact se fait dans l'application, avec un compte.</p>
</div></article>
${data.similar.length ? `<section class="stack"><h2>Annonces similaires</h2>${grid(data.similar)}</section>` : ""}`;
  return layout({ base, path: listingPath(l), title: `${l.title} — ${l.neighborhood} | Ika So`, description: `${l.title} à ${l.neighborhood} : ${price(l.price, l.transactionType)}, ${l.surfaceLabel}. ${l.description}`, image: photos[0], body,
    ld: [breadcrumb(base, [["Accueil", "/"], [l.neighborhood, `/quartier/${zoneSlug({ name: l.neighborhood })}`], [l.title, listingPath(l)]]),
      { "@context": "https://schema.org", "@type": "RealEstateListing", name: l.title, description: cut(l.description, 500), url: `${base}${listingPath(l)}`, datePosted: l.createdAt || undefined,
        image: photos.map((p) => (p.startsWith("http") ? p : `${base}${p}`)),
        offers: { "@type": "Offer", price: l.price, priceCurrency: "XOF", availability: "https://schema.org/InStock" },
        contentLocation: { "@type": "Place", name: `${l.neighborhood}, ${l.city}`, address: { "@type": "PostalAddress", addressLocality: l.neighborhood, addressRegion: l.city, addressCountry: "ML" } } }] });
}

const ratingText = (r) => (r?.count ? `note ${String(r.average).replace(".", ",")}/5 (${r.count} avis)` : "pas encore d'avis");

export function agenciesPage({ base, agencies }) {
  const body = `<h1 class="title">Agences immobilières vérifiées</h1>
<p>Une agence apparaît ici seulement après contrôle de son registre de commerce par l'équipe Ika So.</p>
${agencies.length ? `<ul class="stack">${agencies.map((a) => `<li class="card pad row-between"><a href="/agence/${encodeURIComponent(a.id)}"><strong>${esc(a.name)}</strong></a><span class="small muted">${a.listings} annonce(s) · ${ratingText(a.reviews)}</span></li>`).join("")}</ul>` : '<p class="card pad muted">Aucune agence vérifiée pour le moment.</p>'}`;
  return layout({ base, path: "/agences", title: "Agences immobilières vérifiées au Mali | Ika So", description: "Annuaire des agences immobilières dont le registre de commerce a été contrôlé par l'équipe Ika So.", noindex: agencies.length === 0, body,
    ld: [breadcrumb(base, [["Accueil", "/"], ["Agences", "/agences"]])] });
}

export function agencyPage({ base, agency }) {
  const body = `<nav class="small" aria-label="Fil d'Ariane"><a href="/">Accueil</a> › <a href="/agences">Agences</a> › ${esc(agency.name)}</nav>
<h1 class="title">${esc(agency.name)}</h1><p><span class="pill pill-green">Agence vérifiée</span> <span class="small muted">${ratingText(agency.reviews)}</span></p>
<p><a class="btn btn-small" href="/#/annonceur/${encodeURIComponent(agency.id)}">Voir le profil complet, le statut de confiance et les avis</a></p>
${grid(agency.listings)}`;
  return layout({ base, path: `/agence/${encodeURIComponent(agency.id)}`, title: `${agency.name} : annonces et agence vérifiée | Ika So`, description: `${agency.listings.length} annonce(s) de ${agency.name}, agence immobilière vérifiée sur Ika So.`, noindex: agency.listings.length === 0, image: agency.listings[0]?.imageUrl, body,
    ld: [breadcrumb(base, [["Accueil", "/"], ["Agences", "/agences"], [agency.name, `/agence/${encodeURIComponent(agency.id)}`]]),
      { "@context": "https://schema.org", "@type": "RealEstateAgent", name: agency.name, url: `${base}/agence/${encodeURIComponent(agency.id)}`, areaServed: "Bamako, Mali" }] });
}

export function guidesIndex({ base }) {
  const body = `<h1 class="title">Guides pour acheter, vendre et louer</h1><p class="notice">${esc(GUIDE_NOTICE)}</p>
<ul class="stack">${GUIDES.map((g) => `<li class="card pad stack"><h2><a href="/guides/${g.slug}">${esc(g.title)}</a></h2><p class="muted">${esc(g.summary)}</p></li>`).join("")}</ul>`;
  return layout({ base, path: "/guides", title: "Guides immobiliers pour le Mali | Ika So", description: "Acheter un terrain à Bamako, vérifier un document foncier, repérer les arnaques : des guides simples, sans jargon.", body,
    ld: [breadcrumb(base, [["Accueil", "/"], ["Guides", "/guides"]])] });
}

export function guidePage({ base, guide }) {
  const body = `<nav class="small" aria-label="Fil d'Ariane"><a href="/">Accueil</a> › <a href="/guides">Guides</a> › ${esc(guide.title)}</nav>
<article class="stack"><h1 class="title">${esc(guide.title)}</h1><p class="notice">${esc(GUIDE_NOTICE)}</p>
${guide.sections.map(([h, items]) => `<section class="stack"><h2>${esc(h)}</h2><ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></section>`).join("\n")}
<p><a class="btn btn-primary" href="/quartiers">Voir les annonces par quartier</a></p></article>`;
  return layout({ base, path: `/guides/${guide.slug}`, title: `${guide.title} | Ika So`, description: guide.summary, body,
    ld: [breadcrumb(base, [["Accueil", "/"], ["Guides", "/guides"], [guide.title, `/guides/${guide.slug}`]]),
      { "@context": "https://schema.org", "@type": "Article", headline: guide.title, description: guide.summary, inLanguage: "fr", mainEntityOfPage: `${base}/guides/${guide.slug}`, publisher: { "@type": "Organization", name: "Ika So" } }] });
}

export function notFoundPage({ base, path }) {
  return layout({ base, path, title: "Page introuvable | Ika So", description: "Cette page n'existe pas ou n'est plus en ligne.", noindex: true,
    body: '<h1 class="title">Page introuvable</h1><p>Cette annonce ou cette page n\'est plus en ligne. <a href="/">Voir les annonces</a> · <a href="/quartiers">Quartiers</a></p>' });
}

export function sitemapXml({ base, entries, guides = GUIDES }) {
  const url = (path, at) => `<url><loc>${esc(base + path)}</loc>${at ? `<lastmod>${new Date(at).toISOString().slice(0, 10)}</lastmod>` : ""}</url>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[
    url("/"), url("/quartiers"), url("/guides"), url("/agences"),
    ...entries.zones.map((z) => url(`/quartier/${zoneSlug({ name: z })}`)),
    ...guides.map((g) => url(`/guides/${g.slug}`)),
    ...entries.agencies.map((id) => url(`/agence/${encodeURIComponent(id)}`)),
    ...entries.listings.map((l) => url(listingPath(l), l.at)),
  ].join("\n")}\n</urlset>\n`;
}

export const robotsTxt = (base) => `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin.html\nSitemap: ${base}/sitemap.xml\n`;
