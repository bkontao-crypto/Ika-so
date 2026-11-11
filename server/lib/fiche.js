/**
 * Fiche imprimable d'une parcelle (module « Cartographie immobilière », étape 5).
 * Page HTML sans dépendance : l'utilisateur l'imprime ou « enregistre en PDF » depuis son navigateur.
 * Aucun script ni style en ligne (CSP) : styles dans /css/fiche.css, bouton « Imprimer » dans /js/fiche.js.
 * Le plan est dessiné ici en SVG à partir du polygone ENREGISTRÉ ; superficie et périmètre sont ceux calculés par le serveur.
 */
import { esc } from "../seo/render.js";

/** ⛔ Texte de la mention obligatoire : à faire valider par le conseil juridique avant production (voir docs/juridique/). */
export const MENTION_OBLIGATOIRE =
  "Mesure indicative, établie à partir de points placés par l'annonceur sur un plan. Ce document n'est ni un bornage, ni un plan de géomètre, ni un titre foncier : il ne prouve ni la propriété ni les limites légales du terrain. Seuls un géomètre-expert et les services du cadastre peuvent établir les limites officielles.";

const nf = (digits) => (value) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits }).format(value);
const KM_LAT = 111_132; // mètres par degré de latitude (aperçu graphique seulement)

/** Plan SVG : contour numéroté, échelle, nord. Dessin uniquement, sans valeur de mesure. */
export function planSvg(vertices) {
  const W = 600, H = 420, M = 50;
  const lat0 = vertices.reduce((s, v) => s + v.lat, 0) / vertices.length;
  const kx = KM_LAT * Math.cos((lat0 * Math.PI) / 180);
  const xy = vertices.map((v) => ({ x: v.lng * kx, y: -v.lat * KM_LAT }));
  const minX = Math.min(...xy.map((p) => p.x)), maxX = Math.max(...xy.map((p) => p.x));
  const minY = Math.min(...xy.map((p) => p.y)), maxY = Math.max(...xy.map((p) => p.y));
  const scale = Math.min((W - 2 * M) / (maxX - minX || 1), (H - 2 * M) / (maxY - minY || 1)); // pixels par mètre
  const px = (p) => ({ x: M + (p.x - minX) * scale + ((W - 2 * M) - (maxX - minX) * scale) / 2, y: M + (p.y - minY) * scale + ((H - 2 * M) - (maxY - minY) * scale) / 2 });
  const pts = xy.map(px);
  const target = (W / 4) / scale; // longueur de la barre d'échelle ≈ un quart de la largeur
  const base = 10 ** Math.floor(Math.log10(target));
  const bar = [1, 2, 5, 10].map((k) => k * base).find((m) => m >= target) ?? base * 10;
  const barPx = bar * scale;
  return `<svg class="plan" viewBox="0 0 ${W} ${H}" role="img" aria-label="Plan de la parcelle, ${vertices.length} sommets">`
    + `<rect class="plan-bg" x="0" y="0" width="${W}" height="${H}"/>`
    + `<polygon class="plan-shape" points="${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}"/>`
    + pts.map((p, i) => `<circle class="plan-dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="7"/><text class="plan-num" x="${(p.x + 12).toFixed(1)}" y="${(p.y - 10).toFixed(1)}">${i + 1}</text>`).join("")
    + `<line class="plan-bar" x1="30" y1="${H - 24}" x2="${(30 + barPx).toFixed(1)}" y2="${H - 24}"/><text class="plan-txt" x="30" y="${H - 32}">${bar} m</text>`
    + `<text class="plan-txt" x="${W - 56}" y="34">N ↑</text></svg>`;
}

/** URL de l'image statique Mapbox (satellite + rues) avec le contour et les sommets numérotés. null sans jeton. */
export function fondCarteUrl({ vertices, point, token }) {
  if (!token) return null;
  const f6 = (n) => Number(n).toFixed(6);
  const overlays = [];
  let view = "auto";
  if (vertices.length >= 3) {
    const ring = vertices.map((v) => [Number(f6(v.lng)), Number(f6(v.lat))]);
    const feature = { type: "Feature", properties: { stroke: "#f2b705", "stroke-width": 3, fill: "#f2b705", "fill-opacity": 0.3 }, geometry: { type: "Polygon", coordinates: [[...ring, ring[0]]] } };
    overlays.push(`geojson(${encodeURIComponent(JSON.stringify(feature))})`);
    vertices.slice(0, 9).forEach((v, i) => overlays.push(`pin-s-${i + 1}+0b1f4b(${f6(v.lng)},${f6(v.lat)})`));
  } else if (point) {
    overlays.push(`pin-l+dc2626(${f6(point.lng)},${f6(point.lat)})`);
    view = `${f6(point.lng)},${f6(point.lat)},17`;
  } else return null;
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${overlays.join(",")}/${view}/700x460@2x?padding=50&logo=true&attribution=true&access_token=${encodeURIComponent(token)}`;
}

export function ficheHtml({ geo, listing, generatedAt = new Date(), mapboxToken = "" }) {
  const vertices = (geo.polygon?.coordinates?.[0] ?? []).slice(0, -1).map(([lng, lat]) => ({ lat, lng }));
  const when = (iso) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Bamako" });
  const row = (k, v) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Fiche de parcelle — ${esc(listing.title)}</title>
<link rel="stylesheet" href="/css/fiche.css">
</head>
<body>
<main class="sheet">
<header><p class="brand">IKA SO</p><h1>Fiche de localisation</h1><p class="sub">${esc(listing.title)} · ${esc(listing.neighborhood)}, ${esc(listing.city)}</p></header>
<p class="mention" role="note"><strong>Important.</strong> ${esc(MENTION_OBLIGATOIRE)}</p>
${(() => { const u = fondCarteUrl({ vertices, point: geo.point, token: mapboxToken }); return u ? `<figure class="fond"><img class="fond-carte" src="${esc(u)}" width="700" height="460" alt="Fond de carte : emplacement de la parcelle"><figcaption>Fond de carte © Mapbox © OpenStreetMap. Position indicative.</figcaption></figure>` : ""; })()}
${vertices.length >= 3 ? planSvg(vertices) : ""}
<table class="facts">
${row("Type de bien", geo.category)}
${geo.areaM2 != null ? row("Superficie mesurée (indicative)", `${nf(2)(geo.areaM2)} m² (${nf(4)(geo.areaM2 / 10_000)} ha)`) : ""}
${geo.perimeterM != null ? row("Périmètre (indicatif)", `${nf(2)(geo.perimeterM)} m`) : ""}
${listing.surface_label ? row("Superficie déclarée dans l'annonce", listing.surface_label) : ""}
${row("Repère GPS (WGS84)", `${geo.point.lat.toFixed(6)}, ${geo.point.lng.toFixed(6)}`)}
${geo.computedAt ? row("Mesure calculée le", when(geo.computedAt)) : ""}
${row("Position affichée aux visiteurs", geo.isPublic ? "Oui" : "Non (privée)")}
</table>
${vertices.length ? `<h2>Sommets (latitude, longitude)</h2><ol class="vertices">${vertices.map((v) => `<li>${v.lat.toFixed(6)}, ${v.lng.toFixed(6)}</li>`).join("")}</ol>` : ""}
<footer><p>Document généré le ${esc(when(generatedAt.toISOString()))} depuis le compte de l'annonceur. Calcul : projection équivalente sur l'ellipsoïde WGS84, effectué par le serveur à l'enregistrement.</p>
<p class="no-print"><button id="print" type="button">Imprimer ou enregistrer en PDF</button></p></footer>
</main>
<script src="/js/fiche.js"></script>
</body>
</html>`;
}
