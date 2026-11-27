// Graphiques modernes sans bibliothèque : anneau (donut) avec légende. Aucun style en ligne (couleurs posées par le DOM).
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
