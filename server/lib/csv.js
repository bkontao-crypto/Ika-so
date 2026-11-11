// Lecture de fichiers CSV (Excel français : séparateur « ; », ou « , »), sans dépendance.
import { CATEGORIES, DOCUMENTS, ROAD_ACCESS, TRANSACTIONS, isDwelling } from "./rules.js";
import { PHOTO_PRESETS, ZONES } from "./places.js";
import { normalizeText } from "./search.js";

export const IMPORT_MAX_ROWS = 200;
export const IMPORT_MAX_BYTES = 400 * 1024;

/** Découpe le texte en lignes de cellules. Gère guillemets, guillemets doublés, retours à la ligne dans une cellule, BOM. */
export function parseCsv(text) {
  const src = String(text ?? "").replace(/^﻿/, "");
  const first = src.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (first.match(/;/g) ?? []).length >= (first.match(/,/g) ?? []).length ? ";" : ",";
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

const HEADERS = {
  titre: "title", description: "description", type: "category", categorie: "category", transaction: "transactionType",
  quartier: "neighborhood", prix: "price", superficie: "surfaceLabel", "superficie texte": "surfaceLabel",
  "superficie m2": "surfaceM2", m2: "surfaceM2", surface: "surfaceM2", acces: "roadAccess", "acces routier": "roadAccess",
  chambres: "bedrooms", "salles de bain": "bathrooms", meuble: "furnished", document: "declaredDocument",
};
export const CSV_COLUMNS = ["titre", "description", "type", "transaction", "quartier", "prix", "superficie", "superficie m2", "acces routier", "chambres", "salles de bain", "meuble", "document"];

const pick = (list, value) => list.find((x) => normalizeText(x) === normalizeText(value)) ?? "";
const intOrNull = (v) => (String(v ?? "").trim() === "" ? null : Number(String(v).replace(/[\s. ]/g, "")));

/** Transforme le CSV en annonces prêtes à valider. Renvoie { items: [{ line, input }], problems: [{ line, message }] }. */
export function csvToListings(text, { fullName = "Annonceur", ownerRole = "Agence immobilière" } = {}) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { items: [], problems: [{ line: 1, message: "Le fichier est vide ou n'a pas de ligne d'en-tête." }] };
  const map = rows[0].map((h) => HEADERS[normalizeText(h).replace(/[_-]+/g, " ")] ?? null);
  const unknown = rows[0].filter((_, i) => !map[i]).map((h) => h.trim()).filter(Boolean);
  const problems = unknown.length ? [{ line: 1, message: `Colonne(s) inconnue(s), ignorée(s) : ${unknown.join(", ")}.` }] : [];
  const required = ["title", "category", "transactionType", "neighborhood", "price"];
  const missing = required.filter((k) => !map.includes(k));
  if (missing.length) return { items: [], problems: [{ line: 1, message: `Colonnes obligatoires absentes : ${missing.join(", ")}.` }] };
  if (rows.length - 1 > IMPORT_MAX_ROWS) return { items: [], problems: [{ line: 1, message: `Trop de lignes : ${IMPORT_MAX_ROWS} au plus par fichier.` }] };

  const items = [];
  rows.slice(1).forEach((cells, index) => {
    const line = index + 2;
    const raw = {};
    map.forEach((key, i) => { if (key) raw[key] = (cells[i] ?? "").trim(); });
    const category = pick(CATEGORIES, raw.category);
    const land = category === "Terrain";
    const dwelling = isDwelling(category);
    const zone = ZONES.find((z) => normalizeText(z.name) === normalizeText(raw.neighborhood));
    const furnishedText = normalizeText(raw.furnished);
    const surfaceM2 = intOrNull(raw.surfaceM2);
    const input = {
      title: raw.title ?? "", description: raw.description ?? "", category, transactionType: pick(TRANSACTIONS, raw.transactionType),
      neighborhood: zone?.name ?? raw.neighborhood ?? "", price: intOrNull(raw.price) ?? NaN,
      surfaceLabel: raw.surfaceLabel || (surfaceM2 ? `${surfaceM2} m²` : ""), surfaceM2,
      roadAccess: land ? pick(ROAD_ACCESS, raw.roadAccess) || null : null,
      bedrooms: dwelling ? intOrNull(raw.bedrooms) : null, bathrooms: dwelling ? intOrNull(raw.bathrooms) : null,
      furnished: !dwelling ? null : furnishedText === "" ? null : ["oui", "o", "yes", "1", "vrai"].includes(furnishedText),
      declaredDocument: pick(DOCUMENTS, raw.declaredDocument) || null,
      imageUrl: (PHOTO_PRESETS[category === "Terrain" ? 0 : category === "Appartement" || category === "Studio" ? 2 : 1]).url,
      ownerRole, fullName,
    };
    input.imageUrls = [input.imageUrl];
    const bad = [];
    if (!category) bad.push(`type « ${raw.category} » inconnu (${CATEGORIES.join(", ")})`);
    if (!input.transactionType) bad.push(`transaction « ${raw.transactionType} » inconnue (${TRANSACTIONS.join(", ")})`);
    if (raw.declaredDocument && !input.declaredDocument) bad.push(`document « ${raw.declaredDocument} » inconnu (${DOCUMENTS.join(", ")})`);
    if (land && raw.roadAccess && !input.roadAccess) bad.push(`accès « ${raw.roadAccess} » inconnu (${ROAD_ACCESS.join(", ")})`);
    if (bad.length) problems.push({ line, message: bad.join(" ; ") + "." });
    items.push({ line, input });
  });
  return { items, problems };
}

/** Exemple téléchargeable : 2 lignes qui passent toutes les règles. */
export function csvTemplate() {
  const head = CSV_COLUMNS.join(";");
  const a = ["Terrain 500 m² à ACI 2000", "Parcelle plane proche du goudron, eau et électricité à proximité.", "Terrain", "Vente", "ACI 2000", "45000000", "500 m²", "500", "Goudronné", "", "", "", "Titre Foncier"].join(";");
  const b = ["Appartement 3 pièces à Hamdallaye", "Appartement lumineux au 2e étage, cuisine équipée, gardien et parking.", "Appartement", "Location", "Hamdallaye", "250000", "95 m²", "95", "", "3", "2", "oui", "Bail"].join(";");
  return `﻿${head}\n${a}\n${b}\n`;
}
