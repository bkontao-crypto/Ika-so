import { randomUUID } from "node:crypto";
import { badRequest } from "./errors.js";

export const STORED_FILE_MAX_BYTES = 2 * 1024 * 1024;
const MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const API_MEDIA_RE = /^\/api\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;
const STATIC_MEDIA_RE = /^\/media\/[a-z0-9][a-z0-9._-]{0,120}\.(?:jpe?g|png|webp)$/i;

/** Décode et vérifie le type réel du fichier, sans faire confiance au seul MIME déclaré. */
export function parseStoredDataUrl(dataUrl, { imagesOnly = false } = {}) {
  const match = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(String(dataUrl ?? ""));
  if (!match) throw new Error("Fichier illisible. Envoyez un fichier encodé correctement.");
  const mimeType = match[1].toLowerCase();
  if (!MIME_TYPES.has(mimeType) || (imagesOnly && !mimeType.startsWith("image/"))) {
    throw new Error("Format refusé. Formats autorisés : JPEG, PNG, WebP et PDF.");
  }
  const content = Buffer.from(match[2], "base64");
  if (!content.length || content.length > STORED_FILE_MAX_BYTES) {
    throw new Error("Fichier vide ou trop volumineux (2 Mo au maximum).");
  }
  const valid =
    (mimeType === "image/jpeg" && content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff) ||
    (mimeType === "image/png" && content.length >= 8 && content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (mimeType === "image/webp" && content.length >= 12 && content.toString("ascii", 0, 4) === "RIFF" && content.toString("ascii", 8, 12) === "WEBP") ||
    (mimeType === "application/pdf" && content.subarray(0, 5).toString("ascii") === "%PDF-");
  if (!valid) throw new Error("Le contenu du fichier ne correspond pas à son format déclaré.");
  return { mimeType, content, fileSize: content.length };
}

/** Enregistre le contenu dans PostgreSQL/Neon : aucun fichier métier n'est écrit sur le disque Render. */
export async function storeDataUrl(db, dataUrl, options = {}) {
  const file = parseStoredDataUrl(dataUrl, options);
  const id = randomUUID();
  await db.query(
    "insert into stored_files (id, storage_key, mime_type, file_size, content) values ($1, $2, $3, $4, $5)",
    [id, id, file.mimeType, file.fileSize, file.content],
  );
  return { id, mimeType: file.mimeType, fileSize: file.fileSize };
}

export async function storePublicImage(db, value, { ownerId = null, listingId = null } = {}) {
  const image = String(value ?? "");
  // Les ressources livrées avec l'application sont publiques, mais leur chemin reste strictement borné.
  if (STATIC_MEDIA_RE.test(image)) return image;

  // Une URL de fichier PostgreSQL ne doit jamais être réutilisable librement par un autre compte.
  // En modification, on n'accepte que les fichiers déjà rattachés à CETTE annonce et à CE propriétaire.
  const existing = API_MEDIA_RE.exec(image);
  if (existing) {
    if (!ownerId || !listingId) {
      throw badRequest("Cette photo stockée ne peut être réutilisée que depuis votre annonce existante.");
    }
    const rows = await db.query(
      `select 1
       from ika_listings l
       where l.id = $1 and l.owner_id = $2
         and (
           l.image_url = $3
           or exists (
             select 1 from ika_listing_photos ph
             where ph.listing_id = l.id and ph.url = $3
           )
         )
       limit 1`,
      [listingId, ownerId, image],
    );
    if (!rows.length) throw badRequest("Cette photo n'est pas associée à votre annonce.");
    return image;
  }

  const file = await storeDataUrl(db, image, { imagesOnly: true });
  return `/api/media/${file.id}`;
}

// Une annonce est visible du public quand elle est publiée, non masquée et non expirée.
const PUBLIC_LISTING = `l.status = 'PUBLISHED' and l.visibility <> 'HIDDEN' and (l.expires_at is null or l.expires_at > now())`;
const PUBLIC_AND_ALLOWED = `${PUBLIC_LISTING}
  or l.owner_id = $2
  or exists (select 1 from ika_profiles p where p.user_id = $2 and p.staff_role in ('MODERATOR','ADMIN','SUPERADMIN'))`;

/**
 * Lit une image si le demandeur a le droit de la voir.
 * Renvoie { mime_type, content, is_public } ou null.
 *  - is_public : vrai quand une annonce publiée et visible l'utilise (elle peut alors être mise en cache par le navigateur) ;
 *    faux quand seul le propriétaire ou le personnel y a accès (jamais de cache).
 *  - metaOnly : ne lit pas le contenu binaire (réponse 304 sans relire le BYTEA sur Neon).
 */
// Image de profil (couverture ou photo) : publique tant qu'elle n'est pas masquée et que le compte n'est ni bloqué ni supprimé.
const PROFILE_IMAGE_PUBLIC = `exists (
  select 1 from ika_advertiser_profiles ap
  join ika_profiles pr on pr.user_id = ap.user_id join ika_users u on u.id = ap.user_id
  where (ap.cover_url = $3 or ap.avatar_url = $3) and not ap.images_hidden and pr.account_status <> 'BANNED' and u.deleted_at is null)`;
// Le titulaire et le personnel la voient toujours (aperçu, modération).
const PROFILE_IMAGE_ALLOWED = `${PROFILE_IMAGE_PUBLIC}
  or exists (
    select 1 from ika_advertiser_profiles ap
    where (ap.cover_url = $3 or ap.avatar_url = $3)
      and (ap.user_id = $2 or exists (select 1 from ika_profiles s where s.user_id = $2 and s.staff_role in ('MODERATOR','ADMIN','SUPERADMIN'))))`;

export async function readPublicImage(db, id, viewerId = null, { metaOnly = false } = {}) {
  if (!UUID_RE.test(String(id ?? ""))) return null;
  const url = `/api/media/${id}`;
  const rows = await db.query(
    `select f.mime_type,
            case when $4::boolean then null else f.content end as content,
            (
              ${PROFILE_IMAGE_PUBLIC}
              or exists (select 1 from ika_homepage_settings hs where hs.config->>'image' = $3)
              or exists (select 1 from ika_listings l where l.image_url = $3 and ${PUBLIC_LISTING})
              or exists (
                select 1 from ika_listing_photos ph join ika_listings l on l.id = ph.listing_id
                where ph.url = $3 and ${PUBLIC_LISTING}
              )
            ) as is_public
     from stored_files f
     where f.id = $1
       and f.mime_type in ('image/jpeg','image/png','image/webp')
       and (
         ${PROFILE_IMAGE_ALLOWED}
         or exists (select 1 from ika_homepage_settings hs where hs.config->>'image' = $3)
         or exists (select 1 from ika_homepage_settings hs where hs.config->>'pending_image' = $3
                    and exists (select 1 from ika_profiles s where s.user_id = $2 and s.staff_role in ('ADMIN','SUPERADMIN')))
         or exists (select 1 from ika_listings l where l.image_url = $3 and (${PUBLIC_AND_ALLOWED}))
         or exists (
           select 1 from ika_listing_photos ph join ika_listings l on l.id = ph.listing_id
           where ph.url = $3 and (${PUBLIC_AND_ALLOWED})
         )
       )`,
    [id, viewerId, url, Boolean(metaOnly)],
  );
  return rows[0] ?? null;
}
