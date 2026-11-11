// Composants du Owner Control Center : icônes SVG, graphiques sans bibliothèque, tiroir, dialogues, formats.
// Tout texte passe par textContent (aucune injection HTML) ; aucun style en ligne (propriétés posées par le DOM, autorisé par la CSP).
import { h, toast, fail } from "/js/dom.js";
export { h, toast, fail };
export { api } from "/js/dom.js";

const NS = "http://www.w3.org/2000/svg";
export const s = (tag, attrs = {}, ...kids) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, String(v));
  kids.flat().forEach((c) => c != null && n.append(c instanceof Node ? c : document.createTextNode(String(c))));
  return n;
};

const R = (x, y, w, hh, rx = 2) => ["rect", { x, y, width: w, height: hh, rx }];
const P = (d) => ["path", { d }];
const C = (cx, cy, r) => ["circle", { cx, cy, r }];
const ICONS = {
  grid: [R(3, 3, 7, 7, 1.5), R(14, 3, 7, 7, 1.5), R(3, 14, 7, 7, 1.5), R(14, 14, 7, 7, 1.5)],
  pulse: [P("M3 12h4l3-8 4 16 3-8h4")],
  list: [P("M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01")],
  users: [C(9, 8, 3.5), P("M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.5a3.5 3.5 0 0 1 0 7M18 14.4c2 .7 3.5 2.6 3.5 5.6")],
  building: [R(4, 3, 12, 18, 1.5), P("M16 9h4v12h-4M8 7h4M8 11h4M8 15h4")],
  shield: [P("M12 3l8 3v6c0 4.5-3.3 8-8 9-4.7-1-8-4.5-8-9V6z"), P("M8.5 12l2.5 2.5 4.5-5")],
  flag: [P("M5 21V4M5 4h11l-1.5 4L16 12H5")],
  wallet: [R(3, 6, 18, 14, 2.5), P("M3 10h18M16 15h2")],
  clock: [C(12, 12, 9), P("M12 7v5l3 2")],
  funnel: [P("M3 5h18l-7 8v6l-4-2v-4z")],
  mail: [R(3, 5, 18, 14, 2), P("M3.5 7l8.5 6 8.5-6")],
  megaphone: [P("M3 11v3a1 1 0 0 0 1 1h3l8 4V6L7 10H4a1 1 0 0 0-1 1z"), P("M18.5 9a4 4 0 0 1 0 6")],
  news: [R(4, 4, 16, 16, 2), P("M8 9h8M8 13h8M8 17h5")],
  pin: [P("M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"), C(12, 10, 2.3)],
  sparkles: [P("M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"), P("M18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z")],
  file: [P("M7 3h7l5 5v13H7z"), P("M14 3v5h5M10 13h6M10 17h6")],
  database: [["ellipse", { cx: 12, cy: 6, rx: 8, ry: 3 }], P("M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6")],
  gear: [C(12, 12, 3), P("M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1")],
  globe: [C(12, 12, 9), P("M3 12h18M12 3c2.6 2.6 4 5.6 4 9s-1.4 6.4-4 9c-2.6-2.6-4-5.6-4-9s1.4-6.4 4-9z")],
  swap: [P("M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4")],
  scroll: [P("M8 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8"), P("M8 4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2M10 9h6M10 13h6")],
  bell: [P("M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"), P("M10 21h4")],
  search: [C(11, 11, 7), P("M21 21l-4.3-4.3")],
  help: [C(12, 12, 9), P("M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01")],
  sun: [C(12, 12, 4), P("M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4")],
  moon: [P("M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z")],
  refresh: [P("M20 11a8 8 0 0 0-14-4L4 9M4 4v5h5M4 13a8 8 0 0 0 14 4l2-2M20 20v-5h-5")],
  download: [P("M12 3v12M7 10l5 5 5-5M4 21h16")],
  chevron: [P("M9 6l6 6-6 6")],
  x: [P("M6 6l12 12M18 6L6 18")],
  check: [P("M5 12.5l4.5 4.5L19 7.5")],
  alert: [P("M12 3l10 18H2z"), P("M12 10v5M12 18h.01")],
  eye: [P("M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"), C(12, 12, 3)],
  filter: [P("M3 5h18l-7 8v6l-4-2v-4z")],
  play: [P("M7 4l13 8-13 8z")],
  menu: [P("M4 6h16M4 12h16M4 18h16")],
  route: [C(6, 19, 2.5), C(18, 5, 2.5), P("M8.5 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5")],
  user: [C(12, 8, 4), P("M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5")],
  home: [P("M3 11l9-8 9 8M5 10v10h14V10")],
  star: [P("M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z")],
  lock: [R(5, 11, 14, 10, 2), P("M8 11V8a4 4 0 0 1 8 0v3")],
  external: [P("M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5")],
  plus: [P("M12 5v14M5 12h14")],
};
export function ico(name, cls = "") {
  const svg = s("svg", { class: `ic ${cls}`.trim(), viewBox: "0 0 24 24", "aria-hidden": "true" });
  for (const [tag, attrs] of ICONS[name] ?? ICONS.grid) svg.append(s(tag, attrs));
  return svg;
}

// ---------- Formats ----------
const nfr = new Intl.NumberFormat("fr-FR");
export const nf = (n) => (n == null ? "—" : nfr.format(n));
export const pad2 = (n) => (n == null ? "—" : String(n).padStart(2, "0"));
export const fcfa = (n) => (n == null ? "—" : `${nfr.format(n)} FCFA`);
export const timeOf = (iso) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
export const dateTime = (iso) => (iso ? new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
export const dateOnly = (iso) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—");
export function dayLabel(iso) {
  const d = new Date(iso); const t = new Date();
  const k = (x) => x.toDateString();
  if (k(d) === k(t)) return "Aujourd'hui";
  if (k(d) === k(new Date(t.getTime() - 86_400_000))) return "Hier";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}
export function ago(iso) {
  const sec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "à l'instant";
  if (sec < 3600) return `il y a ${Math.floor(sec / 60)} min`;
  if (sec < 86_400) return `il y a ${Math.floor(sec / 3600)} h`;
  return `il y a ${Math.floor(sec / 86_400)} j`;
}
export const initials = (name) => (String(name ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("") || "?").toUpperCase();
export const shortDay = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
export const pill = (tone, text) => h("span", { class: `pill ${tone}` }, text);
export const STATUS_TONE = { PUBLISHED: "ok", PENDING: "warn", REJECTED: "bad", ARCHIVED: "neutral", EXPIRED: "neutral", DRAFT: "neutral", SOLD: "info", RENTED: "info", ACTIVE: "ok", RESTRICTED: "warn", BANNED: "bad", PAID: "ok", FAILED: "bad", MISMATCH: "bad", REFUNDED: "warn", OPEN: "warn", IN_PROGRESS: "info", RESOLVED: "ok", CLOSED: "neutral", DISMISSED: "neutral", OK: "ok", LOGGED: "neutral", SENT: "ok", ENDED: "neutral", PAUSED: "warn", ACCEPTED: "ok", DECLINED: "bad", CANCELLED: "neutral" };
export const statusPill = (v) => pill(STATUS_TONE[v] ?? "neutral", v ?? "—");

export const CAT_COLORS = { admin: "#073d2b", account: "#477eaa", security: "#7a8f86", listing: "#087448", engagement: "#c6a35c", safety: "#c94f4f", finance: "#b77b1c", growth: "#7b5ea7", system: "#4b5563", traffic: "#9fb3a8" };
export const CAT_ICONS = { admin: "shield", account: "user", security: "lock", listing: "home", engagement: "mail", safety: "flag", finance: "wallet", growth: "megaphone", system: "database", traffic: "eye" };

// ---------- Mise en page ----------
export const panel = (title, desc, body, right) => h("article", { class: "card panel" },
  h("div", { class: "panelhead" }, h("div", null, h("h2", null, title), desc ? h("div", { class: "desc" }, desc) : null), right ?? null), body);
export const empty = (text, icon = "search") => h("div", { class: "empty" }, ico(icon), h("p", null, text));
export const skeletons = (n = 3, hgt = 90) => h("div", { class: "stack" }, Array.from({ length: n }, () => { const e = h("div", { class: "skeleton" }); e.style.height = `${hgt}px`; return e; }));
export const errorBox = (msg, retry) => h("div", { class: "card panel stack" }, h("p", { class: "note bad" }, msg), retry ? h("div", null, h("button", { class: "btn", type: "button", onClick: retry }, ico("refresh"), "Réessayer")) : null);
export function table(cols, rows, { emptyText = "Aucune donnée." } = {}) {
  if (!rows.length) return empty(emptyText);
  return h("div", { class: "tablewrap" }, h("table", null, h("thead", null, h("tr", null, cols.map((c) => h("th", { class: c.num ? "num" : "" }, c.label)))),
    h("tbody", null, rows.map((r) => h("tr", null, cols.map((c) => h("td", { class: c.num ? "num" : "" }, c.render ? c.render(r) : r[c.key] ?? "—")))))));
}
export function bars(rows, { color = "#087448", fmt = nf } = {}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return h("div", { class: "bars" }, rows.map((r) => {
    const fill = h("div", { class: "fill" }); fill.style.width = `${(r.value / max) * 100}%`; fill.style.background = r.color ?? color;
    return h("div", { class: "barrow" }, h("span", null, r.label), h("div", { class: "track" }, fill), h("span", null, fmt(r.value)));
  }));
}

// ---------- Graphiques ----------
let gid = 0;
function niceMax(v) { if (v <= 4) return 4; const p = 10 ** Math.floor(Math.log10(v)); const m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }
function smooth(pts) {
  if (!pts.length) return "";
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1]; const [x1, y1] = pts[i]; const mx = (x0 + x1) / 2; d += `C${mx} ${y0} ${mx} ${y1} ${x1} ${y1}`; }
  return d;
}
/** Courbes en aires avec infobulle, curseur et légende cliquable. series : [{ key, name, color, values }] */
export function areaChart({ labels, series, height = 210, format = nf }) {
  const W = 720; const H = height; const L = 34; const Rr = 12; const T = 12; const B = 24;
  const wrap = h("div", { class: "chartbox" });
  const chart = h("div", { class: "chart" });
  const tip = h("div", { class: "tip" });
  const legend = h("div", { class: "legend" });
  const hidden = new Set();
  const id = `g${++gid}`;
  function draw() {
    const act = series.filter((x) => !hidden.has(x.key));
    const max = niceMax(Math.max(1, ...act.flatMap((x) => x.values)));
    const X = (i) => L + (labels.length < 2 ? 0 : (i * (W - L - Rr)) / (labels.length - 1));
    const Y = (v) => T + (H - T - B) * (1 - v / max);
    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": series.map((x) => `${x.name} : ${x.values.reduce((a, b) => a + b, 0)}`).join(" ; ") });
    const defs = s("defs");
    series.forEach((x) => defs.append(s("linearGradient", { id: `${id}${x.key}`, x1: 0, x2: 0, y1: 0, y2: 1 }, s("stop", { "stop-color": x.color, "stop-opacity": 0.28 }), s("stop", { offset: 1, "stop-color": x.color, "stop-opacity": 0 }))));
    svg.append(defs);
    for (let k = 0; k <= 4; k++) { const v = (max * k) / 4; svg.append(s("line", { class: "grid-line", x1: L, x2: W - Rr, y1: Y(v), y2: Y(v) }), s("text", { class: "axis", x: L - 6, y: Y(v) + 3, "text-anchor": "end" }, nf(Math.round(v)))); }
    const step = Math.ceil(labels.length / 8);
    labels.forEach((lb, i) => { if (i % step === 0 || i === labels.length - 1) svg.append(s("text", { class: "axis", x: X(i), y: H - 6, "text-anchor": "middle" }, lb)); });
    act.forEach((x) => {
      const pts = x.values.map((v, i) => [X(i), Y(v)]);
      const line = smooth(pts);
      svg.append(s("path", { d: `${line}L${X(labels.length - 1)} ${Y(0)}L${X(0)} ${Y(0)}Z`, fill: `url(#${id}${x.key})` }), s("path", { d: line, fill: "none", stroke: x.color, "stroke-width": 2.6, "stroke-linecap": "round", "stroke-linejoin": "round" }));
    });
    const cur = s("line", { class: "cursor", y1: T, y2: H - B, opacity: 0 });
    const dots = act.map((x) => s("circle", { r: 4.5, fill: x.color, stroke: "#fff", "stroke-width": 2, opacity: 0 }));
    const hit = s("rect", { x: L, y: 0, width: W - L - Rr, height: H, fill: "transparent" });
    svg.append(cur, ...dots, hit);
    const move = (ev) => {
      const r = svg.getBoundingClientRect(); const px = ((ev.clientX - r.left) / r.width) * W;
      const i = Math.max(0, Math.min(labels.length - 1, Math.round(((px - L) / (W - L - Rr)) * (labels.length - 1))));
      cur.setAttribute("x1", X(i)); cur.setAttribute("x2", X(i)); cur.setAttribute("opacity", 1);
      act.forEach((x, k) => { dots[k].setAttribute("cx", X(i)); dots[k].setAttribute("cy", Y(x.values[i])); dots[k].setAttribute("opacity", 1); });
      tip.replaceChildren(h("b", null, labels[i]), ...act.map((x) => h("span", null, h("em", { class: "tipname" }, h("i", { class: "tipdot" }), x.name), format(x.values[i]))));
      tip.querySelectorAll(".tipdot").forEach((d, k) => d.style.setProperty("background", act[k].color));
      tip.classList.add("on");
      const left = Math.min(r.width - 150, Math.max(0, (X(i) / W) * r.width + 12));
      tip.style.setProperty("left", `${left}px`); tip.style.setProperty("top", "6px");
    };
    hit.addEventListener("pointermove", move);
    hit.addEventListener("pointerleave", () => { cur.setAttribute("opacity", 0); dots.forEach((d) => d.setAttribute("opacity", 0)); tip.classList.remove("on"); });
    chart.replaceChildren(svg);
  }
  series.forEach((x) => {
    const b = h("button", { type: "button", "aria-pressed": "true", onClick: () => { hidden.has(x.key) ? hidden.delete(x.key) : hidden.add(x.key); b.setAttribute("aria-pressed", String(!hidden.has(x.key))); draw(); } }, h("i", { class: "dot" }), x.name);
    b.querySelector(".dot").style.setProperty("background", x.color);
    legend.append(b);
  });
  draw();
  wrap.append(chart, tip, legend);
  return wrap;
}

/** Barres empilées par jour. stacks : [{ key, name, color, values }] */
export function stackChart({ labels, stacks, height = 190 }) {
  const W = 720; const H = height; const L = 34; const T = 10; const B = 22;
  const totals = labels.map((_, i) => stacks.reduce((a, x) => a + (x.values[i] || 0), 0));
  const max = niceMax(Math.max(1, ...totals));
  const bw = (W - L - 8) / labels.length;
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `Mouvements par jour, total ${totals.reduce((a, b) => a + b, 0)}` });
  for (let k = 0; k <= 4; k++) { const y = T + (H - T - B) * (1 - k / 4); svg.append(s("line", { class: "grid-line", x1: L, x2: W - 8, y1: y, y2: y }), s("text", { class: "axis", x: L - 6, y: y + 3, "text-anchor": "end" }, nf(Math.round((max * k) / 4)))); }
  const step = Math.ceil(labels.length / 10);
  labels.forEach((lb, i) => {
    let y = H - B;
    const g = s("g");
    stacks.forEach((x) => {
      const v = x.values[i] || 0; if (!v) return;
      const hh = ((H - T - B) * v) / max; y -= hh;
      g.append(s("rect", { x: L + i * bw + bw * 0.14, y, width: Math.max(2, bw * 0.72), height: hh, rx: 2, fill: x.color }, s("title", {}, `${lb} · ${x.name} : ${v}`)));
    });
    svg.append(g);
    if (i % step === 0) svg.append(s("text", { class: "axis", x: L + i * bw + bw / 2, y: H - 6, "text-anchor": "middle" }, lb));
  });
  return h("div", { class: "chart" }, svg);
}

export function sparkline(values, color = "#087448") {
  const W = 120; const H = 42; const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [(i * W) / Math.max(1, values.length - 1), H - 4 - ((H - 10) * v) / max]);
  const line = smooth(pts); const g = `sp${++gid}`;
  const svg = s("svg", { class: "spark", viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none", "aria-hidden": "true" },
    s("defs", {}, s("linearGradient", { id: g, x1: 0, x2: 0, y1: 0, y2: 1 }, s("stop", { "stop-color": color, "stop-opacity": 0.3 }), s("stop", { offset: 1, "stop-color": color, "stop-opacity": 0 }))),
    s("path", { d: `${line}L${W} ${H}L0 ${H}Z`, fill: `url(#${g})` }), s("path", { d: line, fill: "none", stroke: color, "stroke-width": 2, "stroke-linecap": "round" }));
  return svg;
}

// ---------- Tiroir, dialogue, confirmation ----------
let drawerEl; let overlayEl;
export function openDrawer(title, ...body) {
  closeDrawer();
  overlayEl = h("div", { class: "overlay", onClick: closeDrawer });
  drawerEl = h("aside", { class: "drawer", role: "dialog", "aria-modal": "true", "aria-label": title },
    h("header", null, h("h2", null, title), h("button", { class: "iconbtn", type: "button", "aria-label": "Fermer", onClick: closeDrawer }, ico("x"))), h("div", { class: "body" }, body));
  document.body.append(overlayEl, drawerEl);
  requestAnimationFrame(() => { overlayEl.classList.add("open"); drawerEl.classList.add("open"); drawerEl.querySelector("button")?.focus(); });
}
export function closeDrawer() { drawerEl?.remove(); overlayEl?.remove(); drawerEl = overlayEl = null; }
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && drawerEl) closeDrawer(); });

/** Dialogue de formulaire. fields : [{ name, label, type, options, required, value }] → promesse de valeurs ou null. */
export function formDialog(title, fields, { submit = "Valider", intro } = {}) {
  return new Promise((resolve) => {
    const inputs = {};
    const rows = fields.map((f) => {
      const el = f.type === "select" ? h("select", { class: "input" }, f.options.map((o) => h("option", { value: o.value ?? o }, o.label ?? o)))
        : f.type === "textarea" ? h("textarea", { class: "input" }) : h("input", { class: "input", type: f.type ?? "text", maxlength: f.max ?? 200 });
      if (f.value != null) el.value = f.value;
      inputs[f.name] = el;
      return h("label", { class: "field" }, f.label, el);
    });
    const dlg = h("dialog", { "aria-label": title }, h("div", { class: "pad" }, h("h2", null, title), intro ? h("p", { class: "muted small" }, intro) : null, ...rows,
      h("div", { class: "row" }, h("button", { class: "btn primary", type: "button", onClick: () => {
        const out = {};
        for (const f of fields) { out[f.name] = inputs[f.name].value.trim(); if (f.required && !out[f.name]) { toast(`« ${f.label} » est obligatoire.`, true); return; } }
        dlg.close("ok"); resolve(out);
      } }, submit), h("button", { class: "btn", type: "button", onClick: () => dlg.close("no") }, "Annuler"))));
    dlg.addEventListener("close", () => { dlg.remove(); if (dlg.returnValue !== "ok") resolve(null); });
    document.body.append(dlg); dlg.showModal();
  });
}
export const confirmDialog = async (title, text, label = "Confirmer") => {
  const out = await formDialog(title, [], { submit: label, intro: text }); return out !== null;
};

/** Exécute une action, notifie, puis recharge la vue. */
export async function act(fn, message, reload) {
  try { await fn(); toast(message); reload?.(); } catch (e) { fail(e); }
}
