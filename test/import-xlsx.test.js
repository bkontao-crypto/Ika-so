// Import Excel (.xlsx) : écriture du modèle, lecture sécurisée, pipeline commun avec le CSV, droit d'import. Sans base de données.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildXlsx, readXlsxRows, XLSX_MAX_BYTES } from "../server/lib/xlsx.js";
import { CSV_COLUMNS, rowsToListings, parseCsv, csvTemplate } from "../server/lib/csv.js";
import { createImports } from "../server/services/imports.js";

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
const imports = (accounts, db = { query: async () => [] }) => createImports({ db }, accounts, { create: async () => ({ similarCount: 0 }) });

test("aller-retour : accents, guillemets, point-virgule, retour à la ligne, nombres, cellules vides", () => {
  const rows = [["titre", "description", "prix"], ['Maison « Ouest » ; 3 pièces', "Ligne 1\nLigne 2 & <fin>", "45000000"], ["", "é à ç", "1.5"]];
  const back = readXlsxRows(buildXlsx([{ name: "Annonces", rows }, { name: "Aide", rows: [["x"]] }]));
  assert.deepEqual(back, [["titre", "description", "prix"], ['Maison « Ouest » ; 3 pièces', "Ligne 1\nLigne 2 & <fin>", "45000000"], ["", "é à ç", "1.5"]]);
});

test("modèle Excel : première feuille = en-têtes CSV + 2 exemples valides, aucune erreur au contrôle", () => {
  const svc = imports({});
  const rows = readXlsxRows(svc.modeleXlsx());
  assert.deepEqual(rows[0], CSV_COLUMNS);
  assert.equal(rows.length, 3);
  const out = rowsToListings(rows, { fullName: "Test", ownerRole: "Agence" });
  assert.equal(out.items.length, 2);
  assert.deepEqual(out.problems, []);
  assert.deepEqual(out.items.map((i) => i.line), [2, 3]);
});

test("numéros de ligne : ceux de la feuille Excel, même avec lignes vides avant ou entre les annonces", () => {
  const [h, a, b] = parseCsv(csvTemplate());
  const rows = [h, [], a, [], [], b];
  const out = rowsToListings(rows, {});
  assert.deepEqual(out.items.map((i) => i.line), [3, 6]);
});

test("fichier produit par openpyxl (chaînes partagées, nombres, booléens) : lu correctement", () => {
  const rows = readXlsxRows(fixture("import-openpyxl.xlsx"));
  assert.deepEqual(rows[0], ["titre", "prix", "quartier", "chambres", "meuble"]);
  assert.deepEqual(rows[1], ["Maison à Hamdallaye – 3 chambres", "45000000", "ACI 2000", "3", "oui"]);
  assert.equal(rows[2][0], 'Terrain "Titre foncier"; zone');
  assert.equal(rows[2][1], "15000000");
});

test("fichiers refusés : non ZIP, trop volumineux, chiffré, compression inconnue, taille décompressée excessive", () => {
  const good = buildXlsx([{ name: "Annonces", rows: [["titre"], ["x"]] }]);
  assert.throws(() => readXlsxRows(Buffer.from("ceci n'est pas un fichier Excel")), /Fichier Excel invalide/);
  assert.throws(() => readXlsxRows(Buffer.alloc(XLSX_MAX_BYTES + 1)), /trop volumineux/);

  const cd = good.lastIndexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  const encrypted = Buffer.from(good); encrypted.writeUInt16LE(encrypted.readUInt16LE(cd + 8) | 1, cd + 8);
  assert.throws(() => readXlsxRows(encrypted), /mot de passe/);

  const method = Buffer.from(good); method.writeUInt16LE(12, cd + 10);
  assert.throws(() => readXlsxRows(method), /Compression/);

  const bomb = Buffer.from(good); bomb.writeUInt32LE(50 * 1024 * 1024, cd + 24);
  assert.throws(() => readXlsxRows(bomb), /trop volumineux une fois ouvert/);

  const crc = Buffer.from(good); crc.writeUInt32LE(0x12345678, cd + 16);
  assert.throws(() => readXlsxRows(crc), /Fichier Excel invalide/);
});

test("droit d'import : téléphone non vérifié refusé, statut explicite, import à blanc accepté", async () => {
  const noPhone = imports({ assertCanPublishListing: async () => ({ phone_verified_at: null, full_name: "A", display_role: "Agence" }) });
  await assert.rejects(() => noPhone.assertCanImport("u1"), /Vérifiez votre numéro/);
  assert.deepEqual(await noPhone.importStatus("u1").then((s) => ({ canImport: s.canImport })), { canImport: false });

  const refused = imports({ assertCanPublishListing: async () => { const e = new Error("Vous devez d'abord être approuvé comme annonceur."); throw e; } });
  const status = await refused.importStatus("u2");
  assert.equal(status.canImport, false);
  assert.match(status.reason, /approuvé comme annonceur/);

  const ok = imports({ assertCanPublishListing: async () => ({ phone_verified_at: new Date(), full_name: "A", display_role: "Agence" }) });
  assert.deepEqual(await ok.importStatus("u3"), { canImport: true, reason: null });
  const report = await ok.importXlsx("u3", buildXlsx([{ name: "Annonces", rows: parseCsv(csvTemplate()) }]), { dryRun: true });
  assert.equal(report.total, 2);
  assert.equal(report.created, 0);
  assert.deepEqual(report.errors, []);
});
