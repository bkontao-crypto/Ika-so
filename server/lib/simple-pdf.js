// Générateur de PDF minimal, sans dépendance : texte seul, A4, plusieurs pages, accents français (WinAnsi), pied de page numéroté.
// Suffisant pour des rapports chiffrés (titres, lignes « libellé : valeur », tableaux de texte). Pas d'images ni de graphiques.

const PAGE_W = 595; const PAGE_H = 842; const MARGIN = 50; const LINE = 14;
const TOP = PAGE_H - MARGIN; const BOTTOM = MARGIN + 20;
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

/**
 * doc : { title, subtitle?, footer?, sections: [{ heading, rows?: [[libellé, valeur], ...], table?: { head: [...], rows: [[...], ...], widths?: [largeurs relatives] }, paragraphs?: [texte, ...] }] }
 * Dans un tableau, un texte trop long pour sa colonne est coupé : le CSV reste la version complète.
 * Retourne un Buffer PDF valide (table des références avec les vrais décalages).
 */
export function buildPdf(doc) {
  const pages = []; let ops = []; let y = TOP;
  const newPage = () => { if (ops.length) pages.push(ops); ops = []; y = TOP; };
  const text = (x, size, bold, str) => ops.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td ${hex(toWinAnsi(str))} Tj ET`);
  const need = (lines) => { if (y - lines * LINE < BOTTOM) newPage(); };
  const advance = (n = 1) => { y -= n * LINE; };

  text(MARGIN, 16, true, doc.title ?? ""); advance(1.6);
  if (doc.subtitle) { for (const l of wrapText(doc.subtitle, 100)) { text(MARGIN, 9, false, l); advance(0.9); } advance(0.6); }

  for (const s of doc.sections ?? []) {
    need(3); advance(0.4); text(MARGIN, 12, true, s.heading ?? ""); advance(1.3);
    for (const [label, value] of s.rows ?? []) {
      const left = wrapText(label, 52); const right = wrapText(value, 40);
      const n = Math.max(left.length, right.length);
      need(n);
      for (let i = 0; i < n; i++) { if (left[i]) text(MARGIN, 10, false, left[i]); if (right[i]) text(MARGIN + 300, 10, false, right[i]); advance(); }
    }
    if (s.table) {
      const cols = s.table.head.length; const usable = PAGE_W - 2 * MARGIN;
      const rel = Array.isArray(s.table.widths) && s.table.widths.length === cols ? s.table.widths : Array(cols).fill(1);
      const sum = rel.reduce((a, b) => a + b, 0);
      const widths = rel.map((w) => Math.floor((w / sum) * usable));
      const starts = widths.map((_, i) => MARGIN + widths.slice(0, i).reduce((a, b) => a + b, 0));
      const cell = (row, bold) => { need(1); row.forEach((c, i) => text(starts[i], 8, bold, String(c ?? "").slice(0, Math.max(4, Math.floor(widths[i] / 4.4) - 1)))); advance(0.95); };
      cell(s.table.head, true);
      for (const r of s.table.rows) cell(r, false);
    }
    for (const p of s.paragraphs ?? []) { const ls = wrapText(p, 98); need(ls.length); for (const l of ls) { text(MARGIN, 9, false, l); advance(0.9); } advance(0.3); }
  }
  if (ops.length || !pages.length) pages.push(ops);

  // Pieds de page (numéro de page) : ajoutés après coup pour connaître le total.
  const total = pages.length;
  const footer = doc.footer ?? "";
  const streams = pages.map((p, i) => `${p.join("\n")}\nBT /F1 8 Tf ${MARGIN} ${MARGIN - 20} Td ${hex(toWinAnsi(`${footer}${footer ? " - " : ""}page ${i + 1}/${total}`))} Tj ET`);

  // Objets : 1 catalogue, 2 pages, 3 police normale, 4 police grasse, puis (page, contenu) par page.
  const objects = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pages.map((_, i) => `${5 + i * 2} 0 R`).join(" ")}] /Count ${total} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  streams.forEach((s, i) => {
    objects[5 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${6 + i * 2} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>`;
    objects[6 + i * 2] = `<< /Length ${Buffer.byteLength(s, "latin1")} >>\nstream\n${s}\nendstream`;
  });

  const parts = [Buffer.from("%PDF-1.4\n", "latin1")]; const offsets = []; let pos = parts[0].length;
  for (let n = 1; n < objects.length; n++) {
    offsets[n] = pos;
    const b = Buffer.from(`${n} 0 obj\n${objects[n]}\nendobj\n`, "latin1"); parts.push(b); pos += b.length;
  }
  const xref = [`xref\n0 ${objects.length}\n0000000000 65535 f \n`];
  for (let n = 1; n < objects.length; n++) xref.push(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  parts.push(Buffer.from(`${xref.join("")}trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF\n`, "latin1"));
  return Buffer.concat(parts);
}
