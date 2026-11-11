/**
 * Localisation et délimitation des biens (module « Cartographie immobilière »).
 * Règles d'accès reprises de l'existant, sans système de droits parallèle :
 * - le propriétaire de l'annonce lit, modifie et supprime la localisation de SES annonces (vérifié en SQL à chaque appel) ;
 * - le personnel (modération et plus) peut lire, jamais modifier ;
 * - le public ne voit une position exacte que si l'annonceur l'a demandé ET que l'annonce est publiée et visible.
 * La superficie et le périmètre sont toujours recalculés ici, jamais repris du navigateur.
 */
import { asBadRequest, badRequest, notFound } from "../lib/errors.js";
import { buildGeometry } from "../lib/geo.js";
import { CATEGORIES } from "../lib/rules.js";

function view(row) {
  const hasPolygon = row.polygon != null;
  return {
    listingId: row.listing_id,
    title: row.title,
    category: row.category,
    transactionType: row.transaction_type,
    imageUrl: row.image_url ?? null,
    status: row.status,
    point: { lat: row.latitude, lng: row.longitude },
    polygon: row.polygon ?? null,
    vertexCount: row.vertex_count,
    areaM2: hasPolygon ? row.area_m2 : null,
    areaHa: hasPolygon && row.area_m2 != null ? Math.round((row.area_m2 / 10_000) * 10_000) / 10_000 : null,
    perimeterM: hasPolygon ? row.perimeter_m : null,
    declaredSurfaceM2: row.surface_m2 ?? null,
    computedAt: row.computed_at ?? null,
    isPublic: row.is_public,
    updatedAt: row.updated_at,
  };
}

const SELECT = `select g.listing_id, g.latitude, g.longitude, g.polygon, g.vertex_count, g.area_m2, g.perimeter_m, g.computed_at, g.is_public, g.updated_at,
                       l.title, l.category, l.transaction_type, l.image_url, l.status, l.surface_m2
                  from ika_listing_geo g join ika_listings l on l.id = g.listing_id`;

export function createGeo({ db }, accounts) {
  async function read(listingId, q = db) {
    const rows = await q.query(`${SELECT} where g.listing_id = $1`, [listingId]);
    return rows[0] ? view(rows[0]) : null;
  }

  return {
    /** Localisation d'une annonce du compte, ou { geo: null } si elle n'est pas encore localisée. */
    async getMine(userId, listingId) {
      await accounts.requireActive(userId);
      const own = await db.query("select id from ika_listings where id = $1 and owner_id = $2", [listingId, userId]);
      if (!own[0]) throw notFound("Annonce introuvable.");
      return { geo: await read(listingId) };
    },

    /** Données de la fiche imprimable : localisation (avec polygone) + quartier/ville de l'annonce, propriétaire seulement. */
    async fiche(userId, listingId) {
      await accounts.requireActive(userId);
      const own = await db.query("select neighborhood, city, title, surface_label from ika_listings where id = $1 and owner_id = $2", [listingId, userId]);
      if (!own[0]) throw notFound("Annonce introuvable.");
      const geo = await read(listingId);
      if (!geo) throw notFound("Aucune localisation enregistrée pour cette annonce.");
      return { geo, listing: own[0] };
    },

    /** Lecture par le personnel (modération), toute annonce. */
    async getForStaff(userId, listingId) {
      await accounts.requireStaff(userId);
      const exists = await db.query("select id from ika_listings where id = $1", [listingId]);
      if (!exists[0]) throw notFound("Annonce introuvable.");
      return { geo: await read(listingId) };
    },

    /** Lecture publique : uniquement si l'annonceur a choisi d'afficher la position exacte, sur une annonce publiée et visible. */
    async getPublic(listingId) {
      const rows = await db.query(`${SELECT} where g.listing_id = $1 and g.is_public = true and l.status = 'PUBLISHED' and l.visibility = 'NORMAL'`, [listingId]);
      return { geo: rows[0] ? view(rows[0]) : null };
    },

    /** Crée ou remplace la localisation d'une annonce du compte. Les mesures sont calculées ici. */
    async save(userId, listingId, input) {
      const profile = await accounts.ensureProfile(userId);
      accounts.assertCanPublish(profile);
      const { point, shape, isPublic } = asBadRequest(() => buildGeometry(input));
      await db.transaction(async (tx) => {
        // Verrou sur l'annonce ET contrôle d'appartenance côté serveur : l'identifiant reçu du navigateur ne suffit jamais.
        const own = await tx.query("select id from ika_listings where id = $1 and owner_id = $2 for update", [listingId, userId]);
        if (!own[0]) throw notFound("Annonce introuvable.");
        await tx.query(
          `insert into ika_listing_geo (listing_id, latitude, longitude, polygon, vertex_count, area_m2, perimeter_m, computed_at, is_public, created_by, updated_by)
           values ($1, $2, $3, $4::jsonb, $5, $6, $7, $8::timestamptz, $9, $10, $10)
           on conflict (listing_id) do update set
             latitude = excluded.latitude, longitude = excluded.longitude, polygon = excluded.polygon,
             vertex_count = excluded.vertex_count, area_m2 = excluded.area_m2, perimeter_m = excluded.perimeter_m,
             computed_at = excluded.computed_at, is_public = excluded.is_public, updated_by = excluded.updated_by, updated_at = now()`,
          [
            listingId, point.lat, point.lng, shape ? JSON.stringify(shape.polygon) : null, shape?.vertexCount ?? 0,
            shape?.areaM2 ?? null, shape?.perimeterM ?? null, shape ? new Date().toISOString() : null, isPublic, userId,
          ],
        );
        const note = shape ? `parcelle ${shape.vertexCount} sommets, ${shape.areaM2} m²` : "point";
        await accounts.audit(userId, "GEO_SAVE", listingId, `${note}${isPublic ? ", position publique" : ""}`, tx);
      });
      return { geo: await read(listingId) };
    },

    /** Supprime la localisation d'une annonce du compte (confirmation explicite exigée). */
    async remove(userId, listingId, { confirm } = {}) {
      await accounts.requireActive(userId);
      if (confirm !== true) throw badRequest("Confirmez la suppression de la localisation.");
      await db.transaction(async (tx) => {
        const gone = await tx.query(
          `delete from ika_listing_geo g using ika_listings l
            where g.listing_id = l.id and l.id = $1 and l.owner_id = $2 returning g.listing_id`,
          [listingId, userId],
        );
        if (!gone[0]) throw notFound("Aucune localisation enregistrée pour cette annonce.");
        await accounts.audit(userId, "GEO_DELETE", listingId, "localisation supprimée", tx);
      });
      return { deleted: true };
    },

    /** Biens localisés du compte, avec indicateurs calculés sur les données réelles. */
    async mine(userId, { category } = {}) {
      await accounts.requireActive(userId);
      const cat = CATEGORIES.includes(category) ? category : null;
      const rows = await db.query(
        `${SELECT} where l.owner_id = $1 and ($2::text is null or l.category = $2) order by g.updated_at desc limit 200`,
        [userId, cat],
      );
      const [stats] = await db.query(
        `select count(*)::int as located,
                count(*) filter (where g.polygon is not null and l.category = 'Terrain')::int as plots,
                count(*) filter (where l.category = 'Maison')::int as houses,
                coalesce(sum(g.area_m2) filter (where g.polygon is not null), 0)::float8 as total_m2
           from ika_listing_geo g join ika_listings l on l.id = g.listing_id where l.owner_id = $1`,
        [userId],
      );
      return {
        items: rows.map(view),
        stats: { located: stats.located, delimitedPlots: stats.plots, housesLocated: stats.houses, totalAreaM2: Math.round(stats.total_m2 * 100) / 100 },
      };
    },
  };
}
