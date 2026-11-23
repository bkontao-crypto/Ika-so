import { badRequest } from "../lib/errors.js";
import { storeDataUrl } from "../lib/file-storage.js";
import { MIN_TEXT, normalizeHex, ratio, suggestInk } from "../../public/js/lib/contrast.js";

// Onglets d'origine : toujours présents (masquables, jamais supprimables), pour pouvoir revenir à la version initiale.
export const SYSTEM_TABS = Object.freeze([
  { id: "home", label: "Accueil", href: "#/" },
  { id: "buy", label: "Acheter", href: "#/annonces?t=Vente" },
  { id: "rent", label: "Louer", href: "#/annonces?t=Location" },
  { id: "land", label: "Terrains", href: "#/annonces?category=Terrain" },
  { id: "map", label: "Carte", href: "#/carte" },
  { id: "discover", label: "Découvrir", href: "#/decouvrir" },
  { id: "advertisers", label: "Annonceurs", href: "#/annonceurs" },
  { id: "partners", label: "Partenaires", href: "#/partenaires" },
]);
// Barre du bas sur mobile : 3 à 5 accès parmi ce catalogue ; « Compte » reste obligatoire (accès à la connexion).
export const MOBILE_CATALOG = Object.freeze([
  ["home", "Accueil"], ["discover", "Découvrir"], ["publish", "Publier"], ["map", "Carte"], ["account", "Compte"],
  ["buy", "Acheter"], ["rent", "Louer"], ["land", "Terrains"], ["advertisers", "Annonceurs"], ["partners", "Partenaires"], ["alerts", "Alertes"], ["inbox", "Messages"],
].map(([id, label]) => ({ id, label })));
const MOBILE_DEFAULT = Object.freeze(["home", "discover", "publish", "map", "account"]);
const DEFAULTS = Object.freeze({
  mobile: [...MOBILE_DEFAULT],
  tabs: SYSTEM_TABS.map((t) => ({ ...t, visible: true })),
  light: { bg: "", ink: "" }, dark: { bg: "", ink: "" }, // vide = couleurs du thème
  publishLabel: "Publier", publishVisible: true, themeToggle: true,
});
const MAX_TABS = 16;
const INTERNAL = /^#\/[\w\-/?=&%.]*$/;                       // page du site
const EXTERNAL = /^https:\/\/[^\s"'<>\\]+$/;                 // autre site (https uniquement)
const STATIC_LOGO = /^\/media\/[\w.-]+\.(jpe?g|png|webp)$/i;
const STORED_LOGO = /^\/api\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CUSTOM_ID = /^b_[a-z0-9]{6,12}$/;
const MAX_BLOCKS = 12;
const STATIC_IMAGE = STATIC_LOGO;
const SAFE_LOGO = /^(\/(?!\/)[^\s"'<>\\]*|https:\/\/[^\s"'<>\\]+)$/;

/** Contrôle de lisibilité d'une paire texte/fond : renvoie un message d'erreur, ou null. */
export function paletteProblem(name, pair) {
  const bg = pair.bg, ink = pair.ink;
  if (!bg && !ink) return null;
  if (!bg || !ink) return `${name} : indiquez la couleur du fond ET celle du texte (ou laissez les deux vides).`;
  const r = ratio(ink, bg);
  if (r >= MIN_TEXT) return null;
  return `${name} : texte illisible (contraste ${String(r).replace(".", ",")}:1, minimum 4,5:1). Utilisez ${suggestInk(ink, bg)} pour le texte.`;
}

// Sections de l'accueil (sous la recherche) : ordre et visibilité réglés par le superadmin. Le héros et la recherche restent en tête.
export const HOME_SECTIONS = Object.freeze([
  ["categories", "Catégories"], ["sponsored", "Biens mis en avant"], ["latest", "Dernières annonces"], ["lands", "Terrains"], ["homes", "Maisons"],
  ["quartiers", "Quartiers"], ["agencies", "Annonceurs recommandés"], ["how", "Comment ça marche"], ["trust", "Confiance"],
  ["cta", "Devenir annonceur"], ["ads", "Offres partenaires"], ["partners", "Partenaires et services"], ["guides", "Guides et conseils"], ["download", "Application mobile"],
].map(([id, label]) => ({ id, label })));

// Cartes modifiables (titre et texte ; l'icône et le nombre de cartes restent ceux d'origine).
export const HOME_CARDS = Object.freeze({ how: 3, trust: 4 });

export function createSiteHeader({ db, accounts, onChanged = () => {} }) {
  const setting = async (key) => (await db.query("select value from ika_settings where key = $1", [key]))[0]?.value ?? "";
  const put = (key, value) => db.query("insert into ika_settings (key, value) values ($1, $2) on conflict (key) do update set value = $2", [key, value]);

  function sanitize(input = {}) {
    const rawTabs = Array.isArray(input.tabs) ? input.tabs : DEFAULTS.tabs;
    if (rawTabs.length > MAX_TABS) throw badRequest(`Pas plus de ${MAX_TABS} onglets.`);
    const seen = new Set();
    const tabs = [];
    for (const t of rawTabs) {
      const sys = SYSTEM_TABS.find((s) => s.id === t?.id);
      const id = sys ? sys.id : String(t?.id ?? "").match(/^c_[a-z0-9]{4,12}$/)?.[0];
      if (!id || seen.has(id)) throw badRequest("Onglet invalide ou en double.");
      seen.add(id);
      const label = String(t.label ?? "").trim();
      if (!label || label.length > 24) throw badRequest("Le nom d'un onglet est obligatoire (24 caractères maximum).");
      const href = sys ? sys.href : String(t.href ?? "").trim();
      if (!sys && !(INTERNAL.test(href) || EXTERNAL.test(href))) throw badRequest(`Lien invalide pour « ${label} » : une page du site (#/…) ou une adresse https.`);
      tabs.push({ id, label, href, visible: t.visible !== false, ...(sys ? {} : { custom: true }) });
    }
    for (const s of SYSTEM_TABS) if (!seen.has(s.id)) tabs.push({ ...s, visible: false }); // un onglet d'origine omis est masqué, jamais perdu
    if (!tabs.some((t) => t.visible)) throw badRequest("Au moins un onglet doit rester visible.");
    const pair = (p, name) => {
      const bg = p?.bg ? normalizeHex(p.bg) : "", ink = p?.ink ? normalizeHex(p.ink) : "";
      if ((p?.bg && !bg) || (p?.ink && !ink)) throw badRequest(`${name} : couleur invalide (code #RRGGBB).`);
      return { bg, ink };
    };
    const light = pair(input.light, "Thème clair"), dark = pair(input.dark, "Thème sombre");
    const problems = [paletteProblem("Thème clair", light), paletteProblem("Thème sombre", dark)].filter(Boolean);
    if (problems.length) throw badRequest(`Publication bloquée. ${problems.join(" ")}`);
    const publishLabel = String(input.publishLabel ?? DEFAULTS.publishLabel).trim();
    if (!publishLabel || publishLabel.length > 24) throw badRequest("Le texte du bouton est obligatoire (24 caractères maximum).");
    const mobile = Array.isArray(input.mobile) ? input.mobile : MOBILE_DEFAULT;
    if (mobile.length < 3 || mobile.length > 5 || new Set(mobile).size !== mobile.length || !mobile.every((id) => MOBILE_CATALOG.some((c) => c.id === id))) throw badRequest("Barre du bas : 3 à 5 accès différents, choisis dans la liste.");
    if (!mobile.includes("account")) throw badRequest("Barre du bas : « Compte » doit rester affiché (accès à la connexion).");
    return { tabs, mobile: [...mobile], light, dark, publishLabel, publishVisible: input.publishVisible !== false, themeToggle: input.themeToggle !== false };
  }

  async function config() {
    let saved = {};
    try { saved = JSON.parse(await setting("site_header") || "{}"); } catch { saved = {}; }
    try { return sanitize({ ...DEFAULTS, ...saved }); } catch { return { ...DEFAULTS }; } // une valeur ancienne ou altérée ne casse jamais le site
  }
  async function logo() {
    const url = String(await setting("platform_logo")).trim();
    return SAFE_LOGO.test(url) ? url : "";
  }

  // Bloc libre de l'accueil : texte, texte + image, ou appel à l'action. Texte brut uniquement ; image du site ou importée ; couleurs contrôlées.
  function sanitizeBlock(b, allowedImages) {
    if (!b || typeof b !== "object") throw badRequest("Bloc invalide.");
    const type = ["text", "image", "cta", "gallery"].includes(b.type) ? b.type : null;
    if (!type) throw badRequest("Type de bloc inconnu.");
    const str = (v, max, name) => { const t = String(v ?? "").trim(); if (t.length > max) throw badRequest(`${name} : ${max} caractères maximum.`); return t; };
    const title = str(b.title, 120, "Titre"), text = str(b.text, 600, "Texte"), alt = str(b.alt, 120, "Description de l'image");
    const imageUrl = String(b.imageUrl ?? "").trim();
    if (imageUrl && !(STATIC_IMAGE.test(imageUrl) || (STORED_LOGO.test(imageUrl) && (!allowedImages || allowedImages.has(imageUrl))))) throw badRequest("Image : importez un fichier (PNG, JPEG, WebP) ou choisissez un fichier /media/… du site.");
    if (type === "image" && !imageUrl) throw badRequest("Un bloc « texte + image » demande une image.");
    // Galerie : jusqu'à 6 images, chacune avec sa description.
    const rawImages = type === "gallery" ? (Array.isArray(b.images) ? b.images : []) : [];
    if (rawImages.length > 6) throw badRequest("Une galerie contient 6 images au maximum.");
    const images = rawImages.map((im) => {
      const url = String(im?.url ?? "").trim();
      if (!(STATIC_IMAGE.test(url) || (STORED_LOGO.test(url) && (!allowedImages || allowedImages.has(url))))) throw badRequest("Galerie : importez des fichiers (PNG, JPEG, WebP) ou choisissez des fichiers /media/… du site.");
      return { url, alt: str(im?.alt, 120, "Description de l'image") };
    });
    if (type === "gallery" && !images.length) throw badRequest("Une galerie demande au moins une image.");
    if (!title && !text && !imageUrl && !images.length) throw badRequest("Un bloc ne peut pas être vide.");
    const buttonLabel = str(b.buttonLabel, 30, "Bouton"), buttonHref = String(b.buttonHref ?? "").trim();
    if (!!buttonLabel !== !!buttonHref) throw badRequest("Bouton : indiquez le nom ET le lien (ou aucun des deux).");
    if (buttonHref && !(INTERNAL.test(buttonHref) || SITE_PATH.test(buttonHref) || EXTERNAL.test(buttonHref))) throw badRequest("Lien du bouton invalide : une page du site (#/… ou /…) ou une adresse https.");
    const bg = b.bg ? normalizeHex(b.bg) : "", ink = b.ink ? normalizeHex(b.ink) : "";
    if ((b.bg && !bg) || (b.ink && !ink)) throw badRequest("Couleur invalide (code #RRGGBB).");
    const problem = paletteProblem(`Bloc « ${title || type} »`, { bg, ink });
    if (problem) throw badRequest(`Publication bloquée. ${problem}`);
    const d = b.devices && typeof b.devices === "object" ? b.devices : {};
    const devices = { desktop: d.desktop !== false, tablet: d.tablet !== false, mobile: d.mobile !== false };
    if (!devices.desktop && !devices.tablet && !devices.mobile) throw badRequest("Le bloc doit s'afficher sur au moins un appareil.");
    return { type, title, text, imageUrl, alt, images, buttonLabel, buttonHref, bg, ink, devices };
  }
  function sanitizeLayout(input = {}, allowedImages = null) {
    const raw = Array.isArray(input.sections) ? input.sections : HOME_SECTIONS.map((x) => ({ id: x.id, visible: true }));
    const known = new Set(HOME_SECTIONS.map((x) => x.id)), seen = new Set(), sections = [];
    let customCount = 0;
    for (const x of raw) {
      if (CUSTOM_ID.test(String(x?.id ?? ""))) { // bloc libre ajouté par le superadmin
        if (seen.has(x.id)) throw badRequest("Bloc en double.");
        if (++customCount > MAX_BLOCKS) throw badRequest(`Pas plus de ${MAX_BLOCKS} blocs libres.`);
        seen.add(x.id); sections.push({ id: x.id, visible: x.visible !== false, custom: true, block: sanitizeBlock(x.block, allowedImages) });
        continue;
      }
      if (!known.has(x?.id) || seen.has(x.id)) throw badRequest("Section invalide ou en double.");
      seen.add(x.id); sections.push({ id: x.id, visible: x.visible !== false });
    }
    for (const x of HOME_SECTIONS) if (!seen.has(x.id)) sections.push({ id: x.id, visible: true }); // une section oubliée n'est jamais perdue
    // Textes d'en-tête de section (vide = texte d'origine). Texte brut uniquement : le site les affiche comme du texte, jamais comme du HTML.
    const LIM = { kicker: 40, title: 120, text: 300 }, texts = {};
    const rawTexts = input.texts && typeof input.texts === "object" && !Array.isArray(input.texts) ? input.texts : {};
    for (const [id, t] of Object.entries(rawTexts)) {
      if (!known.has(id) || id === "download") throw badRequest("Section invalide pour ces textes.");
      const one = {};
      for (const [k, max] of Object.entries(LIM)) {
        const v = String(t?.[k] ?? "").trim();
        if (v.length > max) throw badRequest(`Le texte « ${k} » est limité à ${max} caractères.`);
        if (v) one[k] = v;
      }
      if (Object.keys(one).length) texts[id] = one;
    }
    const cards = {};
    const rawCards = input.cards && typeof input.cards === "object" && !Array.isArray(input.cards) ? input.cards : {};
    for (const [id, list] of Object.entries(rawCards)) {
      if (!HOME_CARDS[id] || !Array.isArray(list) || list.length > HOME_CARDS[id]) throw badRequest("Cartes invalides.");
      const out = list.map((c) => {
        const title = String(c?.title ?? "").trim(), text = String(c?.text ?? "").trim();
        if (title.length > 60) throw badRequest("Le titre d'une carte est limité à 60 caractères.");
        if (text.length > 200) throw badRequest("Le texte d'une carte est limité à 200 caractères.");
        return { title, text };
      });
      if (out.some((c) => c.title || c.text)) cards[id] = out;
    }
    return { sections, texts, cards };
  }
  // Pied de page : texte de présentation, colonnes de liens, mention de droits. Les liens légaux et le choix des cookies restent fixes dans la page.
  const FOOTER_DEFAULT = Object.freeze({
    intro: "La plateforme immobilière du Mali : terrains, maisons, appartements, studios, locaux commerciaux et bureaux, avec des numéros vérifiés par code et des annonces relues avant publication.",
    copyright: "IKA SO Immobilier. Tous droits réservés.",
    columns: [
      { title: "Rechercher", links: [["Acheter", "#/annonces?t=Vente"], ["Louer", "#/annonces?t=Location"], ["Terrains", "#/annonces?category=Terrain"], ["Carte immobilière", "#/carte"], ["Quartiers", "/quartiers"]] },
      { title: "Professionnels", links: [["Publier une annonce", "#/publier"], ["Annonceurs", "#/annonceurs"], ["Agences vérifiées", "/agences"], ["Devenir annonceur", "#/devenir-annonceur"], ["Partenaires", "#/partenaires"]] },
      { title: "Confiance", links: [["Centre de confiance", "#/confiance"], ["Guides et conseils", "/guides"], ["Réclamations", "#/reclamations"], ["Messages", "#/boite"]] },
    ].map((c) => ({ title: c.title, links: c.links.map(([label, href]) => ({ label, href })) })),
  });
  const SITE_PATH = /^\/(?!\/)[\w\-/]*$/; // page du site (/guides, /quartiers…)
  function sanitizeFooter(input = {}) {
    const intro = String(input.intro ?? FOOTER_DEFAULT.intro).trim(), copyright = String(input.copyright ?? FOOTER_DEFAULT.copyright).trim();
    if (!intro || intro.length > 400) throw badRequest("Le texte de présentation est obligatoire (400 caractères maximum).");
    if (!copyright || copyright.length > 120) throw badRequest("La mention de droits est obligatoire (120 caractères maximum).");
    const rawCols = Array.isArray(input.columns) ? input.columns : FOOTER_DEFAULT.columns;
    if (rawCols.length > 4) throw badRequest("Pas plus de 4 colonnes.");
    const columns = rawCols.map((c) => {
      const title = String(c?.title ?? "").trim();
      if (!title || title.length > 30) throw badRequest("Le titre d'une colonne est obligatoire (30 caractères maximum).");
      const rawLinks = Array.isArray(c.links) ? c.links : [];
      if (rawLinks.length > 10) throw badRequest("Pas plus de 10 liens par colonne.");
      const links = rawLinks.map((l) => {
        const label = String(l?.label ?? "").trim(), href = String(l?.href ?? "").trim();
        if (!label || label.length > 40) throw badRequest("Le nom d'un lien est obligatoire (40 caractères maximum).");
        if (!(INTERNAL.test(href) || SITE_PATH.test(href) || EXTERNAL.test(href))) throw badRequest(`Lien invalide pour « ${label} » : une page du site (#/… ou /…) ou une adresse https.`);
        return { label, href };
      });
      return { title, links };
    });
    return { intro, copyright, columns };
  }
  async function footer() {
    try { return sanitizeFooter(JSON.parse(await setting("site_footer") || "{}")); } catch { return sanitizeFooter({}); }
  }

  // Une image est acceptée si elle vient d'être importée ici (en attente), ou figure déjà dans l'accueil publié.
  const imagesOf = (l) => l.sections.flatMap((x) => [x.block?.imageUrl, ...(x.block?.images ?? []).map((i) => i.url)]).filter(Boolean);
  async function allowedImages() {
    let pending = []; try { pending = JSON.parse(await setting("home_block_pending") || "[]"); } catch { pending = []; }
    return new Set([...pending, ...imagesOf(await layout())]);
  }
  async function draft() {
    const raw = await setting("home_layout_draft");
    if (!raw) return null;
    try { return sanitizeLayout(JSON.parse(raw)); } catch { return null; } // brouillon altéré : ignoré, jamais publié
  }
  async function layout() {
    try { return sanitizeLayout(JSON.parse(await setting("home_layout") || "{}")); } catch { return sanitizeLayout({}); }
  }

  return {
    sanitize,
    getFooter: footer,
    async saveFooter(userId, input) {
      await accounts.requirePermission(userId, "contenu.gerer");
      if (!input || typeof input !== "object" || Array.isArray(input)) throw badRequest("Configuration invalide.");
      const next = sanitizeFooter(input);
      await put("site_footer", JSON.stringify(next));
      await accounts.audit(userId, "SITE_FOOTER_SAVE", null, `${next.columns.length} colonne(s), ${next.columns.reduce((n, c) => n + c.links.length, 0)} lien(s)`);
      return next;
    },
    /** Public : lu par l'accueil. */
    getLayout: layout,
    async getLayoutForStaff(userId) { await accounts.requirePermission(userId, "contenu.gerer"); return { ...(await layout()), draft: await draft(), labels: Object.fromEntries(HOME_SECTIONS.map((x) => [x.id, x.label])), cardCounts: HOME_CARDS }; },
    /** Brouillon : même validation que la publication, mais rien n'est visible des visiteurs. */
    async saveLayoutDraft(userId, input) {
      await accounts.requirePermission(userId, "contenu.gerer");
      if (!input || typeof input !== "object" || Array.isArray(input)) throw badRequest("Configuration invalide.");
      const next = sanitizeLayout(input, await allowedImages());
      await put("home_layout_draft", JSON.stringify(next));
      await accounts.audit(userId, "HOME_LAYOUT_DRAFT_SAVE", null, `${next.sections.filter((x) => x.custom).length} bloc(s) libre(s), brouillon non publié`);
      return next;
    },
    async discardLayoutDraft(userId) {
      await accounts.requirePermission(userId, "contenu.gerer");
      await put("home_layout_draft", "");
      await accounts.audit(userId, "HOME_LAYOUT_DRAFT_DISCARD", null, "brouillon abandonné");
      return { ok: true };
    },
    /** Aperçu réservé au personnel : le brouillon s'il existe, sinon la version publiée. */
    async previewLayout(userId) {
      await accounts.requirePermission(userId, "contenu.gerer");
      return (await draft()) ?? (await layout());
    },
    async uploadBlockImage(userId, dataUrl) {
      await accounts.requirePermission(userId, "contenu.gerer");
      let file;
      try { file = await storeDataUrl(db, dataUrl, { imagesOnly: true }); }
      catch (error) { throw badRequest(error?.message || "Impossible d'enregistrer cette image."); }
      const url = `/api/media/${file.id}`;
      let pending = []; try { pending = JSON.parse(await setting("home_block_pending") || "[]"); } catch { pending = []; }
      await put("home_block_pending", JSON.stringify([...pending, url].slice(-100)));
      await accounts.audit(userId, "HOME_BLOCK_IMAGE_UPLOAD", null, `${file.mimeType}, ${file.fileSize} octets (en attente, non publié)`);
      return { imageUrl: url, pending: true };
    },
    async saveLayout(userId, input) {
      await accounts.requirePermission(userId, "contenu.gerer");
      if (!input || typeof input !== "object" || Array.isArray(input)) throw badRequest("Configuration invalide.");
      const allowed = await allowedImages();
      const next = sanitizeLayout(input, allowed);
      await put("home_layout", JSON.stringify(next));
      await put("home_block_pending", "[]");
      await put("home_layout_draft", ""); // le brouillon est publié : il disparaît
      await accounts.audit(userId, "HOME_LAYOUT_SAVE", null, `${next.sections.filter((x) => x.visible).length}/${next.sections.length} section(s) affichée(s)`);
      return next;
    },
    /** Public : lu par l'en-tête de chaque page. */
    async get() { return { ...(await config()), logoUrl: await logo() }; },
    /** Personnel : ajoute le logo importé en attente (visible seulement ici, publié à l'enregistrement). */
    async getForStaff(userId) {
      await accounts.requirePermission(userId, "contenu.gerer");
      return { ...(await config()), mobileCatalog: MOBILE_CATALOG, logoUrl: await logo(), pendingLogo: String(await setting("site_header_logo_pending")).trim() };
    },
    async uploadLogo(userId, dataUrl) {
      await accounts.requirePermission(userId, "contenu.gerer");
      let file;
      try { file = await storeDataUrl(db, dataUrl, { imagesOnly: true }); }
      catch (error) { throw badRequest(error?.message || "Impossible d'enregistrer ce logo."); }
      const logoUrl = `/api/media/${file.id}`;
      await put("site_header_logo_pending", logoUrl);
      await accounts.audit(userId, "SITE_LOGO_UPLOAD", null, `${file.mimeType}, ${file.fileSize} octets (en attente, non publié)`);
      return { logoUrl, pending: true };
    },
    async save(userId, input) {
      await accounts.requirePermission(userId, "contenu.gerer");
      if (!input || typeof input !== "object" || Array.isArray(input)) throw badRequest("Configuration invalide.");
      const next = sanitize(input);
      if (input.logoUrl !== undefined) {
        const url = String(input.logoUrl ?? "").trim();
        const current = await logo(), pending = String(await setting("site_header_logo_pending")).trim();
        if (url && !(STATIC_LOGO.test(url) || (STORED_LOGO.test(url) && (url === current || url === pending)))) throw badRequest("Logo : importez une image (PNG, JPEG, WebP) ou indiquez un fichier /media/… du site.");
        await put("platform_logo", url);
        await put("site_header_logo_pending", "");
      }
      await put("site_header", JSON.stringify(next));
      await accounts.audit(userId, "SITE_HEADER_SAVE", null, `${next.tabs.filter((t) => t.visible).length} onglet(s) visible(s), ${next.tabs.filter((t) => t.custom).length} personnalisé(s)`);
      onChanged();
      return { ...next, logoUrl: await logo() };
    },
  };
}
