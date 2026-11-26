import { brand, brandUpper } from "./brand.js";
// Générateur de PDF sans dépendance, aux couleurs de la marque Ika Sô (vert forêt, vert feuille, doré).
// A4, plusieurs pages, accents français (WinAnsi), polices Helvetica mesurées (alignements et coupures exacts).
// Éléments : bandeau de titre, cartes d'indicateurs (KPI), graphiques en barres, lignes « libellé / valeur » à fond alterné,
// tableaux à en-tête répété et couleurs par ligne, encadrés de notes, pied de page « Page n / N ». Pas d'images ni de polices intégrées.

const W = 595; const H = 842; const ML = 40; const MR = 40; const CW = W - ML - MR; const BOTTOM = 62;

export const PALETTE = Object.freeze({
  forest: [11, 42, 29], leaf: [18, 115, 75], gold: [232, 178, 58], soft: [227, 239, 230], ink: [20, 32, 26], muted: [92, 106, 98],
  line: [222, 226, 216], paper: [247, 244, 236], zebra: [246, 248, 245], white: [255, 255, 255], danger: [179, 38, 30], warn: [180, 83, 9], info: [37, 99, 235],
});
const P = PALETTE;
const TONES = { ok: P.leaf, good: P.leaf, success: P.leaf, warn: P.warn, bad: P.danger, danger: P.danger, info: P.info, neutral: P.muted, muted: P.muted, brand: P.forest, gold: P.gold };
const toneColor = (t) => TONES[t] ?? null;

// ---- Texte : WinAnsi et largeurs Helvetica (32 à 126) ----
const REG = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015,
  667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333,
  556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const BOLD = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975,
  722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333,
  556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];
const SPECIAL = new Map([["œ", [944, 944]], ["Œ", [1000, 1000]], ["«", [556, 556]], ["»", [556, 556]], ["–", [556, 556]], ["—", [1000, 1000]], ["…", [1000, 1000]], ["’", [222, 278]], ["‘", [222, 278]], ["“", [333, 500]], ["”", [333, 500]], ["€", [556, 556]], ["·", [278, 278]], ["°", [400, 400]], [" ", [278, 278]], [" ", [278, 278]]]);
const WIN_ANSI = new Map([["–", 0x96], ["—", 0x97], ["’", 0x92], ["‘", 0x91], ["“", 0x93], ["”", 0x94], ["…", 0x85], ["€", 0x80], ["œ", 0x9c], ["Œ", 0x8c], [" ", 0x20], [" ", 0xa0]]);

/** Texte JavaScript -> octets WinAnsi (caractères inconnus remplacés par « ? »). Les retours à la ligne et tabulations deviennent des espaces. */
export function toWinAnsi(value) {
  const out = [];
  for (const ch of String(value ?? "").replace(/[\r\n\t]+/g, " ")) {
    const code = ch.codePointAt(0);
    if (WIN_ANSI.has(ch)) out.push(WIN_ANSI.get(ch));
    else if (code >= 0x20 && code <= 0x7e) out.push(code);
    else if (code >= 0xa0 && code <= 0xff) out.push(code);
    else out.push(0x3f);
  }
  return out;
}
const hex = (bytes) => `<${bytes.map((b) => b.toString(16).padStart(2, "0")).join("")}>`;

function charWidth(ch, bold) {
  const t = bold ? BOLD : REG; const code = ch.codePointAt(0);
  if (code >= 32 && code <= 126) return t[code - 32];
  const sp = SPECIAL.get(ch); if (sp) return sp[bold ? 1 : 0];
  const base = ch.normalize("NFD")[0]; const bc = base?.codePointAt(0);
  return bc >= 32 && bc <= 126 ? t[bc - 32] : 556;
}
/** Largeur d'un texte en points (police Helvetica, grasse ou non). */
export function measure(str, size, bold = false) { let w = 0; for (const ch of String(str ?? "").replace(/[\r\n\t]+/g, " ")) w += charWidth(ch, bold); return (w * size) / 1000; }
/** Coupe un texte trop large et ajoute « … ». */
export function fit(str, size, bold, maxW) {
  const s = String(str ?? "").replace(/[\r\n\t]+/g, " ");
  if (measure(s, size, bold) <= maxW) return s;
  let out = s; while (out.length > 1 && measure(`${out}…`, size, bold) > maxW) out = out.slice(0, -1);
  return `${out.trimEnd()}…`;
}
/** Coupe un texte en lignes d'au plus `max` caractères, aux espaces ; un mot trop long est coupé. */
export function wrapText(text, max) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  const lines = []; let cur = "";
  for (let w of words) {
    while (w.length > max) { if (cur) { lines.push(cur); cur = ""; } lines.push(w.slice(0, max)); w = w.slice(max); }
    if (!cur) cur = w; else if (cur.length + 1 + w.length <= max) cur += ` ${w}`; else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}
/** Coupe un texte en lignes d'une largeur maximale en points. */
export function wrapWidth(text, size, bold, maxW) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  const lines = []; let cur = "";
  for (const word of words) {
    let w = word;
    while (measure(w, size, bold) > maxW && w.length > 1) { let k = w.length - 1; while (k > 1 && measure(w.slice(0, k), size, bold) > maxW) k--; if (cur) { lines.push(cur); cur = ""; } lines.push(w.slice(0, k)); w = w.slice(k); }
    if (!cur) cur = w; else if (measure(`${cur} ${w}`, size, bold) <= maxW) cur += ` ${w}`; else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

// ---- Dates (UTC, format français) ----
const two = (n) => String(n).padStart(2, "0");
const toDate = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? null : d; };
export const fmtDate = (iso) => { const d = toDate(iso); return d ? `${two(d.getUTCDate())}/${two(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}` : ""; };
export const fmtDateTime = (iso) => { const d = toDate(iso); return d ? `${fmtDate(iso)} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}` : ""; };
export const fmtLong = (iso) => { const d = toDate(iso); return d ? `${fmtDate(iso)} à ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}` : ""; };
/** Nombre à la française (espace de milliers). */
export const fmtNumber = (v) => (v == null || Number.isNaN(Number(v)) ? "—" : Number(v).toLocaleString("fr-FR"));

const num = (v) => String(Math.round(v * 100) / 100);
const rgb = (c) => `${num(c[0] / 255)} ${num(c[1] / 255)} ${num(c[2] / 255)}`;
const niceMax = (m) => { if (m <= 0) return 1; const p = 10 ** Math.floor(Math.log10(m)); const n = m / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };
const cellOf = (c) => (c !== null && typeof c === "object" && !(c instanceof Date) ? { t: c.t, c: toneColor(c.c) ?? c.c, b: c.b } : { t: c, c: null, b: false });

/**
 * doc : { eyebrow?, title, subtitle?, footer?, generatedAt?, sections: [{ heading, caption?, blocks?: [...] | kpis?, chart?, rows?, table?, notes?/paragraphs? }] }
 *  - kpis  : { items: [{ label, value, sub?, tone? }], cols? }  ou simple tableau d'items
 *  - chart : { values, labels, highlight?, height?, labelEvery?, xTitle? }
 *  - rows  : [[libellé, valeur | { t, c }], ...]
 *  - table : { head, rows, widths?: [largeurs relatives], align?: ['l' | 'r' | 'c', ...] } ; une cellule peut être { t, c: 'ok'|'warn'|'bad'|'info'|'muted', b }
 *  - notes : [texte, ...] (encadré)
 * Retourne un Buffer PDF valide (table des références avec les vrais décalages).
 */
const pdfName = () => brand().replace(/[()\\]/g, "");
export function buildPdf(doc) {
  const pages = []; let ops = []; let y = H;
  const startPage = (first) => {
    ops = []; pages.push(ops); y = H;
    if (first) {
      const sub = doc.subtitle ? wrapWidth(doc.subtitle, 8.5, false, CW) : [];
      const band = 82 + Math.max(0, sub.length - 1) * 11.5 + (sub.length ? 18 : 6);
      rect(0, H - band, W, band, P.forest); rect(0, H - band - 4, W, 4, P.gold);
      txt(ML, H - 30, String(doc.eyebrow ?? brandUpper()).toUpperCase(), 8, { bold: true, color: P.gold, spacing: 1.6 });
      txt(W - MR, H - 30, "CONFIDENTIEL", 7, { bold: true, color: P.gold, spacing: 1.4, align: "r" });
      let size = 22; while (size > 14 && measure(doc.title ?? "", size, true) > CW) size -= 1;
      txt(ML, H - 58, doc.title ?? "", size, { bold: true, color: P.white });
      sub.forEach((l, i) => txt(ML, H - 76 - i * 11.5, l, 8.5, { color: [201, 221, 209] }));
      y = H - band - 4 - 24;
    } else {
      txt(ML, H - 30, brandUpper(), 8.5, { bold: true, color: P.forest, spacing: 1.2 });
      txt(W - MR, H - 30, fit(doc.title ?? "", 8, false, CW - 90), 8, { color: P.muted, align: "r" });
      line(ML, H - 38, W - MR, H - 38, P.line, 0.6); rect(ML, H - 39.5, 30, 2.4, P.gold);
      y = H - 62;
    }
  };
  function rect(x, yy, w, h, c) { ops.push(`${rgb(c)} rg ${num(x)} ${num(yy)} ${num(w)} ${num(h)} re f`); }
  function box(x, yy, w, h, fill, stroke) { ops.push(`${rgb(fill)} rg ${rgb(stroke)} RG 0.6 w ${num(x)} ${num(yy)} ${num(w)} ${num(h)} re B`); }
  function line(x1, y1, x2, y2, c, wd = 0.5) { ops.push(`${rgb(c)} RG ${num(wd)} w ${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l S`); }
  function txt(x, base, s, size, o = {}) {
    const bold = !!o.bold; let px = x; const w = measure(s, size, bold) + (o.spacing ?? 0) * String(s).length;
    if (o.align === "r") px = x - w; else if (o.align === "c") px = x - w / 2;
    ops.push(`BT /${bold ? "F2" : "F1"} ${num(size)} Tf ${num(o.spacing ?? 0)} Tc ${rgb(o.color ?? P.ink)} rg ${num(px)} ${num(base)} Td ${hex(toWinAnsi(s))} Tj ET`);
  }
  const need = (h) => { if (y - h < BOTTOM) startPage(false); };

  function heading(text, caption) {
    need(caption ? 74 : 62); y -= 8;
    rect(ML, y - 13, 4, 16, P.leaf); txt(ML + 12, y - 9.5, text, 12.5, { bold: true, color: P.forest });
    line(ML, y - 19, W - MR, y - 19, P.line, 0.7); y -= 27;
    if (caption) { for (const l of wrapWidth(caption, 8, false, CW)) { txt(ML, y - 6, l, 8, { color: P.muted }); y -= 11; } y -= 3; }
  }
  function kpis(spec) {
    const items = Array.isArray(spec) ? spec : spec.items; const n = items.length; if (!n) return;
    const per = spec.cols ?? (n <= 4 ? n : n % 3 === 0 ? 3 : 4); const gap = 10; const cw = (CW - gap * (per - 1)) / per; const ch = 62;
    items.forEach((k, i) => {
      const col = i % per; if (col === 0) need(ch + 8);
      const x = ML + col * (cw + gap); const tone = toneColor(k.tone) ?? P.leaf;
      box(x, y - ch, cw, ch, P.white, P.line); rect(x, y - 3.2, cw, 3.2, tone);
      const lab = String(k.label ?? "").toUpperCase(); txt(x + 10, y - 18, fit(lab, 6.6, true, cw - 18 - lab.length * 0.3), 6.6, { bold: true, color: P.muted, spacing: 0.3 });
      let size = 19; const val = String(k.value ?? "—"); while (size > 10 && measure(val, size, true) > cw - 20) size -= 1;
      txt(x + 10, y - 40, val, size, { bold: true, color: toneColor(k.tone) ?? P.forest });
      if (k.sub) txt(x + 10, y - 53, fit(k.sub, 6.8, false, cw - 18), 6.8, { color: P.muted });
      if (col === per - 1 || i === n - 1) y -= ch + 10;
    });
    y -= 2;
  }
  function chart(c) {
    const values = (c.values ?? []).map((v) => Math.max(0, Number(v) || 0)); const n = values.length; if (!n) return;
    const hgt = c.height ?? 128; need(hgt + 8); const top = y;
    const left = ML + 36; const plotW = CW - 36 - 10; const base = top - hgt + (c.xTitle ? 32 : 24); const plotTop = top - 16; const plotH = plotTop - base;
    box(ML, top - hgt, CW, hgt, P.white, P.line);
    const nm = Math.max(2, niceMax(Math.max(0, ...values)));
    for (const k of [0, 0.5, 1]) {
      const gy = base + plotH * k; line(left, gy, left + plotW, gy, k === 0 ? [170, 178, 170] : P.line, k === 0 ? 0.8 : 0.4);
      const v = nm * k; if (Number.isInteger(v)) txt(left - 6, gy - 2.4, fmtNumber(v), 6.5, { align: "r", color: P.muted });
    }
    const slot = plotW / n; const bw = Math.min(slot * 0.66, 24); const every = c.labelEvery ?? Math.ceil(n / 16);
    values.forEach((v, i) => {
      const bh = v > 0 ? Math.max(1.4, (v / nm) * plotH) : 0; const x = left + i * slot + (slot - bw) / 2; const hi = i === c.highlight;
      if (bh > 0) rect(x, base, bw, bh, hi ? P.gold : P.leaf);
      if (hi && v > 0) txt(x + bw / 2, base + bh + 3.2, fmtNumber(v), 7.5, { bold: true, color: P.forest, align: "c" });
      if (i % every === 0 && c.labels?.[i] != null) txt(left + i * slot + slot / 2, base - 10, String(c.labels[i]), 6.5, { color: P.muted, align: "c" });
    });
    if (c.xTitle) txt(left + plotW / 2, base - 21, c.xTitle, 6.8, { color: P.muted, align: "c" });
    y = top - hgt - 12;
  }
  function rows(list) {
    list.forEach(([label, value], i) => {
      const v = cellOf(value); const lines = wrapWidth(label, 9.5, false, CW * 0.6 - 16); const h = lines.length * 12.5 + 7;
      need(h); if (i % 2 === 0) rect(ML, y - h, CW, h, P.zebra);
      lines.forEach((l, k) => txt(ML + 8, y - 12 - k * 12.5, l, 9.5, { color: [51, 65, 58] }));
      txt(W - MR - 8, y - 12, fit(v.t ?? "", 9.5, true, CW * 0.38), 9.5, { bold: true, color: v.c ?? P.forest, align: "r" });
      y -= h;
    });
    line(ML, y, W - MR, y, P.line, 0.6); y -= 12;
  }
  function table(t) {
    const cols = t.head.length; const rel = Array.isArray(t.widths) && t.widths.length === cols ? t.widths : Array(cols).fill(1); const sum = rel.reduce((a, b) => a + b, 0);
    const widths = rel.map((w) => (w / sum) * CW); const starts = widths.map((_, i) => ML + widths.slice(0, i).reduce((a, b) => a + b, 0));
    const align = t.align ?? []; const pad = 6;
    const put = (i, s, size, o) => { const a = align[i] ?? "l"; const text = fit(s, size, !!o.bold, widths[i] - 2 * pad); a === "r" ? txt(starts[i] + widths[i] - pad, o.base, text, size, { ...o, align: "r" }) : a === "c" ? txt(starts[i] + widths[i] / 2, o.base, text, size, { ...o, align: "c" }) : txt(starts[i] + pad, o.base, text, size, o); };
    const head = () => { rect(ML, y - 19, CW, 19, P.forest); t.head.forEach((h, i) => put(i, String(h), 7.8, { bold: true, color: P.white, base: y - 12.5 })); y -= 19; };
    if (y - 19 - 17 < BOTTOM) startPage(false);
    head();
    t.rows.forEach((r, i) => {
      if (y - 17 < BOTTOM) { startPage(false); head(); }
      if (i % 2 === 1) rect(ML, y - 17, CW, 17, P.zebra);
      r.forEach((c, k) => { const v = cellOf(c); put(k, String(v.t ?? ""), 8.3, { bold: !!v.b, color: v.c ?? P.ink, base: y - 11.8 }); });
      line(ML, y - 17, W - MR, y - 17, [236, 238, 232], 0.4); y -= 17;
    });
    y -= 12;
  }
  function notes(list) {
    const lines = []; list.forEach((t, i) => { lines.push(...wrapWidth(t, 8.3, false, CW - 28)); if (i < list.length - 1) lines.push(null); });
    const h = lines.reduce((a, l) => a + (l === null ? 4 : 11.5), 0) + 18; need(h);
    rect(ML, y - h, CW, h, P.paper); rect(ML, y - h, 4, h, P.gold);
    let yy = y - 14; for (const l of lines) { if (l === null) { yy -= 4; continue; } txt(ML + 16, yy, l, 8.3, { color: [66, 80, 72] }); yy -= 11.5; }
    y -= h + 12;
  }
  const run = (b) => { if (b.kpis) kpis(b.kpis); if (b.chart) chart(b.chart); if (b.rows) rows(b.rows); if (b.table) table(b.table); if (b.notes || b.paragraphs) notes(b.notes ?? b.paragraphs); };

  startPage(true);
  for (const s of doc.sections ?? []) {
    if (s.heading) heading(s.heading, s.caption);
    if (s.blocks) for (const b of s.blocks) run(b); else run(s);
  }

  // Pieds de page : ajoutés après coup pour connaître le nombre total de pages.
  const total = pages.length; const footer = doc.footer ?? brand() + " · document confidentiel";
  const streams = pages.map((p, i) => {
    ops = p; line(ML, 50, W - MR, 50, P.line, 0.6);
    txt(ML, 37, fit(footer, 7.5, false, CW - 90), 7.5, { color: P.muted }); txt(W - MR, 37, `Page ${i + 1} / ${total}`, 7.5, { bold: true, color: P.forest, align: "r" });
    return p.join("\n");
  });

  // Objets : 1 catalogue, 2 pages, 3 police normale, 4 police grasse, puis (page, contenu) par page, enfin le descripteur du document.
  const objects = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pages.map((_, i) => `${5 + i * 2} 0 R`).join(" ")}] /Count ${total} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  streams.forEach((s, i) => {
    objects[5 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Contents ${6 + i * 2} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>`;
    objects[6 + i * 2] = `<< /Length ${Buffer.byteLength(s, "latin1")} >>\nstream\n${s}\nendstream`;
  });
  const infoNo = 5 + pages.length * 2;
  const utf16 = (str) => `<FEFF${[...String(str)].map((ch) => ch.charCodeAt(0).toString(16).padStart(4, "0")).join("")}>`;
  const when = toDate(doc.generatedAt); const stamp = when ? `/CreationDate (D:${when.getUTCFullYear()}${two(when.getUTCMonth() + 1)}${two(when.getUTCDate())}${two(when.getUTCHours())}${two(when.getUTCMinutes())}${two(when.getUTCSeconds())}Z) ` : "";
  objects[infoNo] = `<< /Title ${utf16(doc.title ?? "Rapport")} /Author (${pdfName()}) /Creator (${pdfName()}) /Producer (${pdfName()}) ${stamp}>>`;

  const parts = [Buffer.from("%PDF-1.4\n", "latin1")]; const offsets = []; let pos = parts[0].length;
  for (let n = 1; n < objects.length; n++) {
    offsets[n] = pos;
    const b = Buffer.from(`${n} 0 obj\n${objects[n]}\nendobj\n`, "latin1"); parts.push(b); pos += b.length;
  }
  const xref = [`xref\n0 ${objects.length}\n0000000000 65535 f \n`];
  for (let n = 1; n < objects.length; n++) xref.push(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  parts.push(Buffer.from(`${xref.join("")}trailer\n<< /Size ${objects.length} /Root 1 0 R /Info ${infoNo} 0 R >>\nstartxref\n${pos}\n%%EOF\n`, "latin1"));
  return Buffer.concat(parts);
}
