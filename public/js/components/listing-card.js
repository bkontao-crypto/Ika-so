import { api, fail, formatPrice, h } from "/js/dom.js";
import { needLogin } from "/js/core/router.js";
import { icon } from "/js/icons.js";

export function listingCard(item, favorites, onHeart) {
  const href = `#/annonce/${encodeURIComponent(item.id)}`;
  const heart = h("button", {
    class: "favorite-btn", type: "button", "aria-pressed": favorites.has(item.id) ? "true" : "false",
    "aria-label": favorites.has(item.id) ? "Retirer des favoris" : "Ajouter aux favoris",
    onClick: async () => {
      if (needLogin()) return;
      try {
        const { on } = await api(`/listings/${encodeURIComponent(item.id)}/favorite`, { method: "POST", body: {} });
        on ? favorites.add(item.id) : favorites.delete(item.id);
        heart.setAttribute("aria-pressed", String(on));
        heart.setAttribute("aria-label", on ? "Retirer des favoris" : "Ajouter aux favoris");
        onHeart?.();
      } catch (error) { fail(error); }
    },
  }, icon("heart"));
  const facts = [
    item.bedrooms ? h("span", null, icon("bed"), `${item.bedrooms} chambre${item.bedrooms > 1 ? "s" : ""}`) : null,
    item.bathrooms ? h("span", null, icon("bath"), `${item.bathrooms} sanitaire${item.bathrooms > 1 ? "s" : ""}`) : null,
    item.surfaceLabel ? h("span", null, icon("ruler"), item.surfaceLabel) : null,
  ];
  return h("article", { class: "listing" },
    h("div", { class: "listing-wrap" },
      h("a", { class: "listing-photo", href, tabindex: "-1", "aria-hidden": "true" },
        h("img", { src: item.imageUrl, alt: "", loading: "lazy" }),
        h("span", { class: "pill pill-white tag-tl" }, item.featured ? "Sponsorisé" : item.category),
        h("span", { class: "pill pill-dark tag-tr" }, item.transactionType === "Location" ? "À louer" : "À vendre")),
      heart),
    h("div", { class: "listing-body" },
      h("p", { class: "loc" }, `${item.neighborhood} • ${item.category}`),
      h("h2", null, h("a", { href }, item.title)),
      h("p", { class: "lprice" }, formatPrice(item.price, item.transactionType)),
      h("div", { class: "lfacts" }, facts),
      h("div", { class: "row lbadges" },
        item.documentVerified ? h("span", { class: "pill pill-green" }, "Titre foncier contrôlé") : null,
        item.agencyVerified ? h("span", { class: "pill pill-green" }, "Agence vérifiée") : null,
        item.phoneVerified ? h("span", { class: "pill pill-green" }, "Tél. vérifié par SMS") : null,
        item.declaredDocument ? h("span", { class: "pill" }, item.declaredDocument) : null),
      h("a", { href, class: "btn btn-outline btn-block", "aria-label": `Voir le détail : ${item.title}` }, "Voir les détails →")));
}

const LAT = [12.55, 12.76];
const LNG = [-8.12, -7.9];
export function mapView(items) {
  const pins = items.filter((i) => i.latitude != null && i.longitude != null);
  const box = h("div", { class: "map", role: "group", "aria-label": "Carte des annonces" }, h("p", { class: "map-label" }, "Bamako et alentours"));
  const panel = h("div", { class: "card pad stack", hidden: true, "aria-live": "polite" });
  if (!pins.length) box.append(h("p", { class: "empty muted" }, "Aucune annonce géolocalisée pour ces filtres."));
  // Regroupement : les annonces d'une même case de 9 % de la carte forment un seul repère, qui affiche leur nombre.
  const cells = new Map();
  for (const item of pins) {
    const x = ((item.longitude - LNG[0]) / (LNG[1] - LNG[0])) * 100;
    const y = ((LAT[1] - item.latitude) / (LAT[1] - LAT[0])) * 100;
    const key = `${Math.floor(x / 9)}:${Math.floor(y / 9)}`;
    const cell = cells.get(key) ?? { x: 0, y: 0, items: [] };
    cell.x += x; cell.y += y; cell.items.push(item);
    cells.set(key, cell);
  }
  for (const cell of cells.values()) {
    const n = cell.items.length;
    const first = cell.items[0];
    const label = n === 1
      ? `${first.title}, ${formatPrice(first.price, first.transactionType)}`
      : `${n} annonces dans ce secteur`;
    const props = { class: `pin${n > 1 ? " is-cluster" : first.featured ? " is-featured" : ""}`, "aria-label": label };
    const pin = n === 1
      ? h("a", { ...props, href: `#/annonce/${encodeURIComponent(first.id)}` }, formatPrice(first.price).replace(" FCFA", ""))
      : h("button", { ...props, type: "button", onClick: () => {
          mount(panel, h("h2", null, `${n} annonces dans ce secteur`),
            h("ul", { class: "stack" }, cell.items.map((i) => h("li", null, h("a", { href: `#/annonce/${encodeURIComponent(i.id)}` }, `${i.title} · ${formatPrice(i.price, i.transactionType)}`)))));
          panel.hidden = false;
        } }, String(n));
    pin.style.left = `${Math.min(92, Math.max(8, cell.x / n))}%`;
    pin.style.top = `${Math.min(90, Math.max(14, cell.y / n))}%`;
    box.append(pin);
  }
  // Vrai fond de carte (Mapbox) par-dessus les repères simples, qui restent en secours si Mapbox n'est pas disponible.
  if (pins.length) {
    const gl = h("div", { class: "map-gl" });
    box.prepend(gl);
    const start = async () => {
      const { createListingsMap } = await import("/js/map/provider.js");
      const real = await createListingsMap(gl, pins.map((i) => ({ id: i.id, lat: Number(i.latitude), lng: Number(i.longitude), featured: Boolean(i.featured), image: i.imageUrl, label: `${i.transactionType} · ${i.title.length > 22 ? `${i.title.slice(0, 21)}…` : i.title}` })),
        (id) => { location.hash = `#/annonce/${encodeURIComponent(id)}`; });
      if (real) box.classList.add("has-gl"); else gl.remove();
    };
    let tries = 0;
    const wait = () => { if (box.isConnected) start().catch(() => gl.remove()); else if (tries++ < 120) requestAnimationFrame(wait); };
    requestAnimationFrame(wait);
  }
  return h("div", { class: "stack" }, box, panel);
}
