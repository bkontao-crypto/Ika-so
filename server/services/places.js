// Quartiers et pays : lecture publique (actifs seulement) et gestion réservée au SUPERADMIN (contrôle refait ici, jamais côté navigateur).
// Un changement recharge aussitôt les listes en mémoire (server/lib/places.js) : formulaires, filtres, pages « Quartiers », importation CSV.
import { randomUUID } from "node:crypto";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import { applyPlaces } from "../lib/places.js";
import { slugify } from "../lib/slug.js";

export const ZONES_MAX = 2000;
const oneLine = (value, max) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max + 1);
const toNumber = (value) => (value === "" || value == null ? NaN : Number(String(value).replace(",", ".")));

/** Fuseau horaire connu du système (ex. Africa/Bamako) : refuse tout le reste. */
export function validTimezone(value) {
  try { new Intl.DateTimeFormat("fr-FR", { timeZone: value }); return /^[A-Za-z_]+(?:\/[A-Za-z_+-]+)+$|^UTC$/.test(value); } catch { return false; }
}

const zoneView = (r) => ({
  id: r.id, name: r.name, countryCode: r.country_code?.trim?.() ?? r.country_code, lat: Number(r.latitude), lng: Number(r.longitude), active: r.active,
  ...(r.listings != null ? { listings: Number(r.listings) } : {}),
});
const countryView = (r) => ({
  code: r.code?.trim?.() ?? r.code, name: r.name, currency: r.currency, timezone: r.timezone, active: r.active,
  ...(r.zones != null ? { zones: Number(r.zones), listings: Number(r.listings ?? 0) } : {}),
});

export function createPlaces({ db, accounts }) {
  const guard = (userId) => accounts.requireStaff(userId, "SUPERADMIN");

  /** Relit la base et remplace les listes en mémoire. Sans tables (migration 058 pas passée) : on garde les valeurs d'origine. */
  async function reload() {
    try {
      const countries = await db.query("select code, name, currency, timezone from ika_countries where active = true order by name");
      const zones = await db.query("select name, latitude, longitude, country_code, active from ika_zones order by name");
      applyPlaces({
        countries: countries.map((c) => ({ code: String(c.code).trim(), name: c.name, currency: c.currency, timezone: c.timezone })),
        zones: zones.map((z) => ({ name: z.name, lat: Number(z.latitude), lng: Number(z.longitude), country: String(z.country_code).trim(), active: z.active })),
      });
      return true;
    } catch { return false; }
  }

  async function zoneFields(input, current = null) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw badRequest("Quartier invalide.");
    const name = oneLine(input.name, 60);
    if (name.length < 2 || name.length > 60) throw badRequest("Le nom du quartier est obligatoire (2 à 60 caractères).");
    const countryCode = String(input.countryCode ?? "").trim().toUpperCase();
    const country = (await db.query("select code, active from ika_countries where code = $1", [countryCode]))[0];
    if (!country) throw badRequest("Choisissez un pays de la liste.");
    const lat = toNumber(input.lat); const lng = toNumber(input.lng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw badRequest("Latitude invalide (entre -90 et 90, ex. 12.639).");
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw badRequest("Longitude invalide (entre -180 et 180, ex. -8.002).");
    // Nom et adresse de page (/quartiers/<nom>) uniques.
    const all = await db.query("select id, name from ika_zones");
    const slug = slugify(name);
    if (!slug) throw badRequest("Le nom du quartier doit contenir des lettres ou des chiffres.");
    const twin = all.find((z) => z.id !== current?.id && (z.name.toLowerCase() === name.toLowerCase() || slugify(z.name) === slug));
    if (twin) throw conflict(`Un quartier « ${twin.name} » existe déjà.`);
    return { name, countryCode, lat, lng };
  }

  async function listingCount(name) {
    const rows = await db.query("select count(*)::int as n from ika_listings where neighborhood = $1", [name]);
    return Number(rows[0]?.n ?? 0);
  }

  return {
    reload,

    /** Public : pays et quartiers actifs (utilisés par les formulaires et filtres du site). */
    async listPublic() {
      const countries = await db.query("select code, name, currency, timezone, active from ika_countries where active = true order by name");
      const zones = await db.query(
        `select z.id, z.name, z.country_code, z.latitude, z.longitude, z.active from ika_zones z
         join ika_countries c on c.code = z.country_code where z.active = true and c.active = true order by z.name`,
      );
      return { countries: countries.map(countryView), zones: zones.map(zoneView) };
    },

    /** Superadmin : tout, avec les compteurs d'annonces. */
    async listForOwner(userId) {
      await guard(userId);
      const countries = await db.query(
        `select c.*, (select count(*) from ika_zones z where z.country_code = c.code) as zones,
                (select count(*) from ika_listings l where l.country_code = c.code) as listings
         from ika_countries c order by c.active desc, c.name`,
      );
      const zones = await db.query(
        `select z.*, (select count(*) from ika_listings l where l.neighborhood = z.name) as listings
         from ika_zones z order by z.country_code, z.name limit $1`, [ZONES_MAX],
      );
      return { countries: countries.map(countryView), zones: zones.map(zoneView) };
    },

    async createZone(userId, input) {
      await guard(userId);
      const f = await zoneFields(input);
      const [{ n }] = await db.query("select count(*)::int as n from ika_zones");
      if (n >= ZONES_MAX) throw badRequest(`Limite atteinte : ${ZONES_MAX} quartiers au maximum.`);
      const id = `zone-${randomUUID()}`;
      const rows = await db.query(
        "insert into ika_zones (id, name, country_code, latitude, longitude, created_by) values ($1, $2, $3, $4, $5, $6) returning *",
        [id, f.name, f.countryCode, f.lat, f.lng, userId],
      );
      await accounts.audit(userId, "ZONE_CREATE", null, `${f.name} · ${f.countryCode}`);
      await reload();
      return zoneView(rows[0]);
    },

    /** Ajout de plusieurs quartiers d'un coup : une ligne « Nom;latitude;longitude » par quartier, pour un pays. Tout ou rien. */
    async createZones(userId, { countryCode, lines }) {
      await guard(userId);
      const rows = String(lines ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (!rows.length) throw badRequest("Aucune ligne à ajouter.");
      if (rows.length > 200) throw badRequest("200 quartiers au plus par ajout.");
      const parsed = [];
      for (const [i, line] of rows.entries()) {
        const [name, lat, lng, ...extra] = line.split(/[;\t]/).map((x) => x.trim());
        if (extra.length || lat === undefined || lng === undefined) throw badRequest(`Ligne ${i + 1} : écrivez « Nom;latitude;longitude ».`);
        parsed.push({ name, lat, lng, countryCode });
      }
      const seen = new Set();
      for (const [i, p] of parsed.entries()) {
        try { await zoneFields(p); } catch (error) { throw badRequest(`Ligne ${i + 1} : ${error.message}`); }
        const key = slugify(p.name);
        if (seen.has(key)) throw badRequest(`Ligne ${i + 1} : « ${p.name} » apparaît deux fois.`);
        seen.add(key);
      }
      const [{ n }] = await db.query("select count(*)::int as n from ika_zones");
      if (n + parsed.length > ZONES_MAX) throw badRequest(`Limite atteinte : ${ZONES_MAX} quartiers au maximum.`);
      for (const p of parsed) {
        const f = await zoneFields(p);
        await db.query("insert into ika_zones (id, name, country_code, latitude, longitude, created_by) values ($1, $2, $3, $4, $5, $6)", [`zone-${randomUUID()}`, f.name, f.countryCode, f.lat, f.lng, userId]);
      }
      await accounts.audit(userId, "ZONE_BULK_CREATE", null, `${parsed.length} quartier(s) · ${String(countryCode).toUpperCase()}`);
      await reload();
      return { added: parsed.length };
    },

    async updateZone(userId, id, input) {
      await guard(userId);
      const current = (await db.query("select * from ika_zones where id = $1", [id]))[0];
      if (!current) throw notFound("Quartier introuvable.");
      const f = await zoneFields(input, current);
      // Les annonces gardent le nom du quartier en texte : renommer en laisserait d'orphelines.
      if (f.name !== current.name && (await listingCount(current.name)) > 0) {
        throw conflict("Ce quartier a des annonces : changez ses coordonnées ou son pays, ou masquez-le et créez un nouveau quartier (le nom ne peut plus changer).");
      }
      const rows = await db.query("update ika_zones set name = $2, country_code = $3, latitude = $4, longitude = $5, updated_at = now() where id = $1 returning *", [id, f.name, f.countryCode, f.lat, f.lng]);
      await accounts.audit(userId, "ZONE_UPDATE", null, `${current.name} → ${f.name} · ${f.countryCode}`);
      await reload();
      return zoneView(rows[0]);
    },

    async setZoneActive(userId, id, active) {
      await guard(userId);
      if (typeof active !== "boolean") throw badRequest("Statut invalide.");
      const rows = await db.query("update ika_zones set active = $2, updated_at = now() where id = $1 returning *", [id, active]);
      if (!rows.length) throw notFound("Quartier introuvable.");
      await accounts.audit(userId, "ZONE_STATUS", null, `${rows[0].name} · ${active ? "actif" : "masqué"}`);
      await reload();
      return zoneView(rows[0]);
    },

    async removeZone(userId, id) {
      await guard(userId);
      const current = (await db.query("select * from ika_zones where id = $1", [id]))[0];
      if (!current) throw notFound("Quartier introuvable.");
      if ((await listingCount(current.name)) > 0) throw conflict("Ce quartier a des annonces : masquez-le plutôt que de le supprimer.");
      await db.query("delete from ika_zones where id = $1", [id]);
      await accounts.audit(userId, "ZONE_DELETE", null, current.name);
      await reload();
      return { ok: true };
    },

    async createCountry(userId, input) {
      await guard(userId);
      const f = countryFields(input);
      if ((await db.query("select 1 from ika_countries where code = $1", [f.code])).length) throw conflict(`Le pays ${f.code} existe déjà.`);
      const rows = await db.query("insert into ika_countries (code, name, currency, timezone, active) values ($1, $2, $3, $4, $5) returning *", [f.code, f.name, f.currency, f.timezone, f.active]);
      await accounts.audit(userId, "COUNTRY_CREATE", null, `${f.code} · ${f.name}`);
      await reload();
      return countryView(rows[0]);
    },

    async updateCountry(userId, code, input) {
      await guard(userId);
      const current = (await db.query("select * from ika_countries where code = $1", [String(code).toUpperCase()]))[0];
      if (!current) throw notFound("Pays introuvable.");
      const f = countryFields({ ...input, code: current.code });
      const rows = await db.query("update ika_countries set name = $2, currency = $3, timezone = $4 where code = $1 returning *", [current.code, f.name, f.currency, f.timezone]);
      await accounts.audit(userId, "COUNTRY_UPDATE", null, `${current.code} · ${f.name}`);
      await reload();
      return countryView(rows[0]);
    },

    async setCountryActive(userId, code, active) {
      await guard(userId);
      if (typeof active !== "boolean") throw badRequest("Statut invalide.");
      const c = String(code).toUpperCase();
      const current = (await db.query("select * from ika_countries where code = $1", [c]))[0];
      if (!current) throw notFound("Pays introuvable.");
      if (!active) {
        const others = await db.query("select count(*)::int as n from ika_countries where active = true and code <> $1", [c]);
        if (!Number(others[0]?.n)) throw conflict("Au moins un pays doit rester actif.");
      }
      const rows = await db.query("update ika_countries set active = $2 where code = $1 returning *", [c, active]);
      await accounts.audit(userId, "COUNTRY_STATUS", null, `${c} · ${active ? "actif" : "désactivé"}`);
      await reload();
      return countryView(rows[0]);
    },

    async removeCountry(userId, code) {
      await guard(userId);
      const c = String(code).toUpperCase();
      const current = (await db.query("select * from ika_countries where code = $1", [c]))[0];
      if (!current) throw notFound("Pays introuvable.");
      const [{ zones }] = await db.query("select count(*)::int as zones from ika_zones where country_code = $1", [c]);
      const [{ listings }] = await db.query("select count(*)::int as listings from ika_listings where country_code = $1", [c]);
      if (Number(zones) || Number(listings)) throw conflict("Ce pays a des quartiers ou des annonces : désactivez-le plutôt que de le supprimer.");
      await db.query("delete from ika_countries where code = $1", [c]);
      await accounts.audit(userId, "COUNTRY_DELETE", null, `${c} · ${current.name}`);
      await reload();
      return { ok: true };
    },
  };
}

function countryFields(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw badRequest("Pays invalide.");
  const code = String(input.code ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) throw badRequest("Le code pays comporte 2 lettres (norme ISO, ex. SN pour le Sénégal).");
  const name = oneLine(input.name, 60);
  if (name.length < 2 || name.length > 60) throw badRequest("Le nom du pays est obligatoire (2 à 60 caractères).");
  const currency = String(input.currency ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw badRequest("La devise comporte 3 lettres (ex. XOF).");
  const timezone = String(input.timezone ?? "").trim();
  if (!validTimezone(timezone)) throw badRequest("Fuseau horaire inconnu (ex. Africa/Dakar).");
  return { code, name, currency, timezone, active: input.active === true };
}
