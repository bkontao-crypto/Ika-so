// Onglet « Annonceurs » : agences, particuliers et démarcheurs, classés par confiance, visibilité, fidélité et réactivité.
// Les annonceurs « boostés » (annonce à la une en cours) passent toujours devant. Un appui sur une ligne ouvre le profil.
import { api, fail, h, mount } from "/js/dom.js";
import { app } from "/js/core/state.js";
import { icon } from "/js/icons.js";
import { stars } from "/js/components/stars.js";
import { avatar, loadCss } from "/js/components/espace.js";

const FILTERS = [["", "Tous"], ["boosted", "Boostés"], ["certified", "Certifiés"], ["agency", "Agences"], ["individual", "Particuliers"], ["agent", "Démarcheurs"]];
const PAGE = 20;
const TRUST_CLASS = { ESTABLISHED: "pill-green", BUILDING: "pill-gold", NEW: "", CAUTION: "pill-warn" };

function row(a, rank) {
  const rating = a.rating.count ? String(a.rating.average).replace(".", ",") : "—";
  return h("li", null,
    h("a", { class: `dir-row${a.boosted ? " is-boosted" : ""}`, href: `#/annonceur/${encodeURIComponent(a.id)}`, "aria-label": `Ouvrir le profil de ${a.name}` },
      h("span", { class: "dir-rank", "aria-hidden": "true" }, a.boosted ? icon("star") : String(rank)),
      avatar(a.name, a.photoUrl),
      h("span", { class: "dir-main" },
        h("span", { class: "dir-name" }, h("strong", null, a.name),
          a.boosted ? h("span", { class: "pill pill-gold" }, "Boosté") : null,
          a.certified ? h("span", { class: "pill pill-green" }, a.agencyVerified ? "Agence vérifiée" : "Titre contrôlé") : null),
        h("span", { class: "small muted" }, [a.role, a.neighborhood, `${a.listings} annonce${a.listings > 1 ? "s" : ""}`].filter(Boolean).join(" · ")),
        h("span", { class: "dir-meta small" },
          stars(a.rating.average, { label: a.rating.count ? `Note ${rating} sur 5` : "Pas encore de note" }),
          h("span", null, a.rating.count ? `${rating} (${a.rating.count} avis)` : "Pas encore d'avis"),
          a.responseRate != null ? h("span", { class: "muted" }, `Répond à ${a.responseRate} % des messages`) : null,
          h("span", { class: `pill ${TRUST_CLASS[a.trust.level] ?? ""}` }, a.trust.level === "ESTABLISHED" ? "Profil bien établi" : a.trust.level === "BUILDING" ? "En construction" : a.trust.level === "CAUTION" ? "Prudence" : "Nouveau"))),
      h("span", { class: "dir-score", title: `Confiance ${a.parts.trust} · Visibilité ${a.parts.visibility} · Fidélité ${a.parts.loyalty} · Réactivité ${a.parts.reactivity}` },
        h("strong", null, String(a.score)), h("small", null, "score")),
      h("span", { class: "dir-go", "aria-hidden": "true" }, "›")));
}

export async function annonceursPage() {
  loadCss();
  let q = ""; let kind = ""; let items = []; let total = 0; let timer;
  const input = h("input", { class: "input", type: "search", placeholder: "Nom, agence, quartier…", "aria-label": "Rechercher un annonceur", onInput: (e) => { clearTimeout(timer); timer = setTimeout(() => { q = e.target.value.trim(); load(true); }, 250); } });
  const chips = h("div", { class: "row", role: "group", "aria-label": "Filtrer les annonceurs" });
  const list = h("ul", { class: "dir-list", "aria-live": "polite" });
  const count = h("p", { class: "small muted" });
  const more = h("button", { class: "btn", type: "button", hidden: true, onClick: () => load(false) }, "Voir plus d'annonceurs");

  const drawChips = () => chips.replaceChildren(...FILTERS.map(([k, label]) => h("button", { class: `chip`, type: "button", "aria-pressed": String(kind === k), onClick: () => { kind = k; drawChips(); load(true); } }, label)));
  async function load(reset) {
    if (reset) { items = []; list.replaceChildren(h("li", null, h("div", { class: "skeleton" }))); }
    try {
      const r = await api(`/advertisers?q=${encodeURIComponent(q)}&kind=${encodeURIComponent(kind)}&limit=${PAGE}&offset=${items.length}`);
      if (reset) list.replaceChildren();
      const start = items.length; items = items.concat(r.items); total = r.total;
      list.append(...r.items.map((a, i) => row(a, start + i + 1)));
      count.textContent = total ? `${total} annonceur${total > 1 ? "s" : ""}` : "";
      if (!items.length) list.append(h("li", { class: "card pad muted" }, "Aucun annonceur ne correspond à cette recherche."));
      more.hidden = items.length >= total;
    } catch (error) { fail(error); }
  }

  mount(app,
    h("div", { class: "row-between" }, h("div", null, h("p", { class: "rx-kicker" }, "Annuaire"), h("h1", { class: "title" }, "Annonceurs")),
      h("a", { class: "text-link", href: "#/confiance" }, "Comment on vous protège →")),
    h("p", { class: "muted" }, "Agences, particuliers et démarcheurs ayant des annonces en ligne. Appuyez sur une ligne pour ouvrir le profil."),
    h("section", { class: "card pad stack" }, h("label", { class: "field" }, "Rechercher", input), chips, count),
    h("details", { class: "card pad dir-how" }, h("summary", null, "Comment est fait le classement ?"),
      h("p", { class: "small" }, "Les annonceurs boostés (annonce mise à la une en cours) passent d'abord, quel que soit leur statut. Les autres sont classés par un score sur 100 : confiance (avis, vérifications) 40 %, visibilité 20 %, fidélité (ancienneté, biens conclus) 20 %, réactivité aux clients (réponses aux messages et aux avis) 20 %."),
      h("p", { class: "small muted" }, "Le score ne garantit rien : visitez le bien et faites contrôler les documents avant tout paiement.")),
    list, h("div", { class: "row" }, more));
  drawChips();
  await load(true);
}
