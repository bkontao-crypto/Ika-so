import { api, fail, h, mount, toast } from "/js/dom.js";
import { app } from "/js/core/state.js";
import { needLogin } from "/js/core/router.js";

const STATUS = { PENDING: "En attente", PUBLISHED: "En ligne", REJECTED: "Refusées", EXPIRED: "Expirées", SOLD: "Vendues", RENTED: "Louées", ARCHIVED: "Archivées", DRAFT: "Brouillons" };

/** Excel enregistre parfois en Windows-1252 : si le texte UTF-8 contient des caractères cassés, on relit autrement. */
async function readCsv(file) {
  const buffer = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  return utf8.includes("�") ? new TextDecoder("windows-1252").decode(buffer) : utf8;
}

export async function agencyPage() {
  if (needLogin()) return;
  const stats = await api("/me/agency");
  const report = h("div", { class: "stack", "aria-live": "polite" });
  let csv = "";
  const file = h("input", { class: "input", type: "file", accept: ".csv,text/csv", "aria-label": "Fichier CSV", onChange: async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try { csv = await readCsv(f); mount(report, h("p", { class: "small muted" }, `${f.name} chargé. Contrôlez-le avant d'importer.`)); } catch (error) { fail(error); }
  } });

  async function run(dryRun) {
    if (!csv) return toast("Choisissez d'abord un fichier CSV.", true);
    try {
      const r = await api("/me/import", { method: "POST", body: { csv, dryRun } });
      const ok = !r.errors.length;
      mount(report,
        h("p", { class: ok ? "notice" : "banner", role: "status" }, ok
          ? (dryRun ? `Fichier correct : ${r.total} annonce(s) prêtes à importer.` : `${r.created} annonce(s) importées. Elles attendent la modération.`)
          : `Import refusé : ${r.errors.length} problème(s). Rien n'a été créé. Corrigez le fichier puis recommencez.`),
        r.warnings.length ? h("ul", null, r.warnings.map((w) => h("li", { class: "small muted" }, w.message))) : null,
        r.errors.length ? h("ul", { class: "stack" }, r.errors.slice(0, 50).map((e) => h("li", { class: "card pad small" }, h("strong", null, `Ligne ${e.line} : `), e.message))) : null,
        r.similar ? h("p", { class: "small muted" }, `${r.similar} annonce(s) ressemblent à celles d'un autre annonceur : la modération les comparera.`) : null);
      if (!dryRun && ok) { csv = ""; file.value = ""; toast("Import terminé."); }
    } catch (error) { fail(error); }
  }

  const ui = await import("/js/components/espace.js"); ui.loadCss();
  const premiumBlock = ui.premiumCard(await api("/me/center/access").catch(() => null), "agence");
  mount(app,
    premiumBlock,
    h("h1", { class: "title" }, "Espace agence"),
    stats.agencyVerified
      ? h("p", null, h("span", { class: "pill pill-green" }, `Agence vérifiée : ${stats.agencyName ?? ""}`), " ", h("a", { href: stats.publicPage }, "Voir ma page publique"))
      : h("p", { class: "notice" }, "Votre agence n'est pas encore vérifiée. Envoyez votre registre de commerce depuis votre profil : une personne de l'équipe le contrôle avant tout badge."),
    h("div", { class: "stat-grid", role: "group", "aria-label": "Mes annonces" },
      Object.entries(stats.byStatus).map(([k, v]) => h("div", { class: "card stat" }, h("span", { class: "small muted" }, STATUS[k] ?? k), h("strong", null, String(v))))),
    h("section", { class: "card pad stack" },
      h("h2", null, "Importer des annonces (CSV)"),
      h("p", { class: "small muted" }, "Un fichier Excel enregistré en CSV, 200 lignes au plus. Tout ou rien : si une ligne est fautive, rien n'est créé et le rapport indique la ligne. Les annonces passent par la modération ; les photos se choisissent ensuite dans « Modifier »."),
      h("p", null, h("a", { class: "btn btn-small", href: "/modele-import.csv", download: "modele-import-ika-so.csv" }, "Télécharger le modèle")),
      file,
      h("div", { class: "row" },
        h("button", { class: "btn", type: "button", onClick: () => run(true) }, "Contrôler le fichier"),
        h("button", { class: "btn btn-primary", type: "button", onClick: () => run(false) }, "Importer")),
      report),
    h("section", { class: "stack" },
      h("h2", null, "Contacts reçus (7 derniers jours)"),
      stats.listings.length
        ? h("ul", { class: "stack" }, stats.listings.map((l) => h("li", { class: "card pad row-between" }, h("a", { href: `#/annonce/${encodeURIComponent(l.id)}` }, l.title), h("span", { class: "small" }, `${l.contacts7d} contact(s) · ${l.contacts} au total`))))
        : h("p", { class: "card pad muted" }, "Aucune annonce en ligne ou en attente.")));
}
