// Fiche de parcelle : bouton « Imprimer » et fond de carte Mapbox facultatif.
// Le fond n'est demandé que si le consentement « Cartes et services externes » est enregistré dans CE navigateur.
// Un paramètre d'URL n'est jamais une preuve de consentement. Sans consentement, seul le plan local (SVG) reste affiché.
import { hasConsent } from "/js/core/consent.js";

document.getElementById("print")?.addEventListener("click", () => window.print());

const f6 = (n) => Number(n).toFixed(6);

// Miroir de fondCarteUrl (server/lib/fiche.js) : même contour, mêmes repères, même style.
function fondUrl({ vertices, point, token }) {
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

async function loadFond(slot) {
  try {
    const config = await fetch("/api/config/map", { headers: { Accept: "application/json" } }).then((r) => (r.ok ? r.json() : null));
    const token = config?.mapbox?.token;
    if (!token) return;
    const url = fondUrl({ ...JSON.parse(slot.dataset.geo), token });
    if (!url) return;
    const img = document.createElement("img");
    img.className = "fond-carte";
    img.width = 700;
    img.height = 460;
    img.alt = "Fond de carte : emplacement de la parcelle";
    img.src = url;
    const figure = document.createElement("figure");
    figure.className = "fond";
    const caption = document.createElement("figcaption");
    caption.textContent = "Fond de carte © Mapbox © OpenStreetMap. Position indicative.";
    figure.append(img, caption);
    slot.replaceWith(figure);
  } catch {
    // Pas de fond : le plan local reste affiché.
  }
}

const slot = document.getElementById("fond-auto");
if (slot && hasConsent("cartes")) loadFond(slot);
