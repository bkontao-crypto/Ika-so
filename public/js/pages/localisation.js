// Localisation d'un bien (position GPS + contour de parcelle) et carte d'ensemble des biens localisés.
// La superficie affichée pendant le dessin est un APERÇU ; la mesure officielle est calculée par le serveur à l'enregistrement.
import { CATEGORIES, ZONES, api, digits, fail, h, mount, toast } from "/js/dom.js";
import { S, app } from "/js/core/state.js";
import { field, select } from "/js/components/ui.js";
import { listingCard, mapView } from "/js/components/listing-card.js";
import { go, needLogin } from "/js/core/router.js";
import { centerOf, fmtHa, fmtM2, fromPolygon, selfIntersects, toPolygon } from "/js/map/geometry.js";
import { createMap } from "/js/map/provider.js";

const BAMAKO = { lat: 12.639, lng: -8.002 };
const CAUTION = "Mesure indicative faite à partir de points placés sur le plan. Ce n'est ni un bornage ni un relevé de géomètre ; elle ne remplace pas le titre foncier.";

function startCenter(item, geo) {
  if (geo?.polygon) return centerOf(fromPolygon(geo.polygon));
  if (geo?.point) return geo.point;
  return ZONES.find((z) => item?.neighborhood && z.name.toLowerCase() === item.neighborhood.toLowerCase()) ?? BAMAKO;
}

function locate() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Ce téléphone ne permet pas de lire la position GPS."));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => reject(new Error(err.code === 1 ? "Position refusée : autorisez la localisation pour ce site dans les réglages du navigateur." : "Position introuvable. Sortez à l'air libre et réessayez.")),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  });
}

export async function localisationPage(id) {
  if (needLogin()) return;
  const [mine, { geo }] = await Promise.all([api("/me/listings"), api(`/me/listings/${encodeURIComponent(id)}/geo`)]);
  const item = mine.find((x) => x.id === id);
  if (!item) throw new Error("Annonce introuvable.");
  let shape = geo?.polygon ? "polygon" : item.category === "Terrain" ? "polygon" : "point";
  const mapBox = h("div", { class: "geo-box" });
  const info = h("p", { class: "geo-info", "aria-live": "polite" });
  const official = h("p", { class: "notice", hidden: !geo?.areaM2 });
  const lat = h("input", { class: "input", inputmode: "decimal", placeholder: "Latitude, ex. 12.6392", "aria-label": "Latitude" });
  const lng = h("input", { class: "input", inputmode: "decimal", placeholder: "Longitude, ex. -8.0029", "aria-label": "Longitude" });
  const isPublic = h("input", { type: "checkbox", checked: !!geo?.isPublic });
  const mode = h("select", { class: "input", "aria-label": "Type de localisation", onChange: (e) => { shape = e.target.value; map.setTapMode(shape === "point" ? "point" : "vertex"); refresh(); } },
    h("option", { value: "polygon", selected: shape === "polygon" }, "Contour de la parcelle"),
    h("option", { value: "point", selected: shape === "point" }, "Position seulement"));

  const map = await createMap(mapBox, { center: startCenter(item, geo), mode: "edit", tap: shape === "point" ? "point" : "vertex", onChange: () => refresh(), onSelect: () => syncRemove() });
  map.setShape({ point: geo?.point && !geo.polygon ? geo.point : null, vertices: geo?.polygon ? fromPolygon(geo.polygon) : [] });

  let removeBtn; // créé plus bas ; refresh() peut être appelé avant
  const syncRemove = () => { if (removeBtn) removeBtn.disabled = shape === "point" || map.getSelected() == null; };
  function refresh() {
    syncRemove();
    const { point, vertices } = map.getShape();
    if (shape === "point") { info.textContent = point ? `Repère placé : ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}.` : "Appuyez sur le plan pour placer le repère, ou utilisez votre position GPS."; return; }
    const p = map.preview();
    const crossing = selfIntersects(vertices);
    info.textContent = vertices.length < 3
      ? `${vertices.length} point(s) placé(s). Il en faut au moins 3 : appuyez sur le plan ou ajoutez votre position GPS à chaque angle.`
      : crossing ? "Le contour se croise : déplacez un point (glissez-le) ou annulez le dernier."
        : `${vertices.length} points · aperçu : ${fmtM2(p.areaM2)} (${fmtHa(p.areaM2)}) · périmètre ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(p.perimeterM)} m`;
    info.classList.toggle("is-error", crossing);
  }
  refresh();

  const gps = async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const here = await locate();
      if (shape === "point") map.setPoint(here); else map.addVertex(here);
      toast(here.accuracy > 25 ? `Précision faible (±${Math.round(here.accuracy)} m). Attendez quelques secondes à l'air libre puis recommencez.` : `Position ajoutée (±${Math.round(here.accuracy)} m).`, here.accuracy > 25);
    } catch (error) { fail(error); } finally { button.disabled = false; }
  };
  const typed = () => {
    const a = Number(lat.value.replace(",", "."));
    const b = Number(lng.value.replace(",", "."));
    if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180 || lat.value.trim() === "" || lng.value.trim() === "") return fail(new Error("Entrez une latitude et une longitude valides (ex. 12.6392 et -8.0029)."));
    if (shape === "point") map.setPoint({ lat: a, lng: b }); else map.addVertex({ lat: a, lng: b });
    lat.value = ""; lng.value = "";
  };

  async function save() {
    const { point, vertices } = map.getShape();
    const body = { isPublic: isPublic.checked };
    if (shape === "point") { if (!point) return fail(new Error("Placez d'abord le repère du bien.")); body.point = point; }
    else {
      if (vertices.length < 3) return fail(new Error("Placez au moins 3 points pour délimiter la parcelle."));
      if (selfIntersects(vertices)) return fail(new Error("Le contour se croise : corrigez-le avant d'enregistrer."));
      body.polygon = toPolygon(vertices);
    }
    try {
      const saved = (await api(`/me/listings/${encodeURIComponent(id)}/geo`, { method: "POST", body })).geo;
      toast("Localisation enregistrée.");
      official.hidden = !saved.areaM2;
      if (saved.areaM2) official.textContent = `Mesure enregistrée par le serveur : ${fmtM2(saved.areaM2)} (${fmtHa(saved.areaM2)}), périmètre ${Math.round(saved.perimeterM)} m. ${CAUTION}`;
    } catch (error) { fail(error); }
  }
  async function remove() {
    if (!window.confirm("Supprimer la localisation de cette annonce ?")) return;
    try { await api(`/me/listings/${encodeURIComponent(id)}/geo/delete`, { method: "POST", body: { confirm: true } }); toast("Localisation supprimée."); go("/mes-annonces"); } catch (error) { fail(error); }
  }
  if (geo?.areaM2) official.textContent = `Mesure enregistrée : ${fmtM2(geo.areaM2)} (${fmtHa(geo.areaM2)}), périmètre ${Math.round(geo.perimeterM)} m. ${CAUTION}`;

  const btn = (label, onClick, cls = "") => h("button", { class: `btn btn-small ${cls}`, type: "button", onClick }, label);
  removeBtn = btn("Supprimer le point choisi", () => { map.removeSelected(); }, "btn-quiet");
  removeBtn.disabled = true;
  mount(app,
    h("a", { href: "#/mes-annonces", class: "btn btn-quiet btn-small" }, "Retour à mes annonces"),
    h("h1", { class: "title" }, "Localiser le bien"),
    h("p", { class: "muted small" }, `${item.title} · ${item.neighborhood}`),
    h("div", { class: "card pad stack" },
      h("label", { class: "field" }, "Que voulez-vous enregistrer ?", mode),
      h("div", { class: "row" },
        btn("Ma position GPS", gps, "btn-primary"), btn("Annuler le dernier", () => map.undo()), removeBtn, btn("Tout effacer", () => map.clear()),
        btn("＋", () => map.zoom(1.6)), btn("−", () => map.zoom(1 / 1.6))),
      mapBox, info,
      h("details", null, h("summary", null, "Saisir des coordonnées à la main"),
        h("div", { class: "row" }, lat, lng, btn("Ajouter", typed))),
      h("label", { class: "row" }, isPublic, h("span", null, "Afficher la position exacte aux visiteurs (sinon, seul le quartier est visible).")),
      official,
      h("p", { class: "small muted" }, "Glissez un point pour le corriger, touchez-le pour le choisir puis « Supprimer le point choisi », glissez le fond pour déplacer le plan. Les points doivent être placés dans l'ordre, en faisant le tour de la parcelle."),
      h("div", { class: "row" }, btn("Enregistrer la localisation", save, "btn-primary"), geo ? btn("Supprimer la localisation", remove, "btn-quiet") : null),
      geo?.polygon ? h("p", null, h("a", { class: "btn btn-small", href: `/api/me/listings/${encodeURIComponent(id)}/fiche`, target: "_blank", rel: "noopener" }, "Fiche imprimable (PDF)"), h("span", { class: "small muted" }, " Elle reflète la dernière version enregistrée.")) : null));
}

export async function cartePage() {
  // --- Recherche immobilière (design de référence) : formulaire réellement relié à la recherche d'annonces ---
  const f = { transaction: "", category: "", q: "", maxPrice: "" };
  const favorites = new Set(S.meta?.favoriteIds ?? []);
  const SHOWN = 12;
  const tabs = [];
  const count = h("p", { class: "results-count", "aria-live": "polite" });
  const mapHost = h("div", { class: "map-wrap" });
  const resultsHost = h("div");
  const syncTabs = () => tabs.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === f.transaction)));
  async function search() {
    mount(resultsHost, h("div", { class: "listing-grid" }, [0, 1, 2].map(() => h("div", { class: "skeleton" }))));
    try {
      const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
      qs.set("limit", "60");
      const items = await api(`/listings?${qs}`);
      count.textContent = `${items.length} bien${items.length > 1 ? "s" : ""} trouvé${items.length > 1 ? "s" : ""}`;
      mount(mapHost, mapView(items));
      const more = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
      mount(resultsHost, items.length
        ? [h("div", { class: "listing-grid" }, items.slice(0, SHOWN).map((item) => listingCard(item, favorites))),
          h("p", { class: "section-desc" }, h("a", { class: "text-link", href: `#/annonces${more.toString() ? `?${more}` : ""}` }, "Voir toutes les annonces correspondantes →"))]
        : h("div", { class: "empty-state" }, h("strong", null, "Aucun bien ne correspond à votre recherche."), "Essayez de modifier les filtres ou le budget."));
    } catch (error) { mount(resultsHost, h("p", { class: "notice" }, error.message)); }
  }
  const searchCard = h("section", { class: "container search-block", id: "recherche" }, h("div", { class: "search-card" },
    h("div", { class: "search-top" },
      h("div", null, h("span", { class: "section-kicker" }, "Recherche immobilière"), h("h2", null, "Quel bien recherchez-vous ?")),
      h("div", { class: "search-tabs", role: "group", "aria-label": "Type de transaction" },
        [["", "Tous"], ["Vente", "Acheter"], ["Location", "Louer"]].map(([value, label]) => {
          const b = h("button", { type: "button", class: "search-tab", "data-mode": value, "aria-pressed": String(value === ""), onClick: () => { f.transaction = value; syncTabs(); } }, label);
          tabs.push(b);
          return b;
        }))),
    h("form", { class: "filters", onSubmit: (e) => { e.preventDefault(); search(); } },
      field("Type de bien", select(CATEGORIES, f.category, (v) => { f.category = v; }, { blank: "Tous les types" })),
      field("Ville ou quartier", h("input", { class: "input", type: "search", list: "carte-zones", placeholder: "Bamako, ACI 2000, Hamdallaye...", onInput: (e) => { f.q = e.target.value.trim(); } })),
      h("datalist", { id: "carte-zones" }, ZONES.map((z) => h("option", { value: z.name }))),
      field("Budget maximum (FCFA)", h("input", { class: "input", inputmode: "numeric", placeholder: "Sans limite", onInput: (e) => { f.maxPrice = digits(e.target.value); e.target.value = f.maxPrice; } })),
      h("button", { class: "filter-submit", type: "submit" }, "Rechercher"))));
  const explorer = h("section", { class: "section container" },
    h("div", { class: "section-head" }, h("div", null, h("span", { class: "section-kicker" }, "Géolocalisation"), h("h1", { class: "section-title" }, "Explorer les biens sur la carte"),
      h("p", { class: "section-desc" }, "Repérez les biens par ville et par quartier."))),
    count, mapHost, h("div", { class: "section-head", style: { "margin-top": "22px" } }, h("div", null, h("h2", { class: "section-title" }, "Résultats"))), resultsHost);

  // --- Mes biens localisés (compte connecté) : fonctions d'origine conservées ---
  const mine = h("section", { class: "section container" });
  const list = h("div", { class: "stack" });
  const stats = h("div", { class: "grid facts" });
  const mapBox = h("div", { class: "geo-box" });
  let category = "";
  let map;
  const fact = (label, value) => h("div", { class: "fact" }, h("span", null, label), h("strong", null, value));
  async function loadMine() {
    const { items, stats: s } = await api(`/me/geo${category ? `?category=${encodeURIComponent(category)}` : ""}`);
    mount(stats, fact("Biens localisés", String(s.located)), fact("Terrains délimités", String(s.delimitedPlots)), fact("Maisons localisées", String(s.housesLocated)), fact("Superficie cumulée", fmtM2(s.totalAreaM2)));
    mount(list, items.length ? h("ul", { class: "stack" }, items.map((g) => h("li", { class: "card pad row-between" },
      h("div", null, h("strong", null, g.title), h("p", { class: "small muted" }, `${g.category}${g.areaM2 ? ` · ${fmtM2(g.areaM2)} (${fmtHa(g.areaM2)})` : ""} · ${g.isPublic ? "position publique" : "position privée"}`)),
      h("a", { class: "btn btn-small", href: `#/localiser/${encodeURIComponent(g.listingId)}` }, "Modifier")))) : h("p", { class: "card pad muted" }, "Aucun bien localisé pour le moment. Depuis « Mes annonces », choisissez un bien puis « Localiser »."));
    if (items.length) {
      mapBox.hidden = false; // d'abord visible : Mapbox mesure la taille du conteneur à la création
      map ??= await createMap(mapBox, { center: items[0].point, mode: "view" });
      map.resize?.();
      const labelled = items.map((g) => ({ ...g.point, image: g.imageUrl, label: `${g.transactionType ?? ""} · ${g.title.length > 22 ? `${g.title.slice(0, 21)}…` : g.title}` }));
      map.setExtra(labelled);
      map.fit(items.map((g) => g.point));
    } else mapBox.hidden = true;
  }
  if (S.user) {
    mount(mine,
      h("div", { class: "section-head" }, h("div", null, h("span", { class: "section-kicker" }, "Mon espace"), h("h2", { class: "section-title" }, "Mes biens localisés"),
        h("p", { class: "section-desc" }, "Les positions restent privées tant que vous ne choisissez pas de les afficher."))),
      stats,
      h("label", { class: "field" }, "Filtrer par type",
        h("select", { class: "input", onChange: (e) => { category = e.target.value; loadMine().catch(fail); } },
          h("option", { value: "" }, "Tous les biens"), CATEGORIES.map((c) => h("option", { value: c }, c)))),
      mapBox, list);
  } else {
    mount(mine, h("p", { class: "muted small" }, "Connectez-vous pour voir et gérer vos propres biens localisés. ", h("a", { class: "text-link", href: "#/connexion?next=%2Fcarte" }, "Connexion →")));
  }
  mount(app, searchCard, explorer, mine);
  search();
  if (S.user) await loadMine().catch(fail);
}
