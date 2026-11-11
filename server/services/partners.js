// Partenaires de la page « Partenaires » : lecture publique (actifs seulement), gestion réservée aux administrateurs.
// Aucune image externe (la politique de sécurité du site l'interdit) : logo = fichier /media/… ou image importée /api/media/<uuid>.
import { randomUUID } from "node:crypto";
import { badRequest, notFound } from "../lib/errors.js";
import { storeDataUrl } from "../lib/file-storage.js";

export const PARTNER_CATEGORIES = Object.freeze([
  "Agence immobilière", "Promoteur", "Notaire et juridique", "Banque et financement", "Construction et matériaux",
  "Géomètre et topographie", "Assurance", "Déménagement et services", "Autre",
]);
export const PARTNERS_MAX = 100;
const STATIC_LOGO = /^\/media\/[a-z0-9][a-z0-9._-]{0,120}\.(?:jpe?g|png|webp)$/i;
const STORED_LOGO = /^\/api\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

const oneLine = (value, max) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max + 1);

/** Adresse du site du partenaire : http(s) seulement (jamais « javascript: » ni « data: »), sans identifiants. */
export function cleanWebsite(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (raw.length > 300) throw badRequest("L'adresse du site est limitée à 300 caractères.");
  let url;
  try { url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`); }
  catch { throw badRequest("Adresse du site invalide (exemple : https://www.exemple.ml)."); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || !url.hostname.includes(".")) {
    throw badRequest("Adresse du site invalide : utilisez une adresse commençant par https://");
  }
  return url.toString();
}

const view = (r, withStatus = false) => ({
  id: r.id, name: r.name, category: r.category, description: r.description ?? "",
  websiteUrl: r.website_url ?? null, logoUrl: r.logo_url ?? null,
  ...(withStatus ? { status: r.status, position: r.position, createdAt: r.created_at, updatedAt: r.updated_at } : {}),
});

export function createPartners({ db, accounts }) {
  async function logoOf(value, current = null) {
    const logo = String(value ?? "").trim();
    if (!logo) return null;
    if (STATIC_LOGO.test(logo)) return logo;
    const m = STORED_LOGO.exec(logo);
    if (!m) throw badRequest("Logo invalide : importez une image JPEG, PNG ou WebP.");
    if (logo === current) return logo;
    const rows = await db.query("select 1 from stored_files where id = $1 and mime_type like 'image/%'", [m[1].toLowerCase()]);
    if (!rows.length) throw badRequest("Logo introuvable : importez-le de nouveau.");
    return logo;
  }

  async function fields(input, current = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw badRequest("Partenaire invalide.");
    const name = oneLine(input.name, 80);
    if (name.length < 2 || name.length > 80) throw badRequest("Le nom du partenaire est obligatoire (2 à 80 caractères).");
    const category = String(input.category ?? "").trim();
    if (!PARTNER_CATEGORIES.includes(category)) throw badRequest("Choisissez une catégorie de la liste.");
    const description = oneLine(input.description, 300);
    if (description.length > 300) throw badRequest("La description est limitée à 300 caractères.");
    return { name, category, description, website: cleanWebsite(input.websiteUrl), logo: await logoOf(input.logoUrl, current.logo_url) };
  }

  return {
    categories: PARTNER_CATEGORIES,

    /** Public : partenaires actifs, dans l'ordre choisi. */
    async listPublic() {
      const rows = await db.query("select * from ika_partners where status = 'ACTIVE' order by position, created_at, id limit $1", [PARTNERS_MAX]);
      return { partners: rows.map((r) => view(r)), categories: PARTNER_CATEGORIES };
    },

    /** Administrateurs : tous les partenaires, y compris masqués. */
    async listForStaff(userId) {
      await accounts.requireStaff(userId, "ADMIN");
      const rows = await db.query("select * from ika_partners order by position, created_at, id limit $1", [PARTNERS_MAX]);
      return { partners: rows.map((r) => view(r, true)), categories: PARTNER_CATEGORIES };
    },

    async create(userId, input) {
      await accounts.requireStaff(userId, "ADMIN");
      const f = await fields(input);
      const [{ n, next }] = await db.query("select count(*)::int as n, coalesce(max(position), 0) + 1 as next from ika_partners");
      if (n >= PARTNERS_MAX) throw badRequest(`Limite atteinte : ${PARTNERS_MAX} partenaires au maximum.`);
      const id = `par-${randomUUID()}`;
      const rows = await db.query(
        `insert into ika_partners (id, name, category, description, website_url, logo_url, position, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
        [id, f.name, f.category, f.description, f.website, f.logo, next, userId],
      );
      await accounts.audit(userId, "PARTNER_CREATE", null, `${id} · ${f.name}`);
      return view(rows[0], true);
    },

    async update(userId, id, input) {
      await accounts.requireStaff(userId, "ADMIN");
      const current = (await db.query("select * from ika_partners where id = $1", [id]))[0];
      if (!current) throw notFound("Partenaire introuvable.");
      const f = await fields(input, current);
      const status = input.status === undefined ? current.status : input.status;
      if (!["ACTIVE", "HIDDEN"].includes(status)) throw badRequest("Statut invalide.");
      const rows = await db.query(
        `update ika_partners set name = $2, category = $3, description = $4, website_url = $5, logo_url = $6, status = $7, updated_at = now()
         where id = $1 returning *`,
        [id, f.name, f.category, f.description, f.website, f.logo, status],
      );
      await accounts.audit(userId, "PARTNER_UPDATE", null, `${id} · ${f.name}${status !== current.status ? ` · ${status}` : ""}`);
      return view(rows[0], true);
    },

    /** Masquer (reste en base, invisible du public) ou réafficher. */
    async setStatus(userId, id, status) {
      await accounts.requireStaff(userId, "ADMIN");
      if (!["ACTIVE", "HIDDEN"].includes(status)) throw badRequest("Statut invalide.");
      const rows = await db.query("update ika_partners set status = $2, updated_at = now() where id = $1 returning *", [id, status]);
      if (!rows.length) throw notFound("Partenaire introuvable.");
      await accounts.audit(userId, "PARTNER_STATUS", null, `${id} · ${status}`);
      return view(rows[0], true);
    },

    async remove(userId, id) {
      await accounts.requireStaff(userId, "ADMIN");
      const rows = await db.query("delete from ika_partners where id = $1 returning name", [id]);
      if (!rows.length) throw notFound("Partenaire introuvable.");
      await accounts.audit(userId, "PARTNER_DELETE", null, `${id} · ${rows[0].name}`);
      return { ok: true };
    },

    /** Logo importé : stocké en base, utilisable seulement ensuite par « create » / « update ». */
    async uploadLogo(userId, dataUrl) {
      await accounts.requireStaff(userId, "ADMIN");
      let file;
      try { file = await storeDataUrl(db, dataUrl, { imagesOnly: true }); }
      catch (error) { throw badRequest(error?.message || "Impossible d'enregistrer ce logo."); }
      return { logoUrl: `/api/media/${file.id}`, mimeType: file.mimeType, fileSize: file.fileSize };
    },
  };
}
