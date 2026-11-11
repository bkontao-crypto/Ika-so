import { badRequest } from "../lib/errors.js";
import { storeDataUrl } from "../lib/file-storage.js";

const DEFAULTS = Object.freeze({
  image: "/media/villa-badala.jpg",
  badge: "L'immobilier au Mali, en toute confiance",
  titleLine1: "Trouvez votre",
  titleLine2: "bien immobilier idéal",
  subtitle: "Maisons, appartements, terrains et locaux commerciaux au Mali, en toute simplicité.",
  assurance1: "Annonces modérées", assurance2: "Téléphones vérifiés", assurance3: "Contact direct",
  trustTitle: "Confiance", trustLine1: "Sécurité", trustLine2: "Sérénité",
  // Couleurs de la bannière (palette forêt / lime / sable)
  overlayColor: "#091f19",
  overlayOpacity: "0.75",
  accentColor: "#C9EF75",
  textColor: "#ffffff",
});
const LIMITS = { image: 1200, badge: 120, titleLine1: 90, titleLine2: 120, subtitle: 300, assurance1: 60, assurance2: 60, assurance3: 60, trustTitle: 40, trustLine1: 40, trustLine2: 40, overlayColor: 20, overlayOpacity: 6, accentColor: 20, textColor: 20 };
/** Photo d'une page d'accueil : fichier du dossier public/media, ou photo importée (stored_files). Les adresses externes sont refusées : la politique de sécurité du site les bloquerait. */
const STATIC_IMAGE = /^\/media\/[\w.-]+\.(jpe?g|png|webp)$/i;
const STORED_IMAGE = /^\/api\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createHomepageSettings({ db, accounts }) {
  async function row() {
    const rows = await db.query("select config from ika_homepage_settings where id = 1");
    return rows[0]?.config ?? {};
  }
  async function get() {
    const { pending_image: _pending, ...config } = await row(); // la photo en attente n'est jamais publique
    return { ...DEFAULTS, ...config };
  }
  return {
    get,
    /**
     * Importe une photo SANS la publier : elle est mise « en attente » (visible seulement par les administrateurs, pour l'aperçu).
     * Elle ne devient la photo publique qu'au moment de « Enregistrer ».
     */
    async uploadImage(userId, dataUrl) {
      await accounts.requireStaff(userId, "ADMIN");
      let file;
      try { file = await storeDataUrl(db, dataUrl, { imagesOnly: true }); }
      catch (error) { throw badRequest(error?.message || "Impossible d’enregistrer cette image."); }
      const image = `/api/media/${file.id}`;
      await db.query(`insert into ika_homepage_settings (id, config, updated_at, updated_by)
        values (1, jsonb_build_object('pending_image', $1::text), now(), $2)
        on conflict (id) do update set config = ika_homepage_settings.config || jsonb_build_object('pending_image', $1::text)`, [image, userId]);
      await accounts.audit(userId, "HOMEPAGE_IMAGE_UPLOAD", null, `${file.mimeType}, ${file.fileSize} octets (en attente, non publiée)`);
      return { image, pending: true, mimeType: file.mimeType, fileSize: file.fileSize };
    },
    async save(userId, input) {
      await accounts.requireStaff(userId, "ADMIN");
      if (!input || typeof input !== "object" || Array.isArray(input)) throw badRequest("Configuration invalide.");
      const current = await row();
      const config = {};
      const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
      function normalizeHex(v) {
        v = v.toLowerCase();
        if (v.length === 4) return "#" + v[1]+v[1]+v[2]+v[2]+v[3]+v[3];
        return v;
      }
      for (const [key, max] of Object.entries(LIMITS)) {
        let value = String(input[key] ?? DEFAULTS[key]).trim();
        if (!value || value.length > max) throw badRequest(`Le champ « ${key} » est obligatoire et limité à ${max} caractères.`);
        if (["overlayColor", "accentColor", "textColor"].includes(key)) {
          if (!HEX.test(value)) throw badRequest(`La couleur « ${key} » doit être un code hexadécimal (#RGB ou #RRGGBB).`);
          value = normalizeHex(value);
        }
        if (key === "overlayOpacity") {
          const n = Number(value);
          if (!Number.isFinite(n) || n < 0 || n > 1) throw badRequest("L’opacité de l’overlay doit être un nombre entre 0 et 1.");
          config[key] = String(Math.round(n * 100) / 100);
          continue;
        }
        config[key] = value;
      }
      // Explicitement retirer toute image en attente après enregistrement
      delete config.pending_image;
      const img = config.image;
      const known = img === current.image || img === current.pending_image; // jamais la photo d'une autre annonce
      if (!(STATIC_IMAGE.test(img) || (STORED_IMAGE.test(img) && known))) {
        throw badRequest("La photo doit être importée depuis l’appareil ou être un fichier /media/… du site (les adresses externes sont bloquées par la sécurité du site).");
      }
      await db.query(`insert into ika_homepage_settings (id, config, updated_at, updated_by)
        values (1, $1::jsonb, now(), $2)
        on conflict (id) do update set config = excluded.config, updated_at = now(), updated_by = excluded.updated_by`, [JSON.stringify(config), userId]);
      await accounts.audit(userId, "HOMEPAGE_SAVE", null, `photo ${img.startsWith("/api/media/") ? "importée" : "du site"} ; textes : ${Object.keys(LIMITS).filter((k) => k !== "image" && config[k] !== (current[k] ?? DEFAULTS[k])).join(", ") || "aucun changement"}`);
      return config;
    },
  };
}
