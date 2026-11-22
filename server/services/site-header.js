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
const DEFAULTS = Object.freeze({
  tabs: SYSTEM_TABS.map((t) => ({ ...t, visible: true })),
  light: { bg: "", ink: "" }, dark: { bg: "", ink: "" }, // vide = couleurs du thème
  publishLabel: "Publier", publishVisible: true, themeToggle: true,
});
const MAX_TABS = 16;
const INTERNAL = /^#\/[\w\-/?=&%.]*$/;                       // page du site
const EXTERNAL = /^https:\/\/[^\s"'<>\\]+$/;                 // autre site (https uniquement)
const STATIC_LOGO = /^\/media\/[\w.-]+\.(jpe?g|png|webp)$/i;
const STORED_LOGO = /^\/api\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
    return { tabs, light, dark, publishLabel, publishVisible: input.publishVisible !== false, themeToggle: input.themeToggle !== false };
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

  function sanitizeLayout(input = {}) {
    const raw = Array.isArray(input.sections) ? input.sections : HOME_SECTIONS.map((x) => ({ id: x.id, visible: true }));
    const known = new Set(HOME_SECTIONS.map((x) => x.id)), seen = new Set(), sections = [];
    for (const x of raw) {
      if (!known.has(x?.id) || seen.has(x.id)) throw badRequest("Section invalide ou en double.");
      seen.add(x.id); sections.push({ id: x.id, visible: x.visible !== false });
    }
    for (const x of HOME_SECTIONS) if (!seen.has(x.id)) sections.push({ id: x.id, visible: true }); // une section oubliée n'est jamais perdue
    return { sections };
  }
  async function layout() {
    try { return sanitizeLayout(JSON.parse(await setting("home_layout") || "{}")); } catch { return sanitizeLayout({}); }
  }

  return {
    sanitize,
    /** Public : lu par l'accueil. */
    getLayout: layout,
    async getLayoutForStaff(userId) { await accounts.requirePermission(userId, "contenu.gerer"); return { ...(await layout()), labels: Object.fromEntries(HOME_SECTIONS.map((x) => [x.id, x.label])) }; },
    async saveLayout(userId, input) {
      await accounts.requirePermission(userId, "contenu.gerer");
      if (!input || typeof input !== "object" || Array.isArray(input)) throw badRequest("Configuration invalide.");
      const next = sanitizeLayout(input);
      await put("home_layout", JSON.stringify(next));
      await accounts.audit(userId, "HOME_LAYOUT_SAVE", null, `${next.sections.filter((x) => x.visible).length}/${next.sections.length} section(s) affichée(s)`);
      return next;
    },
    /** Public : lu par l'en-tête de chaque page. */
    async get() { return { ...(await config()), logoUrl: await logo() }; },
    /** Personnel : ajoute le logo importé en attente (visible seulement ici, publié à l'enregistrement). */
    async getForStaff(userId) {
      await accounts.requirePermission(userId, "contenu.gerer");
      return { ...(await config()), logoUrl: await logo(), pendingLogo: String(await setting("site_header_logo_pending")).trim() };
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
