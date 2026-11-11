// Éléments communs à « Annonceurs » et au centre de contrôle Premium : feuille de style chargée à la demande, avatar, courbe SVG.
import { h } from "/js/dom.js";

let cssDone = false;
export function loadCss() {
  if (cssDone || document.querySelector('link[href="/css/espace.css"]')) { cssDone = true; return; }
  document.head.append(h("link", { rel: "stylesheet", href: "/css/espace.css" }));
  cssDone = true;
}

export const initials = (name) => (String(name ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("") || "?").toUpperCase();

/** Photo de profil si elle existe, sinon les initiales. */
export function avatar(name, photoUrl, size = "") {
  return photoUrl
    ? h("img", { class: `esp-ava ${size}`, src: photoUrl, alt: `Photo de ${name}`, loading: "lazy", width: "48", height: "48" })
    : h("span", { class: `esp-ava ${size}`, "aria-hidden": "true" }, initials(name));
}

export function ago(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const m = Math.max(0, Math.round((Date.now() - t) / 60_000));
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const hh = Math.round(m / 60);
  if (hh < 24) return `il y a ${hh} h`;
  const d = Math.round(hh / 24);
  return d === 1 ? "hier" : `il y a ${d} j`;
}

const NS = "http://www.w3.org/2000/svg";
const s = (tag, attrs = {}) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v)); return n; };

/** Courbes Vues / Contacts (aires légères). `rows` : [{ day: "2026-11-09", views, contacts }]. Aucune bibliothèque. */
export function lineChart(rows) {
  const W = 640, H = 200, L = 34, R = 10, T = 12, B = 26;
  const max = Math.max(10, ...rows.flatMap((r) => [r.views, r.contacts]));
  const top = Math.ceil(max / 4) * 4 || 4;
  const X = (i) => L + (rows.length < 2 ? 0 : (i * (W - L - R)) / (rows.length - 1));
  const Y = (v) => T + (H - T - B) * (1 - v / top);
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, class: "esp-chart", role: "img", "aria-label": `Vues : ${rows.reduce((a, r) => a + r.views, 0)}. Contacts : ${rows.reduce((a, r) => a + r.contacts, 0)}.` });
  for (let k = 0; k <= 4; k++) {
    const v = (top * k) / 4;
    svg.append(s("line", { class: "g", x1: L, x2: W - R, y1: Y(v), y2: Y(v) }));
    const t = s("text", { class: "ax", x: L - 6, y: Y(v) + 3, "text-anchor": "end" }); t.textContent = String(Math.round(v)); svg.append(t);
  }
  const step = Math.ceil(rows.length / 7);
  rows.forEach((r, i) => { if (i % step === 0 || i === rows.length - 1) { const t = s("text", { class: "ax", x: X(i), y: H - 7, "text-anchor": i === rows.length - 1 && rows.length > 1 ? "end" : "middle" }); t.textContent = `${r.day.slice(8, 10)}/${r.day.slice(5, 7)}`; svg.append(t); } });
  const draw = (key, cls) => {
    const pts = rows.map((r, i) => `${X(i).toFixed(1)},${Y(r[key]).toFixed(1)}`);
    if (cls === "v") svg.append(s("polygon", { class: "area", points: `${X(0)},${Y(0)} ${pts.join(" ")} ${X(rows.length - 1)},${Y(0)}` }));
    svg.append(s("polyline", { class: `ln ${cls}`, points: pts.join(" ") }));
    rows.forEach((r, i) => { const c = s("circle", { class: `pt ${cls}`, cx: X(i), cy: Y(r[key]), r: 3.2 }); const tt = s("title"); tt.textContent = `${r.day.slice(8, 10)}/${r.day.slice(5, 7)} · ${key === "views" ? "vues" : "contacts"} : ${r[key]}`; c.append(tt); svg.append(c); });
  };
  draw("views", "v"); draw("contacts", "c");
  return svg;
}

// ---------- Carte « Passez Premium » (affichée à tous les annonceurs, Premium ou non) ----------
const svgEl = (tag, attrs = {}) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v)); return n; };
function crownSvg() {
  const svg = svgEl("svg", { viewBox: "0 0 64 48", class: "pc-crown", "aria-hidden": "true", focusable: "false" });
  svg.append(svgEl("path", { d: "M5 40 9 13l14 13L32 7l9 19 14-13 4 27z" }), svgEl("rect", { x: 5, y: 41, width: 54, height: 5, rx: 2 }));
  for (const [cx, cy] of [[9, 11], [32, 5], [55, 11]]) svg.append(svgEl("circle", { cx, cy, r: 3.2 }));
  return svg;
}
function growthSvg() {
  const svg = svgEl("svg", { viewBox: "0 0 120 90", class: "pc-growth", "aria-hidden": "true", focusable: "false" });
  [[12, 70, 14, 12], [38, 58, 14, 24], [64, 42, 14, 40], [90, 20, 14, 62]].forEach(([x, y, w, hh]) => svg.append(svgEl("rect", { x, y, width: w, height: hh, rx: 2 })));
  svg.append(svgEl("path", { d: "M10 58C40 50 70 34 100 8", class: "arrow" }), svgEl("path", { d: "M84 8h17v17", class: "arrow" }));
  return svg;
}
/** `access` : réponse de /me/center/access (ou null). Mène à la page des avantages (#/premium) ; `from` : emplacement suivi pour la mesure de conversion. */
export function premiumCard(access, from = "espace-card") {
  const active = Boolean(access?.premium);
  const left = access?.daysLeft ?? 0;
  const until = access?.premiumUntil ? new Date(access.premiumUntil).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "";
  return h("section", { class: "pc-card", "aria-label": "Premium" },
    h("div", { class: "pc-text" },
      h("div", { class: "pc-title" }, crownSvg(), h("h2", null, active ? "Votre Premium est actif" : "Passez Premium")),
      h("p", null, active
        ? `Actif jusqu'au ${until}${left <= 30 ? ` (${left} j) : pensez à le renouveler.` : "."}`
        : "Pilotez vos annonces, suivez vos résultats et accédez à des avantages exclusifs."),
      h("a", { class: "pc-btn", href: `#/premium?from=${from}` }, active ? "Voir mes avantages" : "Découvrir les avantages", h("span", { "aria-hidden": "true" }, "→"))),
    growthSvg());
}
