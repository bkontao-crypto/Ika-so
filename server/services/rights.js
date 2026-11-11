/**
 * Droits des personnes (Loi n° 2013-015 : accès, rectification, suppression).
 * - exportData : copie de ce que le service garde sur le compte, en JSON (sans mot de passe ni contenu binaire).
 * - deleteAccount : suppression du compte après mot de passe + mot de confirmation.
 * Ce qui doit rester pour la comptabilité (paiements et factures) est conservé SANS identité : le compte est anonymisé.
 * Le journal ika_data_requests ne garde que le type, la date et l'issue : aucune donnée personnelle.
 */
import { badRequest, conflict, forbidden } from "../lib/errors.js";
import { newId, verifyPassword } from "../lib/security.js";

export const DELETE_CONFIRM_WORD = "SUPPRIMER";
const MEDIA = /\/api\/media\/([0-9a-f-]{36})/i;

export function createRights({ db }, accounts) {
  const mediaId = (url) => MEDIA.exec(String(url ?? ""))?.[1]?.toLowerCase() ?? null;

  async function log(q, kind, outcome, detail = "") {
    await q.query("insert into ika_data_requests (id, kind, outcome, detail) values ($1,$2,$3,$4)", [newId("dr"), kind, outcome, detail.slice(0, 200)]);
  }

  return {
    async exportData(userId) {
      await accounts.requireActive(userId);
      const one = async (text) => (await db.query(text, [userId]))[0] ?? null;
      const many = (text) => db.query(text, [userId]);
      const data = {
        exportedAt: new Date().toISOString(),
        notice: "Copie des données que Ika So conserve sur votre compte. Le mot de passe (haché) et le contenu des fichiers ne sont pas inclus.",
        account: await one("select id, email, name, created_at, terms_version, terms_accepted_at from ika_users where id = $1"),
        profile: await one("select full_name, phone, phone_verified_at, phone_channel, display_role, staff_role, account_status, status_reason, agency_name, agency_verified_at, created_at from ika_profiles where user_id = $1"),
        listings: await many("select l.*, (select coalesce(jsonb_agg(p.url order by p.position), '[]'::jsonb) from ika_listing_photos p where p.listing_id = l.id) as photos from ika_listings l where l.owner_id = $1 order by l.created_at"),
        geolocations: await many("select listing_id, latitude, longitude, polygon, area_m2, perimeter_m, is_public, created_at, updated_at from ika_listing_geo where listing_id in (select id from ika_listings where owner_id = $1)"),
        proofs: await many("select id, listing_id, kind, file_type, status, review_note, agency_name, created_at, reviewed_at from ika_proofs where owner_id = $1 order by created_at"),
        advertiserApplications: await many("select id, type, status, display_role_requested, data, admin_note, created_at, reviewed_at, (select coalesce(jsonb_agg(jsonb_build_object('label', d->>'label', 'type', d->>'type', 'addedAt', d->>'addedAt')), '[]'::jsonb) from jsonb_array_elements(documents) d) as documents from ika_advertiser_applications where user_id = $1 order by created_at"),
        favorites: await many("select listing_id, created_at from ika_favorites where user_id = $1"),
        savedSearches: await many("select label, filters, created_at from ika_saved_searches where user_id = $1"),
        notifications: await many("select * from ika_notifications where user_id = $1 order by created_at"),
        comments: await many("select listing_id, body, status, created_at from ika_comments where user_id = $1 order by created_at"),
        threads: await many("select t.id, t.listing_id, t.owner_id, t.visitor_id, t.created_at from ika_threads t where t.owner_id = $1 or t.visitor_id = $1"),
        messages: await many("select m.thread_id, m.sender_id, m.body, m.created_at from ika_messages m join ika_threads t on t.id = m.thread_id where t.owner_id = $1 or t.visitor_id = $1 order by m.created_at"),
        visitRequests: await many("select * from ika_visit_requests where requester_id = $1 or owner_id = $1 order by created_at"),
        draft: await one("select payload, updated_at from ika_listing_drafts where user_id = $1"),
        outsideAlerts: await one("select email_enabled, sms_enabled, consent_at from ika_notify_prefs where user_id = $1"),
        alertPreferences: await one("select mode, last_digest_at from ika_alert_prefs where user_id = $1"),
        blockedUsers: await many("select blocked_id, created_at from ika_user_blocks where blocker_id = $1"),
        usageConsent: await many("select accepted, text_version, decided_at from ika_analytics_consent where user_id = $1"),
        usageEvents: await many("select event_type, occurred_at, listing_id, advertiser_id, source, device_type from ika_analytics_events where user_id = $1 order by occurred_at desc limit 5000"),
        publicProfile: await many("select bio, founded_year, zones, address, opening_hours, show_phone, show_whatsapp, cover_url, avatar_url, updated_at from ika_advertiser_profiles where user_id = $1"),
        newsletter: await one("select opted_in_at from ika_newsletter_optin where user_id = $1"),
        complaints: await many("select id, listing_id, reason, details, status, resolution, created_at, resolved_at, closed_at from ika_reports where reporter_id = $1 order by created_at"),
        complaintComments: await many("select report_id, content, created_at from ika_complaint_comments where author_id = $1 order by created_at"),
        reviewsGiven: await many("select advertiser_id, rating, body, status, created_at from ika_reviews where reviewer_id = $1"),
        reviewsReceived: await many("select rating, body, reply_body, reply_at, status, created_at from ika_reviews where advertiser_id = $1"),
        payments: await many("select id, kind, listing_id, offer_code, days, amount_xof, status, provider, created_at, paid_at from ika_payments where user_id = $1 order by created_at"),
        invoices: await many("select number, label, amount_xof, customer_name, issued_at from ika_invoices where user_id = $1 order by issued_at"),
      };
      await log(db, "EXPORT", "DONE");
      return data;
    },

    async deleteAccount(userId, { password, confirm } = {}) {
      const profile = await accounts.requireActive(userId);
      if (String(confirm ?? "").trim() !== DELETE_CONFIRM_WORD) throw badRequest(`Tapez le mot ${DELETE_CONFIRM_WORD} pour confirmer.`);
      const user = (await db.query("select password_hash from ika_users where id = $1", [userId]))[0];
      if (!user || !(await verifyPassword(String(password ?? ""), user.password_hash))) throw forbidden("Mot de passe incorrect.");
      if (profile.staff_role !== "USER") {
        await log(db, "DELETE", "REFUSED", "équipe");
        throw conflict("Un compte de l'équipe ne peut pas être supprimé ici : demandez d'abord le retrait de votre rôle à un administrateur.");
      }
      return db.transaction(async (tx) => {
        // Verrou : pas de nouveau paiement pendant la suppression.
        await tx.query("select id from ika_users where id = $1 for update", [userId]);
        const pending = await tx.query("select 1 from ika_payments where user_id = $1 and status = 'PENDING' limit 1", [userId]);
        if (pending[0]) {
          await log(tx, "DELETE", "REFUSED", "paiement en cours");
          throw conflict("Un paiement est en cours. Réessayez quand il sera terminé ou expiré.");
        }
        const hasMoney = (await tx.query("select 1 from ika_payments where user_id = $1 limit 1", [userId]))[0] !== undefined;

        // Fichiers à supprimer : justificatifs (privés) et images des annonces du compte.
        const fileIds = new Set();
        for (const r of await tx.query("select file_id::text as id from ika_proofs where owner_id = $1 and file_id is not null", [userId])) fileIds.add(r.id);
        // Pièces jointes aux demandes annonceur (pièce d'identité, RCCM…) : fichiers et demandes supprimés avec le compte.
        for (const r of await tx.query("select d->>'fileId' as id from ika_advertiser_applications a, jsonb_array_elements(a.documents) d where a.user_id = $1 and d->>'fileId' is not null", [userId])) fileIds.add(r.id);
        await tx.query("delete from ika_advertiser_applications where user_id = $1", [userId]);
        for (const r of await tx.query("select image_url as url from ika_listings where owner_id = $1 union all select p.url from ika_listing_photos p join ika_listings l on l.id = p.listing_id where l.owner_id = $1", [userId])) {
          const id = mediaId(r.url);
          if (id) fileIds.add(id);
        }

        for (const r of await tx.query("select cover_url as url from ika_advertiser_profiles where user_id = $1 union all select avatar_url from ika_advertiser_profiles where user_id = $1", [userId])) {
          const id = mediaId(r.url);
          if (id) fileIds.add(id);
        }
        await tx.query("delete from ika_advertiser_profiles where user_id = $1", [userId]); // avant la suppression des fichiers (références)

        // Annonces : supprimées, sauf celles liées à un paiement (pièce comptable) qui sont vidées et archivées.
        await tx.query("delete from ika_listing_photos where listing_id in (select id from ika_listings where owner_id = $1)", [userId]);
        await tx.query("delete from ika_proofs where owner_id = $1", [userId]);
        await tx.query("delete from ika_listing_geo where listing_id in (select id from ika_listings where owner_id = $1)", [userId]); // positions et parcelles : jamais conservées, même si l'annonce reste archivée pour la comptabilité
        await tx.query("delete from ika_listings l where l.owner_id = $1 and not exists (select 1 from ika_payments p where p.listing_id = l.id)", [userId]);
        await tx.query(
          `update ika_listings set status = 'ARCHIVED', visibility = 'HIDDEN', title = 'Annonce retirée', description = 'Annonce retirée à la demande du titulaire.',
             owner_name = 'Compte supprimé', owner_phone = '', image_url = '', declared_document = null, latitude = null, longitude = null, updated_at = now()
           where owner_id = $1`, [userId]);
        for (const id of fileIds) await tx.query("delete from stored_files where id = $1::uuid", [id]);

        // Données d'usage.
        for (const [table, col] of [["ika_sessions", "user_id"], ["ika_otp", "user_id"], ["ika_favorites", "user_id"], ["ika_saved_searches", "user_id"],
          ["ika_notifications", "user_id"], ["ika_comments", "user_id"], ["ika_threads", "owner_id"], ["ika_threads", "visitor_id"],
          ["ika_visit_requests", "requester_id"], ["ika_visit_requests", "owner_id"], ["ika_listing_drafts", "user_id"], ["ika_alert_prefs", "user_id"], ["ika_notify_prefs", "user_id"],
          ["ika_alert_pending", "user_id"], ["ika_user_blocks", "blocker_id"], ["ika_user_blocks", "blocked_id"], ["ika_profile_contact_events", "user_id"], ["ika_analytics_events", "user_id"], ["ika_analytics_consent", "user_id"], ["ika_visit_sessions", "user_id"], ["ika_profile_contact_events", "advertiser_id"],
          ["ika_reviews", "reviewer_id"], ["ika_reviews", "advertiser_id"], ["ika_review_reports", "reporter_id"], ["ika_user_reports", "reporter_id"], ["ika_user_reports", "reported_id"], ["ika_comment_reports", "reporter_id"], ["ika_newsletter_optin", "user_id"]]) {
          await tx.query(`delete from ${table} where ${col} = $1`, [userId]);
        }

        // Réclamations et commentaires de réclamation : le dossier reste (suivi de la modération) mais sans la personne ni ses mots.
        await tx.query("update ika_complaint_comments set author_id = null, content = '[commentaire supprimé à la demande de son auteur]' where author_id = $1", [userId]);
        await tx.query("update ika_reports set reporter_id = null, details = null where reporter_id = $1", [userId]);

        if (hasMoney) {
          // Anonymisation : l'e-mail et le nom disparaissent, la ligne reste pour les paiements et factures.
          await tx.query("update ika_profiles set full_name = '', phone = null, phone_verified_at = null, phone_channel = null, agency_name = null, agency_verified_at = null, status_reason = null where user_id = $1", [userId]);
          await tx.query("update ika_users set email = $2, name = 'Compte supprimé', password_hash = $3, deleted_at = now() where id = $1", [userId, `supprime-${userId}@invalid`.toLowerCase(), `x:${newId("pw")}`]);
        } else {
          await tx.query("delete from ika_users where id = $1", [userId]);
        }
        await log(tx, "DELETE", "DONE", hasMoney ? "anonymisé (comptabilité)" : "supprimé");
        return { deleted: true, anonymized: hasMoney };
      });
    },
  };
}
