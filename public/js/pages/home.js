import { CATEGORIES, TRANSACTIONS, ZONES, api, digits, fail, formatPrice, h, mount, toast } from "/js/dom.js";
import { S, app } from "/js/core/state.js";
import { currentRoute, needLogin } from "/js/core/router.js";
import { field, select } from "/js/components/ui.js";
import { icon } from "/js/icons.js";
import { listingCard, mapView } from "/js/components/listing-card.js";

const BLANK = { transaction: "", category: "", zone: "", minPrice: "", maxPrice: "", q: "", sort: "", minSurface: "", bedrooms: "" };

// Identité de la bannière d'accueil : personnalisation centralisée (photo et textes).
// Remplacer la photo par un fichier placé dans public/media/ et adapter les textes ci-dessous.
const DEFAULT_HOME_HERO_CONFIG = {
  image: "/media/villa-badala.jpg",
  badge: "L'immobilier au Mali, en toute confiance",
  titleLine1: "Trouvez le lieu où",
  titleLine2: "commence votre histoire.",
  subtitle: "Maisons, appartements, terrains, locaux commerciaux et bureaux au Mali, en toute simplicité.",
};
const KINDS = [
  { category: "Maison", title: "Maisons & villas", text: "Un espace pour vivre", icon: "home" },
  { category: "Appartement", title: "Appartements", text: "La ville à portée de main", icon: "building" },
  { category: "Terrain", title: "Terrains", text: "Construisez votre avenir", icon: "ruler" },
  { category: "Studio", title: "Studios", text: "Pratique, au cœur de la ville", icon: "sofa" },
  { category: "Local commercial", title: "Locaux commerciaux", text: "Boutiques, magasins, entrepôts", icon: "store" },
  { category: "Bureau", title: "Bureaux", text: "Des espaces pour travailler", icon: "briefcase" },
];

export const homePage = async () => (await import("/js/pages/home-sections.js")).renderHome();
export const annoncesPage = () => listingsPage("annonces");

/** Initiales d'un annonceur pour la pastille d'une publication sponsorisée. */
const initials = (name) => (String(name || "IKA SO").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("") || "IK").toUpperCase();

async function listingsPage(mode) {
  const isHome = mode === "home";
  let HOME_HERO_CONFIG = { ...DEFAULT_HOME_HERO_CONFIG };
  if (isHome) {
    try { HOME_HERO_CONFIG = { ...HOME_HERO_CONFIG, ...await api("/homepage-settings") }; } catch { /* la page reste disponible avec ses valeurs par défaut */ }
  }
  const f = { ...BLANK };
  // Filtres reçus par l'adresse (recherche rapide de l'en-tête, catégories de l'accueil, bloc de recherche de la Carte).
  const params = currentRoute().params;
  const wantedT = params.get("t") ?? params.get("transaction");
  if (TRANSACTIONS.includes(wantedT)) f.transaction = wantedT;
  if (CATEGORIES.includes(params.get("category"))) f.category = params.get("category");
  if (params.get("q")) f.q = params.get("q").trim().slice(0, 80);
  if (/^\d+$/.test(params.get("maxPrice") ?? "")) f.maxPrice = params.get("maxPrice");
  if (/^\d+$/.test(params.get("minPrice") ?? "")) f.minPrice = params.get("minPrice");
  if (ZONES.some((z) => z.name === params.get("zone"))) f.zone = params.get("zone");

  const PAGE = 24;
  let more = false;
  let onlyFav = false;
  let view = ["grid", "list", "map"].includes(params.get("vue")) ? params.get("vue") : "grid";
  let items = [];
  let campaigns = [];
  let sidebarAds = [];
  const favorites = new Set(S.meta?.favoriteIds ?? []);
  const results = h("div");
  const sponsoredHost = h("div");
  const sidebarHost = h("aside", { class: "sidebar-ads", "aria-label": "Publicités" });
  const count = h("p", { class: "results-count", "aria-live": "polite" });
  const inputs = {}; // champs du formulaire, pour les remettre à jour quand un filtre change ailleurs
  const modeButtons = [];

  const query = (extra = {}) => {
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
    qs.set("limit", String(PAGE));
    for (const [k, v] of Object.entries(extra)) qs.set(k, String(v));
    return qs;
  };
  function sync() {
    for (const [key, el] of Object.entries(inputs)) el.value = f[key];
    for (const b of modeButtons) b.setAttribute("aria-pressed", String(b.dataset.mode === f.transaction));
    if (!isHome) {
      favButton.setAttribute("aria-pressed", String(onlyFav));
      favButton.classList.toggle("btn-primary", onlyFav);
    }
  }
  async function load() {
    mount(results, h("div", { class: "listing-grid" }, [0, 1, 2].map(() => h("div", { class: "skeleton" }))));
    try {
      // Campagnes SPONSORED (route publique) : une panne ici ne doit jamais empêcher l'affichage des annonces.
      const placement = isHome ? "home" : "annonces";
      const [list, camp, side] = await Promise.all([
        api(`/listings?${query()}`),
        isHome ? api("/campaigns/sponsored").catch(() => []) : Promise.resolve([]),
        api(`/campaigns/sidebar?placement=${placement}`).catch(() => []),
      ]);
      items = list;
      campaigns = Array.isArray(camp) ? camp : [];
      sidebarAds = Array.isArray(side) ? side : [];
      more = items.length === PAGE;
      draw();
    } catch (error) {
      mount(results, h("p", { class: "notice" }, error.message));
      if (isHome) mount(sponsoredHost);
    }
  }

  // Publications sponsorisées : annonces réellement « mises à la une » (offre payante existante), présentées comme des publications.
  /** Publication sponsorisée issue d'une campagne SPONSORED (annonce liée, ou visuel + lien propres). */
  function campaignPost(c) {
    const l = c.listing;
    const who = l ? (l.agencyName || l.ownerName || "Annonceur") : c.name;
    const external = /^https:/i.test(c.linkUrl);
    const linkAttrs = external ? { target: "_blank", rel: "noopener noreferrer sponsored" } : {};
    const caption = c.text || (l ? `${l.category} ${l.transactionType === "Location" ? "à louer" : "à vendre"} à ${l.neighborhood || "Bamako"} — ${l.title}` : c.name);
    return h("article", { class: "sponsored-post" },
      h("div", { class: "sponsored-post-top" },
        h("div", { class: "sponsored-avatar", "aria-hidden": "true" }, initials(who)),
        h("div", { class: "sponsored-identity" }, h("strong", null, who + (l?.agencyVerified ? " · Agence vérifiée" : "")),
          h("small", null, "Sponsorisé", h("span", null, "·"), l?.neighborhood || "Bamako"))),
      h("div", { class: "sponsored-caption" }, caption),
      c.imageUrl ? h("a", { class: "sponsored-media", href: c.linkUrl, ...linkAttrs, "aria-label": l?.title || c.name, style: { "background-image": `url("${c.imageUrl}")` } },
        h("span", { class: "sponsored-media-label" }, "Sponsorisé")) : null,
      h("div", { class: "sponsored-destination" },
        h("div", null, h("strong", null, l?.title || c.name), l ? h("small", null, formatPrice(l.price, l.transactionType)) : null),
        h("a", { class: "sponsored-cta", href: c.linkUrl, ...linkAttrs }, c.ctaLabel || "Découvrir")));
  }

  // Publications sponsorisées : campagnes SPONSORED actives d'abord, puis annonces réellement « mises à la une » (offre payante existante).
  function drawSponsored() {
    const campaignListingIds = new Set(campaigns.map((c) => c.listing?.id).filter(Boolean));
    const featured = items.filter((i) => i.featured && !campaignListingIds.has(i.id));
    const posts = [
      ...campaigns.filter((c) => c.linkUrl).map(campaignPost),
      ...featured.map((item) => {
        const who = item.agencyName || item.ownerName || "Annonceur";
        const href = `#/annonce/${encodeURIComponent(item.id)}`;
        return h("article", { class: "sponsored-post" },
          h("div", { class: "sponsored-post-top" },
            h("div", { class: "sponsored-avatar", "aria-hidden": "true" }, initials(who)),
            h("div", { class: "sponsored-identity" }, h("strong", null, who + (item.agencyVerified ? " · Agence vérifiée" : "")),
              h("small", null, "Sponsorisé", h("span", null, "·"), item.neighborhood || "Bamako"))),
          h("div", { class: "sponsored-caption" }, `${item.category} ${item.transactionType === "Location" ? "à louer" : "à vendre"} à ${item.neighborhood || "Bamako"} — ${item.title}`),
          h("a", { class: "sponsored-media", href, "aria-label": item.title, style: { "background-image": `url("${item.imageUrl}")` } },
            h("span", { class: "sponsored-media-label" }, "Sponsorisé")),
          h("div", { class: "sponsored-destination" },
            h("div", null, h("strong", null, item.title), h("small", null, formatPrice(item.price, item.transactionType))),
            h("a", { class: "sponsored-cta", href }, "Découvrir")));
      }),
    ].slice(0, 3);
    mount(sponsoredHost, posts.length
      ? h("div", { class: "sponsored-feed-list" }, posts)
      : h("div", { class: "empty-state" }, h("strong", null, "Aucune annonce sponsorisée pour le moment."),
        "Propriétaires et agences : mettez une annonce à la une pour qu'elle apparaisse ici, avant les annonces classiques.",
        h("p", null, h("a", { class: "btn btn-small btn-outline", href: "#/mes-annonces" }, "Mettre mon annonce à la une"))));
  }

  function drawSidebar() {
    if (!sidebarAds.length) {
      mount(sidebarHost, h("div", { class: "sidebar-empty" }, "Espace publicitaire disponible. Contactez-nous pour promouvoir votre produit."));
      return;
    }
    mount(sidebarHost, sidebarAds.map((ad) => {
      const external = /^https:/i.test(ad.linkUrl);
      const linkAttrs = external ? { target: "_blank", rel: "noopener noreferrer sponsored" } : {};
      return h("article", { class: "sidebar-ad" },
        ad.imageUrl ? h("a", { href: ad.linkUrl, ...linkAttrs }, h("img", { src: ad.imageUrl, alt: ad.name, loading: "lazy" })) : null,
        h("div", { class: "sidebar-ad-body" },
          h("div", { class: "sponsored" }, "Sponsorisé"),
          h("strong", null, ad.name),
          ad.text ? h("p", null, ad.text) : null,
          h("a", { class: "btn btn-small btn-primary", href: ad.linkUrl, ...linkAttrs }, ad.ctaLabel)));
    }));
  }

  function draw() {
    const shown = onlyFav ? items.filter((i) => favorites.has(i.id)) : items;
    drawSidebar();
    if (isHome) {
      drawSponsored();
      const preview = items.filter((i) => !i.featured);
      const six = (preview.length ? preview : items).slice(0, 6);
      if (!six.length) return mount(results, h("div", { class: "empty-state" }, h("strong", null, "Aucune annonce publiée pour le moment."), "Revenez bientôt ou publiez la vôtre."));
      return mount(results, h("div", { class: "listing-grid" }, six.map((item) => listingCard(item, favorites))));
    }
    count.textContent = `${shown.length} bien${shown.length > 1 ? "s" : ""} trouvé${shown.length > 1 ? "s" : ""}`;
    if (!shown.length) {
      return mount(results, h("div", { class: "empty-state" },
        h("strong", null, "Aucun bien ne correspond à votre recherche."),
        "Essayez un autre quartier ou ajustez votre budget.",
        h("p", null, h("button", { class: "btn btn-primary", type: "button", onClick: reset }, "Effacer les filtres"))));
    }
    results.classList.toggle("view-list", view === "list");
    mount(results,
      view === "map" ? mapView(shown) : h("div", { class: "listing-grid" }, shown.map((item) => listingCard(item, favorites, () => onlyFav && draw()))),
      more && !onlyFav ? h("button", { class: "btn btn-block btn-outline", type: "button", onClick: loadMore }, "Voir plus d'annonces") : null);
  }
  async function loadMore() {
    try {
      const next = await api(`/listings?${query({ offset: items.length })}`);
      items = items.concat(next);
      more = next.length === PAGE;
      draw();
    } catch (error) { fail(error); }
  }
  async function saveSearch() {
    if (needLogin()) return;
    const { sort, ...filters } = f;
    try {
      await api("/me/searches", { method: "POST", body: { filters } });
      toast("Recherche enregistrée : vous serez prévenu des nouvelles annonces.");
    } catch (error) { fail(error); }
  }
  function apply(change) { Object.assign(f, change); sync(); load(); }
  function reset() { onlyFav = false; apply(BLANK); }
  let timer;
  const debounced = () => { clearTimeout(timer); timer = setTimeout(load, 250); };
  const text = (key, props, onInput) => (inputs[key] = h("input", { class: "input", value: f[key], ...props, onInput }));
  const money = (key, placeholder, live = false) => text(key, { inputmode: "numeric", placeholder }, (e) => { f[key] = digits(e.target.value); e.target.value = f[key]; if (live) debounced(); });
  const choose = (key, options, blank) => (inputs[key] = select(options, f[key], (v) => { f[key] = v; load(); }, { blank }));
  const favButton = h("button", { class: "btn btn-small", type: "button", onClick: () => { if (needLogin()) return; onlyFav = !onlyFav; sync(); draw(); } }, "Favoris");
  const chip = (label, change) => h("button", { class: "btn btn-small", type: "button", onClick: () => apply({ ...BLANK, ...change }) }, label);

  // --- Page « Annonces » : recherche, filtres, tri, pagination, favoris, recherche enregistrée (fonctions d'origine) ---
  const typeSelect = (inputs.category = select(CATEGORIES, f.category, (v) => { f.category = v; }, { blank: "Tous les types de biens" }));
  const modes = h("div", { class: "search-tabs", role: "group", "aria-label": "Type de transaction" },
    [["", "Tous"], ["Vente", "Acheter"], ["Location", "Louer"]].map(([value, label]) => {
      const b = h("button", { type: "button", class: "search-tab", "data-mode": value, "aria-pressed": String(f.transaction === value), onClick: () => { f.transaction = value; sync(); } }, label);
      modeButtons.push(b);
      return b;
    }));
  const searchCard = h("div", { class: "search-card" },
    h("div", { class: "search-top" }, h("div", null, h("span", { class: "section-kicker" }, "Recherche"), h("h2", null, "Affinez les annonces")), modes),
    h("form", { class: "filters", onSubmit: (e) => { e.preventDefault(); load(); } },
      field("Type de bien", typeSelect),
      field("Ville ou quartier", text("q", { type: "search", list: "zones-list", placeholder: "Bamako, ACI 2000, Hamdallaye…" }, (e) => { f.q = e.target.value.trim(); })),
      h("datalist", { id: "zones-list" }, ZONES.map((z) => h("option", { value: z.name }))),
      field("Budget maximum (FCFA)", money("maxPrice", "Sans limite")),
      h("button", { class: "filter-submit", type: "submit" }, "Rechercher")));
  const advancedBody = h("div", { class: "grid filters", style: { "grid-template-columns": "1fr" } },
    field("Quartier", choose("zone", ZONES.map((z) => z.name), "Tous")),
    field("Budget minimum (FCFA)", money("minPrice", "0")),
    field("Superficie min. (m²)", money("minSurface", "300", true)),
    field("Chambres min.", choose("bedrooms", ["1", "2", "3", "4", "5"], "Peu importe")),
    field("Trier par", (inputs.sort = h("select", { class: "input", onChange: (e) => { f.sort = e.target.value; load(); } },
      [["", "Plus récentes"], ["price_asc", "Prix croissant"], ["price_desc", "Prix décroissant"]].map(([v, label]) => h("option", { value: v, selected: v === f.sort }, label))))));
  // Tiroir latéral de filtres : même composant sur ordinateur et sur mobile, fermeture par Échap ou clic extérieur.
  function openDrawer(opener) {
    const close = () => { backdrop.remove(); drawer.remove(); document.removeEventListener("keydown", onKey); opener.focus(); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    const backdrop = h("div", { class: "rx-drawer-backdrop", onClick: close });
    const drawer = h("aside", { class: "rx-drawer stack", role: "dialog", "aria-modal": "true", "aria-label": "Filtres avancés", tabindex: "-1" },
      h("div", { class: "row-between" }, h("h2", { class: "title" }, "Filtres"), h("button", { class: "btn btn-small btn-quiet", type: "button", onClick: close, "aria-label": "Fermer les filtres" }, icon("x"))),
      advancedBody,
      h("div", { class: "row" },
        h("button", { class: "btn btn-primary", type: "button", onClick: () => { close(); load(); } }, "Voir les résultats"),
        h("button", { class: "btn", type: "button", onClick: () => { reset(); close(); } }, "Réinitialiser")));
    document.body.append(backdrop, drawer);
    document.addEventListener("keydown", onKey);
    drawer.focus();
  }
  const filtersButton = h("button", { class: "btn btn-small", type: "button", onClick: (e) => openDrawer(e.currentTarget) }, icon("sliders"), "Plus de filtres");
  const viewBar = h("div", { class: "rx-viewbar", role: "group", "aria-label": "Mode d'affichage" },
    [["grid", "Grille", "list"], ["list", "Liste", "journal"], ["map", "Carte", "pin"]].map(([v, label, ic]) => {
      const b = h("button", { type: "button", "aria-pressed": String(view === v), onClick: () => { view = v; viewBar.querySelectorAll("button").forEach((x, i) => x.setAttribute("aria-pressed", String(["grid", "list", "map"][i] === v))); draw(); } }, icon(ic), label);
      return b;
    }));
  mount(app, h("section", { class: "section container", id: "annonces" },
    h("div", { class: "section-head" }, h("div", null, h("span", { class: "section-kicker" }, "Sélection IKA SO"), h("h1", { class: "section-title" }, "Toutes les annonces"),
      h("p", { class: "section-desc" }, "Consultez, filtrez et enregistrez vos recherches."))),
    searchCard,
    h("div", { class: "toolbar" },
      h("div", { class: "row" }, chip("Terrains à vendre", { transaction: "Vente", category: "Terrain" }), chip("Appartements à louer", { transaction: "Location", category: "Appartement" }),
        h("button", { class: "btn btn-small", type: "button", onClick: saveSearch }, "Enregistrer cette recherche"), S.user ? favButton : null),
      h("div", { class: "row" }, viewBar, filtersButton)),
    count, h("div", { class: "with-sidebar" }, sidebarHost, results)));
  sync();
  load();
}
