// Fichiers Excel (.xlsx) sans dépendance externe.
// Écriture : classeur simple (texte en ligne, en-tête en gras, volets figés).
// Lecture : première feuille seulement, avec limites strictes (taille du fichier, taille décompressée, lignes, colonnes),
// contrôle CRC, refus des fichiers chiffrés, pour limiter les risques des fichiers piégés.
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { badRequest } from "./errors.js";

export const XLSX_MAX_BYTES = 400 * 1024;
const MAX_PART = 2 * 1024 * 1024;     // taille maximale d'une partie décompressée
const MAX_UNPACKED = 4 * 1024 * 1024; // total décompressé
const MAX_ENTRIES = 64;
export const XLSX_MAX_ROWS = 1000;
const MAX_COLS = 60;

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const invalid = () => badRequest("Fichier Excel invalide ou non pris en charge. Réenregistrez-le au format .xlsx ou utilisez le modèle.");
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;

const esc = (s) => String(s).replace(CONTROL, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const colName = (i) => { let s = ""; let n = i + 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const colIndex = (letters) => [...letters].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
const NUMBER = /^-?\d{1,15}(\.\d{1,6})?$/;

const CONTENT_TYPES = (n) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${Array.from({ length: n }, (_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
const WORKBOOK = (sheets) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name).slice(0, 31)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`;
const WORKBOOK_RELS = (n) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${Array.from({ length: n }, (_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

function sheetXml(rows, widths) {
  const cols = widths.length ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>` : "";
  const data = rows.map((row, r) => {
    const cells = row.map((v, c) => {
      const text = v == null ? "" : String(v);
      if (text === "") return "";
      const ref = `${colName(c)}${r + 1}`;
      if (r > 0 && NUMBER.test(text)) return `<c r="${ref}"><v>${text}</v></c>`;
      return `<c r="${ref}" t="inlineStr"${r === 0 ? ' s="1"' : ""}><is><t xml:space="preserve">${esc(text)}</t></is></c>`;
    }).join("");
    return `<row r="${r + 1}">${cells}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${data}</sheetData></worksheet>`;
}

function dosStamp(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: day };
}

function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  const stamp = dosStamp(new Date());
  for (const [name, data] of entries) {
    const nameBuf = Buffer.from(name, "utf8");
    const comp = deflateRawSync(data);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt16LE(stamp.time, 10); local.writeUInt16LE(stamp.date, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(8, 10);
    central.writeUInt16LE(stamp.time, 12); central.writeUInt16LE(stamp.date, 14); central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comp.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, comp);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

/** Classeur à partir de feuilles { name, rows, widths? }. Les lignes sont des tableaux de valeurs (texte ou nombre). */
export function buildXlsx(sheets) {
  const parts = [
    ["[Content_Types].xml", CONTENT_TYPES(sheets.length)],
    ["_rels/.rels", ROOT_RELS],
    ["xl/workbook.xml", WORKBOOK(sheets)],
    ["xl/_rels/workbook.xml.rels", WORKBOOK_RELS(sheets.length)],
    ["xl/styles.xml", STYLES],
    ...sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s.rows, s.widths ?? [])]),
  ];
  return zip(parts.map(([name, text]) => [name, Buffer.from(text, "utf8")]));
}

const decode = (s) => String(s).replace(/&#x([0-9a-fA-F]+);|&#(\d+);|&(lt|gt|quot|apos|amp);/g, (m, hx, dec, name) => {
  if (name) return { lt: "<", gt: ">", quot: '"', apos: "'", amp: "&" }[name];
  const cp = hx ? parseInt(hx, 16) : parseInt(dec, 10);
  return cp <= 0x10ffff ? String.fromCodePoint(cp) : "";
}).replace(CONTROL, "");

const texts = (xml) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1])).join("");
const withoutPhonetic = (xml) => xml.replace(/<rPh\b[^>]*>[\s\S]*?<\/rPh>/g, "");

function findEocd(buf) {
  const start = Math.max(0, buf.length - 22 - 0xffff);
  for (let i = buf.length - 22; i >= start; i -= 1) if (buf.readUInt32LE(i) === 0x06054b50) return i;
  throw invalid();
}

/** Lit les parties utiles de l'archive ZIP (contrôle de taille, CRC, refus du chiffrement). */
function readZip(buf) {
  const eocd = findEocd(buf);
  const count = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (count === 0xffff || cdOffset === 0xffffffff || cdSize === 0xffffffff) throw badRequest("Format Excel non pris en charge (ZIP64).");
  if (count > MAX_ENTRIES) throw badRequest("Fichier Excel trop complexe.");
  if (cdOffset + cdSize > buf.length) throw invalid();
  const wanted = (name) => name === "xl/workbook.xml" || name === "xl/_rels/workbook.xml.rels" || name === "xl/sharedStrings.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(name);
  const out = new Map();
  let total = 0;
  let p = cdOffset;
  for (let i = 0; i < count; i += 1) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw invalid();
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const csize = buf.readUInt32LE(p + 20);
    const usize = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28);
    const elen = buf.readUInt16LE(p + 30);
    const clen = buf.readUInt16LE(p + 32);
    const loff = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nlen);
    p += 46 + nlen + elen + clen;
    if (!wanted(name)) continue;
    if (flags & 1) throw badRequest("Fichier Excel protégé par un mot de passe : enregistrez-le sans mot de passe.");
    if (method !== 0 && method !== 8) throw badRequest("Compression Excel non prise en charge.");
    if (usize > MAX_PART || csize > buf.length) throw badRequest("Fichier Excel trop volumineux une fois ouvert.");
    total += usize;
    if (total > MAX_UNPACKED) throw badRequest("Fichier Excel trop volumineux une fois ouvert.");
    if (loff + 30 > buf.length || buf.readUInt32LE(loff) !== 0x04034b50) throw invalid();
    const start = loff + 30 + buf.readUInt16LE(loff + 26) + buf.readUInt16LE(loff + 28);
    if (start + csize > buf.length) throw invalid();
    const raw = buf.subarray(start, start + csize);
    const data = method === 0 ? Buffer.from(raw) : inflateRawSync(raw, { maxOutputLength: MAX_PART });
    if (data.length !== usize || crc32(data) !== crc) throw invalid();
    out.set(name, data);
  }
  return out;
}

function sharedStrings(xml) {
  if (!xml) return [];
  return [...xml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map((m) => texts(withoutPhonetic(m[1])));
}

function cellText(attrs, inner, sst) {
  const t = /\bt="([^"]+)"/.exec(attrs)?.[1] ?? "n";
  const raw = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
  if (t === "s") return sst[Number(raw)] ?? "";
  if (t === "inlineStr") return texts(withoutPhonetic(inner));
  if (t === "b") return raw === "1" ? "oui" : raw === "0" ? "non" : "";
  if (t === "e") return "";
  if (raw === undefined) return "";
  if (t === "n" && /e/i.test(raw) && Number.isFinite(Number(raw))) return String(Number(raw)); // notation scientifique
  return decode(raw).trim();
}

function parseSheet(xml, sst) {
  const rows = [];
  for (const rm of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const r = Number(/\br="(\d+)"/.exec(rm[1])?.[1] ?? rows.length + 1);
    if (r > XLSX_MAX_ROWS) throw badRequest(`Trop de lignes : ${XLSX_MAX_ROWS} au plus par fichier.`);
    while (rows.length < r - 1) rows.push([]);
    const row = [];
    for (const cm of (rm[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = /\br="([A-Z]+)\d+"/.exec(cm[1]);
      const col = ref ? colIndex(ref[1]) : row.length;
      if (col >= MAX_COLS) throw badRequest(`Trop de colonnes : ${MAX_COLS} au plus.`);
      row[col] = cellText(cm[1], cm[2] ?? "", sst);
    }
    rows.push(Array.from(row, (v) => v ?? ""));
  }
  return rows;
}

/** Lignes (tableau de tableaux de texte) de la première feuille d'un fichier .xlsx. Lève une erreur 400 si le fichier est invalide. */
export function readXlsxRows(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) throw invalid();
  if (buffer.length > XLSX_MAX_BYTES) throw badRequest("Fichier trop volumineux (400 Ko au plus).");
  const parts = readZip(buffer);
  const workbook = parts.get("xl/workbook.xml");
  if (!workbook) throw invalid();
  const rels = parts.get("xl/_rels/workbook.xml.rels")?.toString("utf8") ?? "";
  const rid = /<sheet\b[^>]*\br:id="([^"]+)"/.exec(workbook.toString("utf8"))?.[1];
  let target = null;
  if (rid) {
    for (const rel of rels.matchAll(/<Relationship\b[^>]*>/g)) {
      if (new RegExp(`\\bId="${rid.replace(/[^\w]/g, "\\$&")}"`).test(rel[0])) target = /\bTarget="([^"]+)"/.exec(rel[0])?.[1] ?? null;
    }
  }
  let sheetPath = target ? (target.startsWith("/") ? target.slice(1) : `xl/${target}`) : null;
  if (!sheetPath || !parts.has(sheetPath)) {
    sheetPath = [...parts.keys()].filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort()[0];
  }
  if (!sheetPath) throw invalid();
  return parseSheet(parts.get(sheetPath).toString("utf8"), sharedStrings(parts.get("xl/sharedStrings.xml")?.toString("utf8")));
}
