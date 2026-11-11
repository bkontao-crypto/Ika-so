import { looksLikeSameProperty } from "../lib/search.js";

/**
 * Annonces actives (en attente ou en ligne) qui ressemblent à `input`, hors annonce `excludeId`.
 * Sert à avertir l'annonceur et la modération ; ne bloque jamais seul (voir sameOwnerTitle pour le blocage).
 */
export async function findSimilar(db, input, { excludeId = "", ownerId = null } = {}) {
  const price = Number(input.price);
  if (!(price > 0)) return [];
  const rows = await db.query(
    `select id, price, surface_m2 as "surfaceM2", transaction_type as "transactionType", category, neighborhood
     from ika_listings
     where status in ('PENDING','PUBLISHED') and id <> $1
       and category = $2 and transaction_type = $3 and neighborhood = $4
       and price between $5 and $6
       and ($7::text is null or owner_id <> $7)
     limit 20`,
    [excludeId, input.category, input.transactionType, input.neighborhood, Math.floor(price * 0.95), Math.ceil(price * 1.05), ownerId],
  );
  return rows.filter((row) => looksLikeSameProperty(input, row)).map((row) => row.id);
}

/** Même annonceur, même titre (sans accents ni casse), annonce encore active : doublon exact. */
export async function sameOwnerTitle(db, ownerId, title, excludeId = "") {
  const rows = await db.query(
    `select id from ika_listings
     where owner_id = $1 and status in ('PENDING','PUBLISHED') and id <> $3 and ika_norm(title) = ika_norm($2)
     limit 1`,
    [ownerId, title, excludeId],
  );
  return rows[0]?.id ?? null;
}
