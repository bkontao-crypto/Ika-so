// Accueil de la refonte : héros, recherche avancée, sections éditoriales.
// Toutes les données viennent des API existantes (/listings, /campaigns/*, /advertisers, /homepage-settings) :
// une section sans donnée réelle est simplement masquée — aucune annonce, statistique ou avis n'est inventé.
import { CATEGORIES, ZONES, api, digits, formatPrice, h, mount } from "/js/dom.js";
import { S, app } from "/js/core/state.js";
import { field, select } from "/js/components/ui.js";
import { icon } from "/js/icons.js";
import { listingCard } from "/js/components/listing-card.js";

const DEFAULT_HERO = {
  image: "/media/villa-badala.jpg",
  badge: "L'immobilier au Mali, en toute confiance",
  titleLine1: "Trouvez le lieu où",
  titleLine2: "commence votre histoire.",
  subtitle: "Maisons, appartements, terrains, locaux commerciaux et bureaux au Mali : des annonces relues, des numéros vérifiés par code, un contact direct.",
};
const KINDS = [
  { category: "Maison", title: "Maisons & villas", text: "Un espace pour vivre", icon: "home" },
  { category: "Appartement", title: "Appartements", text: "La ville à portée de main", icon: "building" },
  { category: "Terrain", title: "Terrains", text: "Construisez votre avenir", icon: "ruler" },
  { category: "Studio", title: "Studios", text: "Pratique, au cœur de la ville", icon: "sofa" },
  { category: "Local commercial", title: "Locaux commerciaux", text: "Boutiques, magasins, entrepôts", icon: "store" },
  { category: "Bureau", title: "Bureaux", text: "Des espaces pour travailler", icon: "briefcase" },
];
const GUIDES = [
  ["acheter-un-terrain-a-bamako", "Acheter un terrain à Bamako : les étapes à suivre"],
  ["verifier-un-document-foncier", "Vérifier un document foncier avant d'acheter"],
  ["reperer-les-arnaques-immobilieres", "Repérer les arnaques immobilières"],
];
const initials = (name) => (String(name || "IK").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("") || "IK").toUpperCase();


  // ---- Téléchargement de l'application IKA SO ----
  const downloadApp = h("section", {
    class: "ikaso-app-download",
    style: {
      margin: "30px 16px",
      padding: "28px 22px",
      borderRadius: "22px",
      background: "linear-gradient(145deg, #073b28, #126744)",
      color: "#ffffff",
      boxSizing: "border-box",
      overflow: "hidden"
    }
  },
    h("span", {
      style: {
        color: "#e9bd55",
        fontSize: "11px",
        fontWeight: "800",
        letterSpacing: "1.5px"
      }
    }, "APPLICATION MOBILE OFFICIELLE"),

    h("h2", {
      style: {
        color: "#ffffff",
        fontSize: "28px",
        lineHeight: "1.25",
        margin: "18px 0"
      }
    }, "L'immobilier au Mali, ", 
       h("span", { style: { color: "#e9bd55" } },
         "dans votre poche.")),

    h("p", {
      style: {
        color: "#e5eee8",
        fontSize: "15px",
        lineHeight: "1.7"
      }
    }, "Téléchargez gratuitement IKA SÔ et retrouvez toutes nos annonces immobilières sur votre smartphone."),

    h("div", {
      style: {
        margin: "22px 0",
        lineHeight: "2",
        fontSize: "14px",
        color: "#ffffff"
      }
    },
      h("div", null, "✓ Annonces immobilières"),
      h("div", null, "✓ Maisons, terrains et appartements"),
      h("div", null, "✓ Contact direct avec les agences")
    ),

    h("a", {
      href: "/downloads/ika-so.apk",
      download: "IKA-SO.apk",
      style: {
        display: "block",
        padding: "17px 10px",
        borderRadius: "13px",
        background: "#e9bd55",
        color: "#103b29",
        textAlign: "center",
        textDecoration: "none",
        fontWeight: "800",
        fontSize: "16px"
      }
    },
      "↓ Télécharger IKA SÔ",
      h("small", {
        style: {
          display: "block",
          fontSize: "11px",
          marginTop: "5px",
          fontWeight: "500"
        }
      }, "ANDROID · GRATUIT")
    )
  );



/** Apparition progressive : une seule observation, désactivée si l'utilisateur réduit les animations. */
function reveal(root) {
  const nodes = root.querySelectorAll(".rx-reveal");
  if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    nodes.forEach((n) => n.classList.add("is-in"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
  }, { rootMargin: "0px 0px -8% 0px" });
  nodes.forEach((n) => io.observe(n));
}

const sectionHead = (kicker, title, text, link) => h("div", { class: "rx-sec-head" },
  h("div", null, h("span", { class: "rx-kicker" }, kicker), h("h2", null, title), text ? h("p", null, text) : null),
  link ? h("a", { class: "rx-link", href: link[0] }, link[1], " →") : null);


const section = (id, ...children) =>
  h("section", { class: "rx-sec rx-reveal", id }, ...children);



export async function renderHome() {
  let hero = { ...DEFAULT_HERO };
  try { hero = { ...hero, ...await api("/homepage-settings") }; } catch { /* valeurs par défaut */ }
  const favorites = new Set(S.meta?.favoriteIds ?? []);

  // ---- Héros + recherche avancée (envoie vers #/annonces avec les filtres déjà gérés par la page) ----
  const f = { mode: "Vente", zone: "", category: "", minPrice: "", maxPrice: "" };
  const tabs = [["Vente", "Acheter"], ["Location", "Louer"], ["Terrain", "Terrains"]];
  const tabButtons = tabs.map(([value, label]) => h("button", {
    type: "button", class: "rx-tab", "aria-pressed": String(f.mode === value),
    onClick: () => { f.mode = value; tabButtons.forEach((b, i) => b.setAttribute("aria-pressed", String(tabs[i][0] === value))); },
  }, label));
  const money = (key, ph) => h("input", { class: "input", inputmode: "numeric", placeholder: ph, "aria-label": ph, onInput: (e) => { f[key] = digits(e.target.value); e.target.value = f[key]; } });
  const form = h("form", { class: "rx-search-form", role: "search", "aria-label": "Recherche immobilière", onSubmit: (e) => {
    e.preventDefault();
    const qs = new URLSearchParams();
    if (f.mode === "Terrain") { qs.set("category", "Terrain"); qs.set("t", "Vente"); } else qs.set("t", f.mode);
    if (f.category && f.mode !== "Terrain") qs.set("category", f.category);
    if (f.zone) qs.set("zone", f.zone);
    if (f.minPrice) qs.set("minPrice", f.minPrice);
    if (f.maxPrice) qs.set("maxPrice", f.maxPrice);
    location.hash = `#/annonces?${qs}`;
  } },
    field("Quartier", select(ZONES.map((z) => z.name), "", (v) => { f.zone = v; }, { blank: "Tous les quartiers" })),
    field("Type de bien", select(CATEGORIES, "", (v) => { f.category = v; }, { blank: "Tous les types" })),
    field("Budget min. (FCFA)", money("minPrice", "0")),
    field("Budget max. (FCFA)", money("maxPrice", "Sans limite")),
    h("button", { class: "btn btn-gold rx-go", type: "submit" }, icon("search"), "Rechercher"));
  const quick = h("div", { class: "rx-quick" }, h("span", null, "Recherches rapides :"),
    h("a", { href: "#/annonces?t=Vente&category=Terrain" }, "Terrains à vendre"),
    h("a", { href: "#/annonces?t=Location&category=Appartement" }, "Appartements à louer"),
    h("a", { href: "#/annonces?t=Vente&category=Maison" }, "Maisons à vendre"),
    h("a", { href: "#/carte" }, "Voir sur la carte"));

  const heroEl = h("section", { class: "rx-hero", style: {
    "--hero-photo": `url("${hero.image}")`, "--hero-overlay": hero.overlayColor || "#04120b", "--hero-accent": hero.accentColor || "#f0b429",
  } },
    h("div", { class: "rx-hero-bg", "aria-hidden": "true" }),
    h("div", { class: "rx-hero-inner" },
      h("span", { class: "rx-eyebrow" }, hero.badge),
      h("h1", null, hero.titleLine1, h("span", null, hero.titleLine2)),
      h("p", { class: "rx-hero-lead" }, hero.subtitle),
      h("ul", { class: "rx-hero-points" }, ["Annonces relues avant publication", "Numéro vérifié par code SMS", "Contact direct par appel ou WhatsApp"].map((t) => h("li", null, icon("check"), t)))));
  const searchEl = h("div", { class: "rx-search-wrap" }, h("div", { class: "rx-search" },
    h("div", { class: "rx-tabs", role: "group", "aria-label": "Type de recherche" }, tabButtons), form, quick));

  const catsEl = section("categories", sectionHead("Explorer", "Un bien pour chaque projet", "Les catégories les plus recherchées sur la plateforme."),
    h("div", { class: "rx-cats" }, KINDS.map((k) => h("a", { class: "rx-cat", href: `#/annonces?category=${encodeURIComponent(k.category)}` },
      h("span", { class: "rx-cat-ic" }, icon(k.icon)), h("strong", null, k.title), h("small", null, k.text), h("span", { class: "go" }, "Voir les annonces →")))));

  // Emplacements dynamiques : remplis une fois les données reçues.
  const hosts = {
    sponsored: h("div", { class: "rx-reveal", id: "annonces-sponsorisees" }),
    latest: h("div", { class: "rx-reveal", id: "annonces" }),
    lands: h("div", { class: "rx-reveal", id: "terrains" }),
    homes: h("div", { class: "rx-reveal", id: "villas-appartements" }),
    agencies: h("div", { class: "rx-reveal", id: "agences" }),
    ads: h("div", { class: "rx-reveal", id: "partenaires-services" }),
  };

  const hoods = section("quartiers", sectionHead("Quartiers", "Explorer par quartier", "Parcourez les annonces d'un quartier, ou consultez les prix et repères par quartier.", ["/quartiers", "Tous les quartiers"]),
    h("div", { class: "rx-hoods" }, ZONES.map((z) => h("a", { class: "rx-hood", href: `#/annonces?zone=${encodeURIComponent(z.name)}` }, icon("pin"), z.name))));

  const how = section("comment-ca-marche", sectionHead("Simple et clair", "Comment fonctionne IKA SO ?"),
    h("div", { class: "rx-steps" }, [
      ["Recherchez", "Filtrez par type de bien, quartier et budget, en grille, en liste ou sur la carte."],
      ["Contactez en confiance", "Appelez, écrivez sur WhatsApp ou utilisez la messagerie. Les numéros sont vérifiés par code SMS."],
      ["Visitez et vérifiez", "Demandez les documents, visitez le bien et faites contrôler le titre avant tout paiement."],
    ].map(([t, p]) => h("article", { class: "rx-step" }, h("h3", null, t), h("p", null, p)))));

  const trust = section("confiance", sectionHead("Confiance", "Pourquoi faire confiance à IKA SO ?", "Des repères concrets, et l'honnêteté sur leurs limites.", ["#/confiance", "Centre de confiance"]),
    h("div", { class: "rx-trust" }, [
      ["shield-check", "Annonces relues", "Chaque annonce est relue avant sa publication."],
      ["phone", "Numéro contrôlé", "Le téléphone de l'annonceur est vérifié par un code SMS."],
      ["file", "Documents : déclaré ≠ vérifié", "Un document n'est présenté comme contrôlé qu'après validation réelle."],
      ["flag", "Signalement et réclamations", "Signalez une annonce ou déposez une réclamation, suivie par l'équipe."],
    ].map(([ic, t, p]) => h("article", null, icon(ic), h("h3", null, t), h("p", null, p)))));

  const cta = h("section", { class: "rx-cta rx-reveal", id: "vendre" }, h("div", { class: "rx-cta-inner" },
    h("div", null, h("span", { class: "rx-kicker" }, "Devenir annonceur"), h("h2", null, "Donnez à votre bien la visibilité qu'il mérite."),
      h("p", null, "Propriétaire, agence ou démarcheur : publiez en quelques minutes, suivez vos demandes et mettez vos annonces en avant."),
      h("div", { class: "row" },
        h("a", { class: "btn btn-gold", href: "#/publier" }, icon("plus"), "Publier une annonce"),
        h("a", { class: "btn btn-glass", href: "#/devenir-annonceur" }, "Devenir annonceur professionnel"))),
    h("ul", null, ["Photos, prix et localisation du bien", "Numéro vérifié par code SMS", "Annonce relue avant publication", "Contact direct par appel, WhatsApp ou messagerie"].map((t) => h("li", null, icon("check"), t)))));

  const partners = section("partenaires", h("div", { class: "rx-partners-band" },
    h("div", null, h("span", { class: "rx-kicker" }, "Partenaires et services"), h("h2", { class: "title" }, "Services immobiliers"),
      h("p", null, "Mise à la une, espace agence, annuaire des agences : découvrez les services qui accélèrent vos projets.")),
    h("a", { class: "btn btn-primary", href: "#/partenaires" }, "Découvrir les services")));

  const guides = section("guides", sectionHead("Guides et conseils", "Acheter, vendre, louer sans se tromper", null, ["/guides", "Tous les guides"]),
    h("div", { class: "rx-guides" }, GUIDES.map(([slug, title]) => h("a", { class: "rx-guide", href: `/guides/${slug}` }, h("strong", null, title), h("span", null, "Lire le guide →")))));

  mount(app, heroEl, searchEl, catsEl,
    h("section", { class: "rx-sec" }, hosts.sponsored), h("section", { class: "rx-sec" }, hosts.latest),
    h("section", { class: "rx-sec" }, hosts.lands), h("section", { class: "rx-sec" }, hosts.homes),
    hoods, h("section", { class: "rx-sec" }, hosts.agencies), how, trust, cta, h("section", { class: "rx-sec" }, 
hosts.ads), partners, guides, downloadApp);

  reveal(app);

  // ---- Chargement des données réelles (une panne d'une source n'empêche jamais les autres) ----
  const skeleton = () => h("div", { class: "listing-grid" }, [0, 1, 2].map(() => h("div", { class: "skeleton", style: { height: "340px" } })));
  mount(hosts.latest, sectionHead("Dernières annonces", "Les biens à découvrir", "Les annonces les plus récentes publiées sur la plateforme.", ["#/annonces", "Voir toutes les annonces"]), skeleton());
  const get = (path, fallback) => api(path).catch(() => fallback);
  const [latest, lands, maisons, apparts, camps, ads, adv] = await Promise.all([
    get("/listings?limit=12", null), get("/listings?category=Terrain&limit=3", []), get("/listings?category=Maison&limit=2", []),
    get("/listings?category=Appartement&limit=2", []), get("/campaigns/sponsored", []), get("/campaigns/sidebar?placement=home", []),
    get("/advertisers?limit=4", { items: [] }),
  ]);
  const grid = (items) => h("div", { class: "listing-grid" }, items.map((i) => listingCard(i, favorites)));

  // Publications sponsorisées : campagnes SPONSORED actives puis annonces réellement « mises à la une ».
  const items = Array.isArray(latest) ? latest : [];
  const campaigns = (Array.isArray(camps) ? camps : []).filter((c) => c.linkUrl);
  const campaignIds = new Set(campaigns.map((c) => c.listing?.id).filter(Boolean));
  const featured = items.filter((i) => i.featured && !campaignIds.has(i.id));
  const post = (who, verified, caption, href, image, title, price, cta, external) => h("article", { class: "card sponsored-post" },
    h("div", { class: "sponsored-post-top" }, h("div", { class: "sponsored-avatar", "aria-hidden": "true" }, initials(who)),
      h("div", { class: "sponsored-identity" }, h("strong", null, who + (verified ? " · Agence vérifiée" : "")), h("small", null, "Sponsorisé"))),
    h("div", { class: "sponsored-caption" }, caption),
    image ? h("a", { class: "sponsored-media", href, ...(external ? { target: "_blank", rel: "noopener noreferrer sponsored" } : {}), "aria-label": title, style: { "background-image": `url("${image}")` } }, h("span", { class: "sponsored-media-label" }, "Sponsorisé")) : null,
    h("div", { class: "sponsored-destination" }, h("div", null, h("strong", null, title), price ? h("small", null, price) : null),
      h("a", { class: "sponsored-cta", href, ...(external ? { target: "_blank", rel: "noopener noreferrer sponsored" } : {}) }, cta)));
  const posts = [
    ...campaigns.map((c) => {
      const l = c.listing; const ext = /^https:/i.test(c.linkUrl);
      return post(l ? (l.agencyName || l.ownerName || "Annonceur") : c.name, l?.agencyVerified, c.text || (l ? l.title : c.name), c.linkUrl, c.imageUrl, l?.title || c.name, l ? formatPrice(l.price, l.transactionType) : "", c.ctaLabel || "Découvrir", ext);
    }),
    ...featured.map((i) => post(i.agencyName || i.ownerName || "Annonceur", i.agencyVerified, `${i.category} ${i.transactionType === "Location" ? "à louer" : "à vendre"} à ${i.neighborhood || "Bamako"} — ${i.title}`,
      `#/annonce/${encodeURIComponent(i.id)}`, i.imageUrl, i.title, formatPrice(i.price, i.transactionType), "Découvrir", false)),
  ].slice(0, 3);
  mount(hosts.sponsored, sectionHead("À la une", "Biens mis en avant", "Les annonces mises à la une par leurs annonceurs.", ["#/partenaires", "Mettre mon annonce à la une"]),
    posts.length ? h("div", { class: "sponsored-feed-list" }, posts)
      : h("div", { class: "empty-state" }, h("strong", null, "Aucune annonce à la une pour le moment."), "Propriétaires et agences : mettez une annonce à la une pour qu'elle apparaisse ici, avant les annonces classiques.",
        h("p", null, h("a", { class: "btn btn-small btn-outline", href: "#/mes-annonces" }, "Mettre mon annonce à la une"))));

  const fresh = items.filter((i) => !i.featured);
  const six = (fresh.length ? fresh : items).slice(0, 6);
  mount(hosts.latest, sectionHead("Dernières annonces", "Les biens à découvrir", "Les annonces les plus récentes publiées sur la plateforme.", ["#/annonces", "Voir toutes les annonces"]),
    latest === null ? h("p", { class: "notice" }, "Les annonces ne peuvent pas être chargées pour le moment. Vérifiez votre connexion et réessayez.")
      : six.length ? grid(six) : h("div", { class: "empty-state" }, h("strong", null, "Aucune annonce publiée pour le moment."), "Revenez bientôt ou publiez la vôtre."));

  const optional = (host, kicker, title, text, link, list) => {
    if (!Array.isArray(list) || !list.length) return mount(host);
    mount(host, sectionHead(kicker, title, text, link), grid(list));
  };
  optional(hosts.lands, "Terrains", "Terrains disponibles", "Parcelles et terrains proposés par des propriétaires et des agences.", ["#/annonces?category=Terrain", "Tous les terrains"], lands);
  const mm = Array.isArray(maisons) ? maisons : []; const aa = Array.isArray(apparts) ? apparts : [];
  const homes = [mm[0], aa[0], mm[1], aa[1]].filter(Boolean).slice(0, 3); // alternance maisons / appartements
  optional(hosts.homes, "Habitat", "Villas et appartements", "Maisons, villas et appartements pour vivre ou investir.", ["#/annonces", "Toutes les annonces"], homes);

  const agencies = Array.isArray(adv?.items) ? adv.items : [];
  if (agencies.length) {
    mount(hosts.agencies, sectionHead("Annonceurs", "Agences et annonceurs recommandés", "Classés selon des critères publics (confiance, visibilité, réactivité).", ["#/annonceurs", "Tout l'annuaire"]),
      h("div", { class: "rx-agencies" }, agencies.map((a) => h("a", { class: "rx-agency", href: `#/annonceur/${encodeURIComponent(a.id)}` },
        h("span", { class: "avatar av-0", "aria-hidden": "true" }, initials(a.name)),
        h("span", null, h("strong", null, a.name), h("small", null, [a.role, a.neighborhood, `${a.listings} annonce${a.listings > 1 ? "s" : ""}`].filter(Boolean).join(" · ")))))));
  } else mount(hosts.agencies);

  // Espaces publicitaires réels (campagnes sidebar de la page d'accueil) : conservés, présentés en « partenaires ».
  const sideAds = Array.isArray(ads) ? ads : [];
  if (sideAds.length) {
    mount(hosts.ads, sectionHead("Partenaires", "Offres de nos partenaires"),
      h("div", { class: "rx-guides" }, sideAds.map((ad) => {
        const ext = /^https:/i.test(ad.linkUrl);
        return h("a", { class: "rx-guide", href: ad.linkUrl, ...(ext ? { target: "_blank", rel: "noopener noreferrer sponsored" } : {}) },
          ad.imageUrl ? h("img", { src: ad.imageUrl, alt: "", loading: "lazy" }) : null, h("strong", null, ad.name), ad.text ? h("small", { class: "muted" }, ad.text) : null, h("span", null, `${ad.ctaLabel || "Découvrir"} →`));
      })));
  } else mount(hosts.ads);
  reveal(app);
}
