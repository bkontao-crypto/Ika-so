/**
 * Nettoyage des fichiers orphelins de `stored_files` — COMMANDE MANUELLE UNIQUEMENT (jamais de minuterie, jamais au démarrage).
 * Un fichier est orphelin s'il n'est référencé ni par une annonce (image_url), ni par une galerie (ika_listing_photos.url),
 * ni par un justificatif (ika_proofs.file_id), ni par une pièce jointe à une demande annonceur (ika_advertiser_applications.documents), ni par une photo de profil (ika_advertiser_profiles), ni par la photo de la page d'accueil (ika_homepage_settings, photo publique ou en attente), et s'il est assez ancien pour ne pas être un téléversement en cours.
 * Par défaut : simulation. Suppression seulement avec --apply ET --confirm=SUPPRIMER.
 */
import { newId } from "./security.js";

export const ORPHAN_DEFAULT_MIN_AGE_HOURS = 72;
export const ORPHAN_MIN_AGE_FLOOR_HOURS = 24; // en dessous, un téléversement en cours pourrait être pris pour un orphelin
export const ORPHAN_DEFAULT_LIMIT = 200;
export const ORPHAN_MAX_LIMIT = 1000;
export const ORPHAN_CONFIRM_WORD = "SUPPRIMER";

/** Conditions « aucune référence connue » : partagées par la simulation ET la suppression (revérifiées au moment de supprimer). */
const UNREFERENCED = `
  not exists (select 1 from ika_listings l where lower(l.image_url) = '/api/media/' || f.id::text)
  and not exists (select 1 from ika_listing_photos p where lower(p.url) = '/api/media/' || f.id::text)
  and not exists (select 1 from ika_proofs pr where pr.file_id = f.id)
  and not exists (select 1 from ika_advertiser_applications ad, jsonb_array_elements(ad.documents) d where d->>'fileId' = f.id::text)
  and not exists (select 1 from ika_advertiser_profiles ap where lower(ap.cover_url) = '/api/media/' || f.id::text or lower(ap.avatar_url) = '/api/media/' || f.id::text)
  and not exists (select 1 from ika_homepage_settings hs where lower(hs.config->>'image') = '/api/media/' || f.id::text or lower(hs.config->>'pending_image') = '/api/media/' || f.id::text)
  and not exists (select 1 from ika_partners pt where lower(pt.logo_url) = '/api/media/' || f.id::text)`;

export function parseCleanupArgs(argv) {
  const opts = { apply: false, confirm: "", minAgeHours: ORPHAN_DEFAULT_MIN_AGE_HOURS, limit: ORPHAN_DEFAULT_LIMIT };
  for (const arg of argv) {
    if (arg === "--apply") opts.apply = true;
    else if (arg.startsWith("--confirm=")) opts.confirm = arg.slice("--confirm=".length);
    else if (arg.startsWith("--min-age-hours=")) opts.minAgeHours = Number(arg.slice("--min-age-hours=".length));
    else if (arg.startsWith("--limit=")) opts.limit = Number(arg.slice("--limit=".length));
    else throw new Error(`Option inconnue : ${arg}`);
  }
  if (!Number.isInteger(opts.minAgeHours) || opts.minAgeHours < ORPHAN_MIN_AGE_FLOOR_HOURS) {
    throw new Error(`--min-age-hours doit être un entier d'au moins ${ORPHAN_MIN_AGE_FLOOR_HOURS}.`);
  }
  if (!Number.isInteger(opts.limit) || opts.limit < 1 || opts.limit > ORPHAN_MAX_LIMIT) {
    throw new Error(`--limit doit être un entier entre 1 et ${ORPHAN_MAX_LIMIT}.`);
  }
  if (opts.apply && opts.confirm !== ORPHAN_CONFIRM_WORD) {
    throw new Error(`Suppression refusée : ajoutez --confirm=${ORPHAN_CONFIRM_WORD} (après avoir relu la simulation et vérifié une sauvegarde).`);
  }
  if (!opts.apply && opts.confirm) throw new Error("--confirm n'a de sens qu'avec --apply.");
  return opts;
}

/** Simulation : liste (sans contenu binaire) les orphelins les plus anciens d'abord. Ne modifie rien. */
export async function findOrphans(db, { minAgeHours = ORPHAN_DEFAULT_MIN_AGE_HOURS, limit = ORPHAN_DEFAULT_LIMIT } = {}) {
  const rows = await db.query(
    `select f.id::text as id, f.mime_type, f.file_size, f.created_at
     from stored_files f
     where f.created_at < now() - ($1::int * interval '1 hour') and ${UNREFERENCED}
     order by f.created_at asc, f.id asc
     limit $2`,
    [minAgeHours, limit],
  );
  const total = await db.query(
    `select count(*)::bigint as n, coalesce(sum(f.file_size), 0)::bigint as bytes
     from stored_files f
     where f.created_at < now() - ($1::int * interval '1 hour') and ${UNREFERENCED}`,
    [minAgeHours],
  );
  return { candidates: rows, totalCount: Number(total[0].n), totalBytes: Number(total[0].bytes) };
}

/**
 * Suppression : un seul lot, dans une transaction. Les conditions sont REVÉRIFIÉES dans la sélection verrouillée
 * du DELETE lui-même : un fichier devenu référencé entre la simulation et la suppression est conservé.
 * La trace d'audit est écrite dans la même transaction (tout ou rien).
 */
export async function deleteOrphans(db, { minAgeHours = ORPHAN_DEFAULT_MIN_AGE_HOURS, limit = ORPHAN_DEFAULT_LIMIT, actor = "cli" } = {}) {
  return db.transaction(async (tx) => {
    const deleted = await tx.query(
      `delete from stored_files
       where id in (
         select f.id from stored_files f
         where f.created_at < now() - ($1::int * interval '1 hour') and ${UNREFERENCED}
         order by f.created_at asc, f.id asc
         limit $2
         for update of f skip locked
       )
       returning id::text as id, file_size`,
      [minAgeHours, limit],
    );
    const bytes = deleted.reduce((sum, r) => sum + Number(r.file_size), 0);
    await tx.query(
      "insert into ika_audit (id, actor_id, action, listing_id, note) values ($1, $2, 'ORPHAN_FILES_DELETE', null, $3)",
      [newId("aud"), actor, `${deleted.length} fichier(s), ${bytes} octets, âge min ${minAgeHours} h`],
    );
    return { deletedCount: deleted.length, deletedBytes: bytes, ids: deleted.map((r) => r.id) };
  });
}
