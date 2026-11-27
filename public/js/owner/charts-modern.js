// Graphiques modernes sans bibliothèque : anneau (donut) avec légende, colonnes, entonnoir. Aucun style en ligne (couleurs posées par le DOM).
import { s, h, nf } from "./ui.js";

/** Anneau. items : [{ label, value, color }]. center : texte central (par défaut le total). */
export function donut({ items, center, caption, size = 176, stroke = 24 }) {
  const rows = items.filter((x) => x.value > 0);
  const total = rows.reduce((a, x) => a + x.value, 0);
  if (!total) return h("p", { class: "dn-empty" }, "Rien à afficher pour le moment.");
  const r = (size - stroke) / 2; const c = 2 * Math.PI * r; const mid = size / 2;
  const svg = s("svg", { viewBox: `0 0 ${size} ${size}`, role: "img", "aria-label": rows.map((x) => `${x.label} : ${x.value}`).join(" ; ") });
  svg.append(s("circle", { class: "dn-track", cx: mid, cy: mid, r, fill: "none", "stroke-width": stroke }));
  let off = 0;
  rows.forEach((x) => {
    const len = (x.value / total) * c;
    const gap = rows.length > 1 ? Math.min(4, len / 3) : 0;
    const dash = Math.max(0, len - gap);
    svg.append(s("circle", { cx: mid, cy: mid, r, fill: "none", stroke: x.color, "stroke-width": stroke, "stroke-dasharray": `${dash} ${c - dash}`, "stroke-dashoffset": -off, transform: `rotate(-90 ${mid} ${mid})` }, s("title", {}, `${x.label} : ${nf(x.value)}`)));
    off += len;
  });
  const legend = h("ul", { class: "dn-legend" }, items.map((x) => {
    const dot = h("i", { class: "dot" }); dot.style.setProperty("background", x.color);
    return h("li", null, dot, h("span", null, x.label), h("b", null, nf(x.value)), h("small", null, `${Math.round((x.value / total) * 100)} %`));
  }));
  const ring = h("div", { class: "dn-ring" }, svg, h("div", { class: "dn-center" }, h("strong", null, center ?? nf(total)), caption ? h("small", null, caption) : null));
  return h("div", { class: "donut" }, ring, legend);
}

/** Colonnes verticales. items : [{ label, value, hot? }] ; les colonnes « hot » (pointes) prennent la couleur d'accent. */
export function columnChart({ items, height = 190, color = "#087448", hot = "#c6a35c" }) {
  const W = 720; const H = height; const T = 12; const B = 24; const L = 8;
  const max = Math.max(1, ...items.map((x) => x.value));
  const bw = (W - L * 2) / Math.max(1, items.length);
  const step = Math.ceil(items.length / 12);
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": items.map((x) => `${x.label} : ${x.value}`).join(" ; ") });
  svg.append(s("line", { class: "grid-line", x1: L, x2: W - L, y1: H - B, y2: H - B }));
  items.forEach((x, i) => {
    const hh = x.value > 0 ? Math.max(3, ((H - T - B) * x.value) / max) : 0;
    svg.append(s("rect", { x: L + i * bw + bw * 0.15, y: H - B - hh, width: bw * 0.7, height: hh, rx: 4, fill: x.hot ? hot : color }, s("title", {}, `${x.label} : ${nf(x.value)}`)));
    if (i % step === 0) svg.append(s("text", { class: "axis", x: L + i * bw + bw / 2, y: H - 6, "text-anchor": "middle" }, x.label));
  });
  return h("div", { class: "chart" }, svg);
}

/** Entonnoir : barres horizontales relatives à la 1re étape, avec le taux de passage depuis l'étape précédente. steps : [{ label, value, color }]. */
export function funnelChart({ steps }) {
  const top = Math.max(1, steps[0]?.value ?? 1);
  return h("div", { class: "funnel" }, steps.map((x, i) => {
    const fill = h("div", { class: "fn-fill" });
    fill.style.width = `${Math.max(x.value > 0 ? 2 : 0, (x.value / top) * 100)}%`;
    fill.style.background = x.color;
    const prev = steps[i - 1]?.value;
    const note = i === 0 ? "Point de départ" : prev ? `${Math.round((x.value / prev) * 100)} % de l'étape précédente` : "—";
    return h("div", { class: "fn-row" }, h("div", { class: "fn-head" }, h("b", null, x.label), h("span", null, nf(x.value))), h("div", { class: "fn-track" }, fill), h("small", null, note));
  }));
}
