// « Importer en masse » : modèle Excel à remplir, choix du fichier (.xlsx ou .csv), contrôle à blanc, import tout ou rien.
// Utilisé dans « Mon profil > Mes annonces » et sur l'espace agence. Le droit d'importer est vérifié par le serveur (GET /api/me/import/statut).
import { api, fail, h, mount, toast } from "/js/dom.js";

const MAX_BYTES = 400 * 1024;

/** Excel enregistre parfois en Windows-1252 : si le texte UTF-8 contient des caractères cassés, on relit autrement. */
async function readCsv(file) {
  const buffer = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  return utf8.includes("�") ? new TextDecoder("windows-1252").decode(buffer) : utf8;
}

/** Fichier .xlsx encodé en base64 (le serveur le décode). */
async function toBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Téléchargement du modèle Excel (requête authentifiée : le serveur refuse si le droit d'importer manque). */
async function downloadModel() {
  const response = await fetch("/api/me/import/modele.xlsx", { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error ?? "Modèle indisponible pour ce compte.");
  }
  const url = URL.createObjectURL(await response.blob());
  const a = h("a", { href: url, download: "modele-import-ika-so.xlsx" });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function bulkImportBlock({ onImported } = {}) {
  const report = h("div", { class: "stack", "aria-live": "polite" });
  const status = h("p", { class: "small muted", role: "status" }, "Vérification de votre droit d'import…");
  let payload = null; // { kind: "xlsx" | "csv", value }
  const fileInput = h("input", { class: "input", type: "file", accept: ".xlsx,.csv,text/csv", "aria-label": "Fichier Excel ou CSV à importer", disabled: true, onChange: async (e) => {
    const f = e.target.files?.[0];
    payload = null;
    if (!f) return;
    if (f.size > MAX_BYTES) { mount(report, h("p", { class: "banner", role: "alert" }, "Fichier trop volumineux (400 Ko au plus).")); return; }
    try {
      const xlsx = /\.xlsx$/i.test(f.name);
      payload = xlsx ? { kind: "xlsx", value: await toBase64(f) } : { kind: "csv", value: await readCsv(f) };
      mount(report, h("p", { class: "small muted" }, `${f.name} chargé. Contrôlez-le avant d'importer.`));
    } catch (error) { fail(error); }
  } });
  const checkBtn = h("button", { class: "btn", type: "button", disabled: true, onClick: () => run(true) }, "Contrôler le fichier");
  const importBtn = h("button", { class: "btn btn-primary", type: "button", disabled: true, onClick: () => run(false) }, "Importer");
  const modelBtn = h("button", { class: "btn btn-small", type: "button", disabled: true, onClick: async () => { try { await downloadModel(); } catch (error) { fail(error); } } }, "Exporter le modèle Excel");

  async function run(dryRun) {
    if (!payload) return toast("Choisissez d'abord un fichier Excel (.xlsx) ou CSV.", true);
    try {
      const body = payload.kind === "xlsx" ? { file: payload.value, dryRun } : { csv: payload.value, dryRun };
      const r = await api(payload.kind === "xlsx" ? "/me/import/xlsx" : "/me/import", { method: "POST", body });
      const ok = !r.errors.length;
      mount(report,
        h("p", { class: ok ? "notice" : "banner", role: "status" }, ok
          ? (dryRun ? `Fichier correct : ${r.total} annonce(s) prêtes à importer.` : `${r.created} annonce(s) importées. Elles attendent la modération.`)
          : `Import refusé : ${r.errors.length} problème(s). Rien n'a été créé. Corrigez le fichier puis recommencez.`),
        r.warnings.length ? h("ul", null, r.warnings.map((w) => h("li", { class: "small muted" }, w.message))) : null,
        r.errors.length ? h("ul", { class: "stack" }, r.errors.slice(0, 50).map((e) => h("li", { class: "card pad small" }, h("strong", null, `Ligne ${e.line} : `), e.message))) : null,
        r.similar ? h("p", { class: "small muted" }, `${r.similar} annonce(s) ressemblent à celles d'un autre annonceur : la modération les comparera.`) : null);
      if (!dryRun && ok) {
        payload = null;
        fileInput.value = "";
        toast("Import terminé.");
        onImported?.(r);
      }
    } catch (error) { fail(error); }
  }

  // Droit d'importer : le serveur décide ; l'interface n'active les boutons que si c'est accordé.
  api("/me/import/statut").then((s) => {
    if (s.canImport) {
      status.textContent = "Vous pouvez importer plusieurs annonces d'un coup. Téléchargez le modèle, remplissez-le, puis importez-le.";
      fileInput.disabled = false; checkBtn.disabled = false; importBtn.disabled = false; modelBtn.disabled = false;
    } else {
      status.textContent = s.reason ?? "L'import en masse n'est pas disponible pour ce compte.";
      status.className = "banner";
    }
  }).catch((error) => { status.textContent = error.message ?? "Import indisponible."; status.className = "banner"; });

  return h("div", { class: "stack" },
    status,
    h("div", { class: "row" }, modelBtn, h("a", { class: "btn btn-small", href: "/modele-import.csv", download: "modele-import-ika-so.csv" }, "Modèle CSV")),
    h("p", { class: "small muted" }, "Excel : feuille « Annonces » à remplir, feuille « Valeurs acceptées » pour les choix. 200 lignes au plus. Tout ou rien : si une ligne est fautive, rien n'est créé et le rapport indique la ligne. Les annonces passent par la modération ; les photos se choisissent ensuite dans « Modifier »."),
    fileInput,
    h("div", { class: "row" }, checkBtn, importBtn),
    report);
}
