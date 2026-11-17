// Demandes de mise à la une envoyées par les annonceurs à l'équipe. Gratuites : aucun paiement ici.
// Le staff habilité (modérateurs : lecture ; administrateurs et superadmin : décision) est prévenu.
import { randomUUID } from "node:crypto";
import { badRequest, conflict, notFound } from "../lib/errors.js";

const STAFF_ROLES = "('MODERATOR', 'ADMIN', 'SUPERADMIN')";

export function createFeaturedRequests({ db, accounts, moderation, notify }) {
  async function staffToNotify(exceptUserId) {
    return db.query(`select user_id from ika_profiles where staff_role in ${STAFF_ROLES} and account_status <> 'BANNED' and user_id <> $1`, [exceptUserId ?? ""]);
  }

  return {
    /** Un annonceur demande la mise à la une d'une de SES annonces en ligne. */
    async create(userId, { listingId, message } = {}) {
      await accounts.requireActive(userId);
      const rows = await db.query("select id, title, status from ika_listings where id = $1 and owner_id = $2", [String(listingId ?? ""), userId]);
      if (!rows[0]) throw notFound("Annonce introuvable.");
      if (rows[0].status !== "PUBLISHED") throw badRequest("Seule une annonce en ligne peut être demandée à la une.");
      const pending = await db.query("select id from ika_featured_requests where listing_id = $1 and status = 'PENDING'", [rows[0].id]);
      if (pending[0]) throw conflict("Une demande est déjà en attente pour cette annonce.");
      const text = String(message ?? "").trim().slice(0, 500);
      const id = `fr_${randomUUID()}`;
      await db.query(
        "insert into ika_featured_requests (id, listing_id, requester_id, message) values ($1, $2, $3, $4)",
        [id, rows[0].id, userId, text],
      );
      if (notify) {
        try {
          const staff = await staffToNotify(userId);
          await Promise.all(staff.map((r) => notify(r.user_id, {
            kind: "FEATURED_REQUEST",
            title: `Demande de mise à la une : ${rows[0].title}`,
            body: text || "Sans message.",
            link: "/admin.html",
          })));
        } catch { /* la demande reste enregistrée même si la notification échoue */ }
      }
      return { id, status: "PENDING" };
    },

    /** Les demandes de l'annonceur (pour afficher l'état sur ses annonces). */
    async mine(userId) {
      const rows = await db.query("select listing_id, status, handled_note, created_at from ika_featured_requests where requester_id = $1 order by created_at desc limit 100", [userId]);
      return rows.map((r) => ({ listingId: r.listing_id, status: r.status, note: r.handled_note, createdAt: r.created_at }));
    },

    /** Liste pour le staff : « PENDING » (à traiter) ou « DONE » (traitées récemment). */
    async listForStaff(staffId, { status = "PENDING" } = {}) {
      await accounts.requirePermission(staffId, "moderation.review");
      const where = status === "DONE" ? "r.status <> 'PENDING'" : "r.status = 'PENDING'";
      const rows = await db.query(
        `select r.id, r.listing_id, r.status, r.message, r.handled_note, r.created_at, r.handled_at,
                l.title, l.neighborhood, l.image_url, l.status as listing_status, p.full_name as requester_name
           from ika_featured_requests r
           join ika_listings l on l.id = r.listing_id
           left join ika_profiles p on p.user_id = r.requester_id
          where ${where}
          order by ${status === "DONE" ? "r.handled_at desc nulls last" : "r.created_at asc"}
          limit 100`,
      );
      return rows.map((r) => ({
        id: r.id, listingId: r.listing_id, status: r.status, message: r.message, note: r.handled_note,
        createdAt: r.created_at, handledAt: r.handled_at, title: r.title, neighborhood: r.neighborhood,
        imageUrl: r.image_url, listingStatus: r.listing_status, requesterName: r.requester_name || "Annonceur",
      }));
    },

    /** Décision du staff. ACCEPT met l'annonce à la une (contrôle de permission dans moderation.setFeatured). */
    async decide(staffId, id, { action, note } = {}) {
      await accounts.requirePermission(staffId, "moderation.review");
      if (!["ACCEPT", "REJECT"].includes(action)) throw badRequest("Action inconnue.");
      const text = String(note ?? "").trim().slice(0, 500);
      if (action === "REJECT" && text.length < 3) throw badRequest("Indiquez le motif du refus.");
      const rows = await db.query("select * from ika_featured_requests where id = $1", [String(id)]);
      if (!rows[0]) throw notFound("Demande introuvable.");
      const req = rows[0];
      if (req.status !== "PENDING") throw conflict("Cette demande est déjà traitée.");
      const newStatus = action === "ACCEPT" ? "ACCEPTED" : "REJECTED";
      // Verrou de statut : une seule décision possible, même en cas de double clic.
      const claimed = await db.query(
        "update ika_featured_requests set status = $2, handled_by = $3, handled_at = now(), handled_note = $4 where id = $1 and status = 'PENDING' returning id",
        [req.id, newStatus, staffId, text],
      );
      if (!claimed[0]) throw conflict("Cette demande est déjà traitée.");
      if (action === "ACCEPT") {
        try {
          await moderation.setFeatured(staffId, req.listing_id, true);
        } catch (error) {
          // Échec de la mise à la une : la demande redevient en attente.
          await db.query("update ika_featured_requests set status = 'PENDING', handled_by = null, handled_at = null, handled_note = '' where id = $1", [req.id]);
          throw error;
        }
      }
      if (notify) {
        try {
          const title = await db.query("select title from ika_listings where id = $1", [req.listing_id]);
          await notify(req.requester_id, {
            kind: "FEATURED_REQUEST_DECISION",
            title: action === "ACCEPT" ? `Mise à la une acceptée : ${title[0]?.title ?? ""}` : `Demande de mise à la une refusée : ${title[0]?.title ?? ""}`,
            body: text,
            link: "#/mes-annonces",
          });
        } catch { /* meilleur effort */ }
      }
      await accounts.audit(staffId, action === "ACCEPT" ? "FEATURED_REQUEST_ACCEPT" : "FEATURED_REQUEST_REJECT", req.listing_id, text || "accepté");
      return { ok: true, status: newStatus };
    },
  };
}
