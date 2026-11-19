// Exports CSV et PDF des habitudes de connexion : mêmes chiffres que l'écran, PDF valide, export tracé au journal d'audit.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPdf, toWinAnsi, wrapText } from "../server/lib/simple-pdf.js";
import { bucketHours, weekSplit, connectionRows, connectionsToCsv, connectionsToPdf } from "../server/lib/connection-stats.js";
import { createOwnerCenter } from "../server/services/owner-center.js";
import { forbidden } from "../server/lib/errors.js";

const byHour = Array(24).fill(0); byHour[8] = 40; byHour[19] = 12;
const sample = (over = {}) => ({
  available: true, days: 30, from: "2026-10-21T00:00:00.000Z", since: "2026-11-02T00:00:00.000Z",
  totals: { logins: 52 },
  perDay: Array.from({ length: 30 }, (_, i) => ({ day: `2026-10-${String(21 + (i % 10)).padStart(2, "0")}`, logins: i, users: i % 5 })),
  byHour, peakHour: 8, buckets: bucketHours(byHour), week: weekSplit({ 1: 10, 3: 20, 6: 5 }, 22, 8), devices: { mobile: 40, desktop: 12 },
  active: { last24h: 3, last7d: 9, last30d: 20 }, inactive: { since30d: 4, since60d: 2, since90d: null, accountsWithLogin: 25 },
  neverLoggedIn: 11, accounts: 36, notes: ["Une connexion est une ouverture de session enregistrée.", "« Sans connexion enregistrée » : œuvre d'été – élève."], ...over,
});
const GEN = "2026-11-19T10:30:00.000Z";

test("PDF : en-tête, fin de fichier, table des références aux vrais décalages", () => {
  const pdf = buildPdf({ title: "Titre", sections: [{ heading: "Section", rows: [["a", "1"]] }] });
  const text = pdf.toString("latin1");
  assert.ok(text.startsWith("%PDF-1.4"));
  assert.ok(text.trimEnd().endsWith("%%EOF"));
  const start = Number(/startxref\n(\d+)\n%%EOF/.exec(text)[1]);
  assert.ok(text.slice(start).startsWith("xref"), "startxref pointe sur la table des références");
  const entries = [...text.slice(start).matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]));
  assert.ok(entries.length >= 6);
  entries.forEach((off, i) => assert.ok(text.slice(off).startsWith(`${i + 1} 0 obj`), `objet ${i + 1} au bon décalage`));
});

test("PDF : longueur déclarée du flux = longueur réelle, texte long réparti sur plusieurs pages numérotées", () => {
  const rows = Array.from({ length: 200 }, (_, i) => [`ligne ${i}`, String(i)]);
  const text = buildPdf({ title: "Long", footer: "pied", sections: [{ heading: "S", rows }] }).toString("latin1");
  const pages = (text.match(/\/Type \/Page /g) ?? []).length;
  assert.ok(pages >= 3, `plusieurs pages (${pages})`);
  assert.match(text, new RegExp(`/Count ${pages}`));
  for (const m of text.matchAll(/<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g)) assert.equal(Number(m[1]), Buffer.byteLength(m[2], "latin1"));
});

test("PDF : accents français encodés en WinAnsi, caractères inconnus remplacés, injection de parenthèses impossible (texte en hexadécimal)", () => {
  assert.deepEqual(toWinAnsi("é"), [0xe9]);
  assert.deepEqual(toWinAnsi("œ–«"), [0x9c, 0x96, 0xab]);
  assert.deepEqual(toWinAnsi("日"), [0x3f]);
  assert.deepEqual(toWinAnsi("a\nb\tc"), [0x61, 0x20, 0x62, 0x20, 0x63]);
  const text = buildPdf({ title: ") Tj ET /Evil (", sections: [] }).toString("latin1");
  assert.ok(!text.includes(") Tj ET /Evil ("));
});

test("PDF : coupe des lignes aux espaces et mot trop long coupé", () => {
  assert.deepEqual(wrapText("un deux trois", 7), ["un deux", "trois"]);
  assert.deepEqual(wrapText("abcdefghij", 4), ["abcd", "efgh", "ij"]);
  assert.deepEqual(wrapText("", 10), [""]);
});

test("PDF des connexions : généré, signature %PDF, contient titre, chiffres et définitions", () => {
  const pdf = connectionsToPdf(sample(), GEN);
  assert.ok(Buffer.isBuffer(pdf));
  const t = pdf.toString("latin1");
  assert.ok(t.startsWith("%PDF-1.4"));
  assert.ok(pdf.length > 1500);
  assert.match(t, /\/Count [1-9]/);
});

test("CSV des connexions : BOM, en-tête, mêmes lignes que le PDF, un jour = une ligne, notes présentes", () => {
  const c = sample();
  const csv = connectionsToCsv(c, GEN);
  assert.ok(csv.startsWith("﻿rubrique,libelle,valeur\r\n"));
  const lines = csv.trim().split("\r\n");
  assert.equal(lines.length, 1 + connectionRows(c, GEN).length + c.perDay.length + c.notes.length);
  assert.match(csv, /"Indicateurs","Connexions réussies sur la période","52"/);
  assert.match(csv, /"Indicateurs","Comptes sans nouvelle connexion depuis 90 jours","—"/, "valeur inconnue = tiret, jamais 0 inventé");
  assert.match(csv, /"Tranches horaires \(UTC\)","06 h – 09 h","40 \(76,9 %\)"/);
  assert.match(csv, /"Semaine et week-end","Jour le plus fréquenté","mercredi"/);
});

test("CSV : une cellule commençant par = + - @ est neutralisée (injection de formule)", () => {
  const csv = connectionsToCsv(sample({ devices: { "=CMD()": 1 }, notes: ["@SUM(A1)"] }), GEN);
  assert.match(csv, /"Appareils","'=CMD\(\)","1"/);
  assert.match(csv, /"Définitions","Note","'@SUM\(A1\)"/);
});

function fakeDb(rows = {}) {
  const run = async (sql) => {
    if (/to_char\(occurred_at/.test(sql)) return rows.perDay ?? [{ d: "2026-11-19", n: 2, u: 2 }];
    if (/extract\(hour/.test(sql)) return [{ h: 8, n: 2 }];
    if (/extract\(isodow/.test(sql)) return [{ d: 4, n: 2 }];
    if (/coalesce\(device_type/.test(sql)) return [{ t: "mobile", n: 2 }];
    if (/filter \(where occurred_at >= \$1\)/.test(sql)) return [{ d1: 2, d7: 2, d30: 2 }];
    if (/max\(occurred_at\) as last/.test(sql)) return [{ i30: 0, i60: 0, i90: 0, known: 2 }];
    if (/min\(occurred_at\) as since/.test(sql)) return [{ since: new Date("2026-11-02T00:00:00Z") }];
    if (/not exists/.test(sql)) return [{ never: 1, users: 3 }];
    return [];
  };
  return { query: run, transaction: async (fn) => fn({ query: run }) };
}
function setup(db = fakeDb()) {
  const audits = [];
  const accounts = { requireStaff: async (id) => { if (id !== "root") throw forbidden("Réservé."); return { staff_role: "SUPERADMIN" }; }, audit: async (...a) => { audits.push(a); } };
  return { audits, oc: createOwnerCenter({ db, accounts, clock: () => new Date("2026-11-19T10:30:00Z") }) };
}

test("service : export CSV, type, nom de fichier, et inscription au journal d'audit", async () => {
  const { oc, audits } = setup();
  const f = await oc.exportConnections("root", { days: 7, format: "csv" });
  assert.equal(f.type, "text/csv; charset=utf-8");
  assert.equal(f.filename, "habitudes-connexion-ika-so.csv");
  assert.match(f.body, /^﻿rubrique,libelle,valeur/);
  assert.equal(audits.length, 1);
  assert.equal(audits[0][1], "OWNER_CONNECTIONS_EXPORT");
  assert.match(audits[0][3], /CSV ; 7 jour\(s\) ; 2 connexion\(s\)/);
});

test("service : export PDF = vrai PDF, audit inscrit ; format inconnu retombe sur CSV", async () => {
  const { oc, audits } = setup();
  const f = await oc.exportConnections("root", { days: 30, format: "pdf" });
  assert.equal(f.type, "application/pdf");
  assert.equal(f.filename, "habitudes-connexion-ika-so.pdf");
  assert.ok(Buffer.isBuffer(f.body) && f.body.toString("latin1").startsWith("%PDF-1.4"));
  assert.match(audits[0][3], /^PDF/);
  const g = await oc.exportConnections("root", { format: "xlsx" });
  assert.equal(g.type, "text/csv; charset=utf-8");
});

test("service : export réservé au Super Administrateur, sans audit si refusé", async () => {
  const { oc, audits } = setup();
  await assert.rejects(() => oc.exportConnections("simple-admin", { format: "pdf" }), /Réservé/);
  assert.equal(audits.length, 0);
});

test("service : journal indisponible = export refusé proprement, rien d'inscrit", async () => {
  const db = { query: async () => { throw new Error('relation "ika_security_log" does not exist'); }, transaction: async (fn) => fn({ query: async () => [] }) };
  const { oc, audits } = setup(db);
  await assert.rejects(() => oc.exportConnections("root", { format: "pdf" }), /pas disponible/);
  assert.equal(audits.length, 0);
});

test("routes et écran : deux exports (csv, pdf) limités en fréquence, boutons présents, action d'audit libellée", () => {
  const routes = readFileSync(new URL("../server/routes/index.js", import.meta.url), "utf8");
  assert.match(routes, /for \(const format of \["csv", "pdf"\]\)/);
  assert.match(routes, /activity\/connections\.\$\{format\}/);
  assert.match(routes, /limiter\.hit\(`activity-export:\$\{userId\}`, 10, 60 \* 60_000\);\s*const file = await ownerCenter\.exportConnections/);
  const ui = readFileSync(new URL("../public/js/owner/v-activity.js", import.meta.url), "utf8");
  assert.match(ui, /connections\.csv\?days=/);
  assert.match(ui, /connections\.pdf\?days=/);
  const feed = readFileSync(new URL("../server/lib/activity-feed.js", import.meta.url), "utf8");
  assert.match(feed, /OWNER_CONNECTIONS_EXPORT: \["Export des habitudes de connexion"/);
});

// ---- PDF du journal des mouvements et des annonces (même règle : tout export CSV existe aussi en PDF) ----
import { eventsToPdf, eventsToCsv, PDF_MAX_EVENTS } from "../server/lib/activity-feed.js";
import { createStats } from "../server/services/stats.js";

const ev = (i) => ({ at: `2026-11-18T10:${String(i % 60).padStart(2, "0")}:00.000Z`, category: "listing", label: `Annonce ${i}`, actor: { id: "u1", name: "Awa" }, object: { type: "listing", id: `l${i}`, label: `Titre ${i}` } });

test("journal PDF : valide, plafonné à 500 lignes avec renvoi vers le CSV", () => {
  const events = Array.from({ length: PDF_MAX_EVENTS + 120 }, (_, i) => ev(i));
  const pdf = eventsToPdf(events, { generatedAt: GEN, total: events.length });
  const t = pdf.toString("latin1");
  assert.ok(t.startsWith("%PDF-1.4") && t.trimEnd().endsWith("%%EOF"));
  assert.ok((t.match(/\/Type \/Page /g) ?? []).length >= 8);
  const same = eventsToPdf(events.slice(0, 3), { generatedAt: GEN, total: 3 });
  assert.ok(same.length < pdf.length);
  assert.equal(PDF_MAX_EVENTS, 500);
});

test("journal : le CSV existant est inchangé (en-tête et BOM)", () => {
  assert.ok(eventsToCsv([ev(1)]).startsWith("﻿date_utc,categorie,source,evenement,code,acteur_id,acteur,objet_type,objet_id,objet,detail"));
});

test("journal : export PDF par le service, audit « PDF » inscrit, réservé au Super Administrateur", async () => {
  const run = async () => [];
  const db = { query: run, transaction: async (fn) => fn({ query: run }) };
  const audits = [];
  const accounts = { requireStaff: async (id) => { if (id !== "root") throw forbidden("Réservé."); return {}; }, audit: async (...a) => { audits.push(a); } };
  const oc = createOwnerCenter({ db, accounts, clock: () => new Date("2026-11-19T10:30:00Z") });
  const pdf = await oc.exportPdf("root", {});
  assert.ok(Buffer.isBuffer(pdf) && pdf.toString("latin1").startsWith("%PDF-1.4"));
  assert.equal(audits[0][1], "OWNER_ACTIVITY_EXPORT");
  assert.match(audits[0][3], /^PDF ; 0 ligne\(s\) sur 0/);
  await assert.rejects(() => oc.exportPdf("simple-admin", {}), /Réservé/);
  assert.equal(audits.length, 1);
});

function statsWith(rows) {
  const db = { query: async () => rows, transaction: async (fn) => fn({ query: async () => rows }) };
  const accounts = { requirePermission: async (id) => { if (id !== "root") throw forbidden("Réservé."); } };
  return createStats({ db, accounts });
}
const L = (i, title) => ({ id: `l${i}`, title, neighborhood: "ACI 2000", transaction_type: "rent", category: "house", price: 150000 + i, status: "published", created_at: new Date("2026-11-01T08:00:00Z") });

test("annonces : PDF valide ; CSV inchangé pour un titre ordinaire", async () => {
  const st = statsWith([L(1, "Villa 3 chambres"), L(2, "Studio à Hamdallaye")]);
  const pdf = await st.listingsReportPdf("root");
  assert.ok(pdf.toString("latin1").startsWith("%PDF-1.4"));
  const csv = await st.listingsReportCsv("root");
  const lines = csv.split("\n");
  assert.equal(lines[0], "id,title,neighborhood,transaction,category,price,status,created_at");
  assert.equal(lines[1], '"l1","Villa 3 chambres","ACI 2000","rent","house",150001,"published","2026-11-01T08:00:00.000Z"');
});

test("annonces : un titre commençant par = ou @ est neutralisé dans le CSV (injection de formule)", async () => {
  const csv = await statsWith([L(1, '=HYPERLINK("http://x")'), L(2, "@SUM(A1)")]).listingsReportCsv("root");
  assert.match(csv, /"l1","'=HYPERLINK\(""http:\/\/x""\)"/);
  assert.match(csv, /"l2","'@SUM\(A1\)"/);
});

test("annonces : exports refusés sans droit, et liste vide = PDF valide", async () => {
  const st = statsWith([]);
  await assert.rejects(() => st.listingsReportPdf("intrus"), /Réservé/);
  await assert.rejects(() => st.listingsReportCsv("intrus"), /Réservé/);
  assert.ok((await st.listingsReportPdf("root")).toString("latin1").startsWith("%PDF-1.4"));
});

test("routes et écrans : PDF du journal et des annonces branchés, boutons et liens présents", () => {
  const routes = readFileSync(new URL("../server/routes/index.js", import.meta.url), "utf8");
  assert.match(routes, /\/staff\/owner\/activity\/export\.pdf/);
  assert.match(routes, /limiter\.hit\(`activity-export:\$\{userId\}`, 10, 60 \* 60_000\);\s*const pdf = await ownerCenter\.exportPdf/);
  assert.match(routes, /\/staff\/owner\/listings\.pdf/);
  assert.match(readFileSync(new URL("../public/js/owner/v-activity.js", import.meta.url), "utf8"), /activity\/export\.pdf\?/);
  const mods = readFileSync(new URL("../public/js/owner/v-modules.js", import.meta.url), "utf8");
  assert.match(mods, /listings\.pdf/);
  assert.match(mods, /activity\/export\.pdf\?categories=/);
});
