import { asBadRequest, badRequest, conflict, notFound } from "../lib/errors.js";
import { resolveCountry, zonePoint } from "../lib/places.js";
import {
  CATEGORIES,
  REPORT_REASONS,
  TRANSACTIONS,
  assertPhotoList,
  isSmsVerified,
  statusAfterOwnerEdit,
  validateListing,
} from "../lib/rules.js";
import { readSearch } from "../lib/search.js";
import { newId } from "../lib/security.js";
import { readPublicImage, storePublicImage } from "../lib/file-storage.js";
import { buildPriceHistory } from "../lib/price-history.js";
import { DRAFT_MAX_BYTES, isEmptyDraft, sanitizeDraft } from "../lib/drafts.js";
import { findSimilar, sameOwnerTitle } from "./duplicates.js";
import { LISTING_COLUMNS, listingColumns, toCard } from "./cards.js";

const OUTCOMES = ["SOLD", "RENTED", "ARCHIVED", "RESUBMIT", "RENEW"];

export function createListings(ctx, accounts, trust) {
  const { db } = ctx;

  async function photoUrls(listingId, cover) {
    const rows = await db.query(
      "select url from ika_listing_photos where listing_id = $1 order by position asc",
      [listingId],
    );
    const urls = rows.map((row) => row.url).filter(Boolean);
    return urls.length ? urls : [cover];
  }

  /** Remplace toutes les photos en une seule instruction (atomique). */
  async function replacePhotos(database, listingId, urls) {
    await database.query(
      `with removed as (delete from ika_listing_photos where listing_id = $1)
       insert into ika_listing_photos (id, listing_id, url, position)
       select 'ph-' || gen_random_uuid()::text, $1::text, u.url, (u.pos - 1)::int
       from unnest($2::text[]) with ordinality as u(url, pos)`,
      [listingId, urls],
    );
  }

  async function ownListingRow(userId, id) {
    const rows = await db.query(
      `select ${LISTING_COLUMNS} from ika_listings where id = $1 and owner_id = $2`,
      [id, userId],
    );
    return rows[0] ?? null;
  }

  return {
    async publicImage(fileId, viewerId = null, options = {}) {
      return readPublicImage(db, fileId, viewerId, options);
    },

    /** Catalogue public : seulement les annonces publiées, visibles et non expirées. */
    async listPublic(raw) {
      const f = readSearch(raw);
      const tx = TRANSACTIONS.includes(f.transaction) ? f.transaction : null;
      const category = CATEGORIES.includes(f.category) ? f.category : null;
      const doc = "ika_norm(title || ' ' || neighborhood || ' ' || description)";
      const like = f.q ? `%${f.q.replace(/[\\%_]/g, "\\$&")}%` : null;
      const order = {
        price_asc: "price asc",
        price_desc: "price desc",
        relevance: `ts_rank(to_tsvector('french', ${doc}), plainto_tsquery('french', $5)) desc`,
        recent: "published_at desc nulls last",
      }[f.sort];
      const rows = await db.query(
        `select ${LISTING_COLUMNS} from ika_listings
         where status = 'PUBLISHED' and visibility <> 'HIDDEN'
           and (expires_at is null or expires_at > now())
           and ($1::text is null or transaction_type = $1)
           and ($2::text is null or category = $2)
           and ($3::text is null or neighborhood = $3)
           and ($4::bigint is null or price <= $4)
           and ($5::text is null or to_tsvector('french', ${doc}) @@ plainto_tsquery('french', $5) or ${doc} like $6)
           and ($7::bigint is null or price >= $7)
           and ($8::numeric is null or surface_m2 >= $8)
           and ($9::int is null or bedrooms >= $9)
         order by (featured_until is not null and featured_until > now()) desc, ${order}, created_at desc
         limit $10 offset $11`,
        [tx, category, f.zone || null, f.maxPrice, f.q || null, like, f.minPrice, f.minSurface, f.bedrooms, f.limit, f.offset],
      );
      return rows.map((row) => toCard(row));
    },

    /** Annonces proches d'une annonce publique : même transaction et même type, prix à 40 % près, même quartier d'abord. */
    async similarPublic(id) {
      const rows = await db.query(
        `select ${listingColumns("o")} from ika_listings o
         where o.status = 'PUBLISHED' and o.visibility <> 'HIDDEN' and (o.expires_at is null or o.expires_at > now())
           and o.id <> $1
           and (select count(*) from ika_listings b where b.id = $1 and b.status = 'PUBLISHED'
                and b.transaction_type = o.transaction_type and b.category = o.category
                and o.price between b.price * 0.6 and b.price * 1.4) = 1
         order by (o.neighborhood = (select neighborhood from ika_listings where id = $1)) desc, o.published_at desc nulls last
         limit 4`,
        [String(id).slice(0, 80)],
      );
      return rows.map((row) => toCard(row));
    },

    async getPublic(id) {
      const rows = await db.query(
        `select ${LISTING_COLUMNS} from ika_listings
         where id = $1 and status = 'PUBLISHED' and visibility <> 'HIDDEN'
           and (expires_at is null or expires_at > now())`,
        [String(id).slice(0, 80)],
      );
      if (!rows[0]) throw notFound("Annonce introuvable.");
      const card = toCard(rows[0]);
      card.photos = await photoUrls(card.id, card.imageUrl);
      const points = await db.query(
        "select price, recorded_at from ika_listing_price_history where listing_id = $1 order by recorded_at desc, id desc limit 20",
        [card.id],
      );
      card.priceHistory = buildPriceHistory(points);
      return card;
    },

    async create(userId, input, { bulk = false } = {}) {
      const profile = await accounts.assertCanPublishListing(userId);
      if (!profile.phone_verified_at) throw badRequest("Vérifiez votre numéro avant de soumettre l'annonce.");
      const errors = validateListing(input);
      if (errors.length) throw badRequest(errors[0]);
      const photos = asBadRequest(() =>
        assertPhotoList(input.imageUrls?.length ? input.imageUrls : [input.imageUrl]),
      );
      await trust.assertNotBlacklisted("PHONE", profile.phone);
      // Vérifier les règles métier avant de créer le moindre binaire : pas de fichier orphelin
      // si l'annonce est refusée pour doublon ou si la recherche de similarité échoue.
      if (await sameOwnerTitle(db, userId, input.title)) throw conflict("Vous avez déjà une annonce avec ce titre. Modifiez-la plutôt que d'en créer une seconde.");
      const similar = await findSimilar(db, input, { ownerId: userId });
      const point = zonePoint(input.neighborhood);
      const countryCode = resolveCountry(input.countryCode);
      if (!countryCode) throw badRequest("Pays inconnu ou désactivé.");
      const id = newId("ik");
      const name = input.fullName.trim() || profile.full_name || "Annonceur";
      // Fichiers + annonce + galerie sont validés ensemble : rollback complet si une requête échoue.
      await db.transaction(async (tx) => {
        const durablePhotos = [];
        for (const photo of photos) durablePhotos.push(await storePublicImage(tx, photo));
        if (input.fullName.trim()) {
          await tx.query("update ika_profiles set full_name = $1 where user_id = $2", [name, userId]);
        }
        await tx.query(
          `insert into ika_listings (
             id, owner_id, title, category, transaction_type, price, neighborhood,
             surface_label, surface_m2, road_access, bedrooms, bathrooms, furnished,
             description, declared_document, latitude, longitude, image_url, status,
             owner_name, owner_phone, owner_role, phone_verified, country_code
           ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'PENDING',$19,$20,$21,$22,$23)`,
          [
            id, userId, input.title.trim(), input.category, input.transactionType, input.price,
            input.neighborhood.trim(), input.surfaceLabel.trim(), input.surfaceM2, input.roadAccess,
            input.bedrooms, input.bathrooms, input.furnished, input.description.trim(),
            input.declaredDocument, point?.lat ?? null, point?.lng ?? null, durablePhotos[0], name,
            profile.phone, input.ownerRole || profile.display_role, isSmsVerified(profile.phone_channel), countryCode,
          ],
        );
        await replacePhotos(tx, id, durablePhotos);
        // L'annonce est soumise : le brouillon serveur a rempli son rôle (même transaction, pas de brouillon fantôme).
        await tx.query("delete from ika_listing_drafts where user_id = $1", [userId]);
      });
      await accounts.audit(userId, "LISTING_SUBMIT", id, similar.length ? `${input.title.trim()} (proche de ${similar.length} annonce(s))` : input.title.trim());
      if (similar.length) await trust.raiseAlert("DUPLICATE", { listingId: id, detail: `Ressemble à ${similar.length} annonce(s) d'un autre annonceur.` });
      await trust.detectListingAnomalies(id, { bulk });
      return { id, similarCount: similar.length };
    },

    // ---------- Brouillon « nouvelle annonce » côté serveur (un par compte) ----------
    /** Brouillon du compte, ou { draft: null }. */
    async getDraft(userId) {
      await accounts.requireActive(userId);
      const rows = await db.query("select payload, updated_at from ika_listing_drafts where user_id = $1", [userId]);
      if (!rows[0]) return { draft: null, updatedAt: null };
      const at = rows[0].updated_at;
      return { draft: sanitizeDraft(rows[0].payload), updatedAt: at instanceof Date ? at.toISOString() : String(at) };
    },

    /** Enregistre (remplace) le brouillon. Un brouillon vide supprime l'existant au lieu de le stocker. */
    async saveDraft(userId, body) {
      await accounts.requireActive(userId);
      const draft = sanitizeDraft(body);
      if (isEmptyDraft(draft)) {
        await db.query("delete from ika_listing_drafts where user_id = $1", [userId]);
        return { draft: null, updatedAt: null };
      }
      const json = JSON.stringify(draft);
      if (Buffer.byteLength(json) > DRAFT_MAX_BYTES) throw badRequest("Brouillon trop volumineux.");
      const rows = await db.query(
        `insert into ika_listing_drafts (user_id, payload, updated_at) values ($1, $2::jsonb, now())
         on conflict (user_id) do update set payload = excluded.payload, updated_at = now()
         returning updated_at`,
        [userId, json],
      );
      const at = rows[0].updated_at;
      return { draft, updatedAt: at instanceof Date ? at.toISOString() : String(at) };
    },

    async deleteDraft(userId) {
      await db.query("delete from ika_listing_drafts where user_id = $1", [userId]);
      return { ok: true };
    },

    async listMine(userId) {
      await accounts.ensureProfile(userId);
      const rows = await db.query(
        `select ${LISTING_COLUMNS} from ika_listings where owner_id = $1 order by created_at desc`,
        [userId],
      );
      return rows.map((row) => toCard(row, { revealPhone: true }));
    },

    async getOwn(userId, id) {
      const row = await ownListingRow(userId, String(id).slice(0, 80));
      if (!row) throw notFound("Annonce introuvable.");
      const card = toCard(row, { revealPhone: true });
      card.photos = await photoUrls(card.id, card.imageUrl);
      return card;
    },

    async update(userId, id, input) {
      // Décision du propriétaire (10 nov. 2026) : un compte qui a déjà des annonces peut les modifier
      // même sans demande annonceur approuvée ; seule la création d'annonce exige l'approbation.
      const profile = await accounts.ensureProfile(userId);
      accounts.assertCanPublish(profile);
      const errors = validateListing(input);
      if (errors.length) throw badRequest(errors[0]);
      const photos = asBadRequest(() =>
        assertPhotoList(input.imageUrls?.length ? input.imageUrls : [input.imageUrl]),
      );
      const point = zonePoint(input.neighborhood);
      // Pays non précisé à la modification : on garde celui de l'annonce (coalesce en SQL).
      const countryCode = input.countryCode ? resolveCountry(input.countryCode) : null;
      if (input.countryCode && !countryCode) throw badRequest("Pays inconnu ou désactivé.");
      let next;
      // Verrouiller l'annonce et regrouper fichiers + mise à jour + galerie dans une transaction.
      await db.transaction(async (tx) => {
        const rows = await tx.query(
          "select status from ika_listings where id = $1 and owner_id = $2 for update",
          [id, userId],
        );
        if (!rows[0]) throw notFound("Annonce introuvable.");
        if (!["PUBLISHED", "REJECTED", "EXPIRED", "PENDING", "DRAFT"].includes(rows[0].status)) {
          throw conflict("Cette annonce ne se modifie plus.");
        }
        if (await sameOwnerTitle(tx, userId, input.title, id)) throw conflict("Vous avez déjà une autre annonce avec ce titre.");
        next = statusAfterOwnerEdit(rows[0].status);
        const durablePhotos = [];
        for (const photo of photos) durablePhotos.push(await storePublicImage(tx, photo, { ownerId: userId, listingId: id }));
        const updated = await tx.query(
          `update ika_listings set
             title = $3, category = $4, transaction_type = $5, price = $6, neighborhood = $7,
             surface_label = $8, surface_m2 = $9, road_access = $10, bedrooms = $11, bathrooms = $12,
             furnished = $13, description = $14, declared_document = $15, latitude = $16, longitude = $17,
             image_url = $18, status = $19, moderation_note = null, published_at = null, updated_at = now(),
             document_verified_at = null, country_code = coalesce($20, country_code)
           where id = $1 and owner_id = $2 returning id`,
          [
            id, userId, input.title.trim(), input.category, input.transactionType, input.price,
            input.neighborhood.trim(), input.surfaceLabel.trim(), input.surfaceM2, input.roadAccess,
            input.bedrooms, input.bathrooms, input.furnished, input.description.trim(),
            input.declaredDocument, point?.lat ?? null, point?.lng ?? null, durablePhotos[0], next, countryCode,
          ],
        );
        if (!updated[0]) throw notFound("Annonce introuvable.");
        await replacePhotos(tx, id, durablePhotos);
      });
      await accounts.audit(userId, "LISTING_EDIT", id, next);
      await trust.detectListingAnomalies(id);
      return { status: next };
    },

    async setOutcome(userId, id, outcome) {
      await accounts.requireActive(userId);
      if (!OUTCOMES.includes(outcome)) throw badRequest("Action inconnue.");
      const row = await ownListingRow(userId, id);
      if (!row) throw notFound("Annonce introuvable.");
      if (outcome === "RENEW") {
        if (row.status !== "PUBLISHED") throw conflict("Seule une annonce publiée se prolonge.");
        await db.query(
          "update ika_listings set expires_at = now() + interval '45 days', updated_at = now() where id = $1",
          [row.id],
        );
      } else if (outcome === "RESUBMIT") {
        if (statusAfterOwnerEdit(row.status) !== "PENDING") {
          throw conflict("Cette annonce ne peut pas être renvoyée.");
        }
        await db.query(
          `update ika_listings set status = 'PENDING', moderation_note = null, updated_at = now(), published_at = null
           where id = $1`,
          [row.id],
        );
      } else if (outcome === "SOLD" || outcome === "RENTED") {
        if (row.status !== "PUBLISHED") throw conflict("Seule une annonce publiée peut être marquée.");
        await db.query("update ika_listings set status = $2, updated_at = now() where id = $1", [row.id, outcome]);
      } else {
        await db.query("update ika_listings set status = 'ARCHIVED', updated_at = now() where id = $1", [row.id]);
      }
      return { ok: true };
    },

    async toggleFavorite(userId, id) {
      await accounts.requireActive(userId);
      const existing = await db.query(
        "select listing_id from ika_favorites where user_id = $1 and listing_id = $2",
        [userId, id],
      );
      if (existing[0]) {
        await db.query("delete from ika_favorites where user_id = $1 and listing_id = $2", [userId, id]);
        return { on: false };
      }
      const exists = await db.query(
        "select id from ika_listings where id = $1 and status = 'PUBLISHED' and visibility <> 'HIDDEN'",
        [id],
      );
      if (!exists[0]) throw notFound("Annonce introuvable.");
      await db.query("insert into ika_favorites (user_id, listing_id) values ($1, $2)", [userId, id]);
      return { on: true };
    },

    async listFavorites(userId) {
      const columns = listingColumns("l");
      const rows = await db.query(
        `select ${columns} from ika_favorites f join ika_listings l on l.id = f.listing_id
         where f.user_id = $1 and l.status = 'PUBLISHED' and l.visibility <> 'HIDDEN'
         order by f.created_at desc`,
        [userId],
      );
      return rows.map((row) => toCard(row));
    },

    /** Seul chemin par lequel le numéro sort : connecté, limité, et compté dans les statistiques. */
    async recordContact(userId, id, kind) {
      await accounts.requireActive(userId);
      const rows = await db.query(
        `select owner_phone from ika_listings
         where id = $1 and status = 'PUBLISHED' and visibility <> 'HIDDEN'
           and (expires_at is null or expires_at > now())`,
        [id],
      );
      if (!rows[0]) throw notFound("Annonce introuvable.");
      await db.query(
        "insert into ika_contact_events (id, listing_id, user_id, kind) values ($1, $2, $3, $4)",
        [newId("ct"), id, userId, kind === "WHATSAPP" ? "WHATSAPP" : "CALL"],
      );
      return { phone: rows[0].owner_phone };
    },

    async addComment(userId, id, body) {
      const profile = await accounts.ensureProfile(userId);
      accounts.assertCanPublish(profile);
      const text = String(body ?? "").trim().slice(0, 1000);
      if (text.length < 2) throw badRequest("Le commentaire est trop court.");
      const target = await db.query(
        "select id from ika_listings where id = $1 and status = 'PUBLISHED' and visibility <> 'HIDDEN'",
        [id],
      );
      if (!target[0]) throw notFound("Annonce introuvable.");
      await db.query(
        "insert into ika_comments (id, listing_id, user_id, author_name, body) values ($1, $2, $3, $4, $5)",
        [newId("cm"), id, userId, profile.full_name || "Visiteur", text],
      );
      return { ok: true };
    },

    async listComments(id) {
      const rows = await db.query(
        `select id, author_name, body, created_at from ika_comments
         where listing_id = $1 and status = 'VISIBLE' order by created_at desc limit 30`,
        [String(id).slice(0, 80)],
      );
      return rows.map((row) => ({
        id: row.id,
        authorName: row.author_name,
        body: row.body,
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      }));
    },

    async report(userId, id, { reason, details }) {
      if (!REPORT_REASONS.includes(reason)) throw badRequest("Motif de signalement invalide.");
      await accounts.requireActive(userId);
      const target = await db.query("select id from ika_listings where id = $1", [id]);
      if (!target[0]) throw notFound("Annonce introuvable.");
      await db.query(
        "insert into ika_reports (id, listing_id, reporter_id, reason, details) values ($1, $2, $3, $4, $5)",
        [newId("rep"), id, userId, reason, String(details ?? "").slice(0, 1000)],
      );
      return { ok: true };
    },
  };
}

