import { badRequest, conflict, forbidden, notFound } from "../lib/errors.js";
import { asBadRequest } from "../lib/errors.js";
import {
  assertCanSanction,
  assertDecision,
  assertFeaturedCap,
  assertSanction,
  assertStaffRoleChange,
  STAFF_ROLES,
  canBeFeatured,
} from "../lib/rules.js";
import { LISTING_COLUMNS, iso, isLive, toCard } from "./cards.js";
import { findSimilar } from "./duplicates.js";

export function createModeration(ctx, accounts, engagement) {
  const { db } = ctx;

  async function settingInt(key, fallback) {
    const rows = await db.query("select value from ika_settings where key = $1", [key]);
    const n = Number(rows[0]?.value);
    return Number.isInteger(n) && n >= 0 ? n : fallback;
  }

  return {
    async queue(userId) {
      await accounts.requireStaff(userId);
      const pending = await db.query(
        `select ${LISTING_COLUMNS} from ika_listings where status = 'PENDING' order by created_at asc`,
      );
      const reports = await db.query(
        `select r.id, r.listing_id, r.reason, r.details, l.title
         from ika_reports r left join ika_listings l on l.id = r.listing_id
         where r.status = 'OPEN' order by r.created_at desc`,
      );
      const online = await db.query(
        `select id, title, neighborhood, featured_until from ika_listings
         where status = 'PUBLISHED' order by featured_until desc nulls last, published_at desc limit 20`,
      );
      const journal = await db.query(
        "select action, note, created_at, listing_id from ika_audit order by created_at desc limit 12",
      );
      const stats = await db.query(
        `select
           (select count(*)::int from ika_listings where status = 'PUBLISHED') as published,
           (select count(*)::int from ika_listings where status = 'PENDING') as pending,
           (select count(*)::int from ika_reports where status = 'OPEN') as open_reports,
           (select count(*)::int from ika_listings where created_at > now() - interval '7 days') as new_7d,
           (select count(*)::int from ika_contact_events where created_at > now() - interval '7 days') as contacts_7d,
           (select count(*)::int from ika_contact_events where created_at > now() - interval '14 days'
              and created_at <= now() - interval '7 days') as contacts_prev_7d`,
      );
      const s = stats[0];
      return {
        pending: await Promise.all(
          pending.map(async (row) => {
            const card = toCard(row, { revealPhone: true });
            card.similarIds = await findSimilar(db, card, { excludeId: card.id });
            return card;
          }),
        ),
        reports: reports.map((r) => ({
          id: r.id,
          listingId: r.listing_id,
          reason: r.reason,
          details: r.details ?? "",
          title: r.title ?? "Annonce retirée",
        })),
        publishedCount: Number(s.published),
        stats: {
          published: Number(s.published),
          pending: Number(s.pending),
          openReports: Number(s.open_reports),
          newListings7d: Number(s.new_7d),
          contacts7d: Number(s.contacts_7d),
          contactsPrev7d: Number(s.contacts_prev_7d),
        },
        online: online.map((row) => ({
          id: row.id,
          title: row.title,
          neighborhood: row.neighborhood,
          featured: isLive(row.featured_until),
        })),
        journal: journal.map((row) => ({
          action: row.action,
          note: row.note ?? "",
          listingId: row.listing_id ?? "",
          createdAt: iso(row.created_at),
        })),
      };
    },

    async decide(userId, id, action, reason) {
      await accounts.requireStaff(userId);
      asBadRequest(() => assertDecision(action, reason));
      if (action === "APPROVE") {
        // Publication et point d'historique de prix dans une seule instruction : l'un ne va pas sans l'autre.
        // Un point n'est ajouté que si le prix a changé depuis le dernier point.
        const updated = await db.query(
          `with upd as (
             update ika_listings
             set status = 'PUBLISHED', published_at = now(), updated_at = now(),
                 moderation_note = null, expires_at = now() + interval '45 days'
             where id = $1 and status = 'PENDING' returning id, price
           ), point as (
             insert into ika_listing_price_history (id, listing_id, price)
             select 'pr-' || gen_random_uuid()::text, upd.id, upd.price from upd
             where upd.price is distinct from (
               select h.price from ika_listing_price_history h where h.listing_id = upd.id
               order by h.recorded_at desc, h.id desc limit 1)
             returning 1
           )
           select id from upd`,
          [id],
        );
        if (!updated[0]) throw conflict("Annonce déjà traitée.");
        await accounts.audit(userId, "APPROVE", id, "");
        // Alertes immédiates : annonceur prévenu, puis personnes dont une recherche enregistrée correspond.
        const owner = await db.query("select owner_id, title from ika_listings where id = $1", [id]);
        await engagement.notify(owner[0].owner_id, { kind: "LISTING_APPROVED", title: `Annonce publiée : ${owner[0].title}`, link: `#/annonce/${id}` });
        const { notified } = await engagement.onPublished(id);
        return { ok: true, alertsSent: notified };
      }
      const updated = await db.query(
        `update ika_listings
         set status = 'REJECTED', moderation_note = $2, updated_at = now(), published_at = null
         where id = $1 and status = 'PENDING' returning id`,
        [id, reason],
      );
      if (!updated[0]) throw conflict("Annonce déjà traitée.");
      await accounts.audit(userId, "REJECT", id, reason);
      const owner = await db.query("select owner_id, title from ika_listings where id = $1", [id]);
      await engagement.notify(owner[0].owner_id, { kind: "LISTING_REJECTED", title: `Annonce refusée : ${owner[0].title}`, body: reason, link: "#/mes-annonces" });
      return { ok: true };
    },

    async dismissReport(userId, id) {
      await accounts.requireStaff(userId);
      await db.query("update ika_reports set status = 'DISMISSED' where id = $1", [id]);
      await accounts.audit(userId, "DISMISS_REPORT", null, id);
      return { ok: true };
    },

    async hideComment(userId, id) {
      await accounts.requireStaff(userId);
      const rows = await db.query(
        "update ika_comments set status = 'HIDDEN' where id = $1 returning id, listing_id",
        [id],
      );
      if (!rows[0]) throw notFound("Commentaire introuvable.");
      await accounts.audit(userId, "HIDE_COMMENT", rows[0].listing_id, id);
      return { ok: true, listingId: rows[0].listing_id };
    },

    async setFeatured(userId, id, on) {
      await accounts.requireStaff(userId, "ADMIN");
      const rows = await db.query("select status, visibility from ika_listings where id = $1", [id]);
      if (!rows[0]) throw notFound("Annonce introuvable.");
      if (on) {
        if (!canBeFeatured(rows[0].status, rows[0].visibility)) {
          throw badRequest("Seule une annonce publiée et visible peut être mise à la une.");
        }
        const max = await settingInt("featured_max", 6);
        // Comptage, contrôle du plafond, mise à la une et trace dans une seule transaction, sous le même verrou
        // que l'achat payant (checkout) : le plafond ne peut plus être dépassé par des actions simultanées.
        await db.transaction(async (tx) => {
          await tx.query("select pg_advisory_xact_lock(727002)");
          const others = await tx.query(
            `select count(*)::int as n from (
               select id from ika_listings where featured_until > now() and id <> $1
               union
               select listing_id from ika_payments
               where status = 'PENDING' and created_at > now() - interval '30 minutes' and listing_id <> $1
             ) t`,
            [id],
          );
          asBadRequest(() => assertFeaturedCap(Number(others[0]?.n ?? 0), max));
          await tx.query("update ika_listings set featured_until = now() + interval '7 days', updated_at = now() where id = $1", [id]);
          await accounts.audit(userId, "FEATURE", id, "", tx);
        });
      } else {
        await db.transaction(async (tx) => {
          await tx.query("update ika_listings set featured_until = null, updated_at = now() where id = $1", [id]);
          await accounts.audit(userId, "UNFEATURE", id, "", tx);
        });
      }
      return { ok: true };
    },

    async listAccounts(userId) {
      await accounts.requireStaff(userId);
      const rows = await db.query(
        `select user_id, full_name, phone, staff_role, account_status, status_reason
         from ika_profiles order by created_at desc limit 100`,
      );
      return rows.map((row) => ({
        userId: row.user_id,
        fullName: row.full_name || "Sans nom",
        phone: row.phone ?? "",
        staffRole: row.staff_role,
        accountStatus: row.account_status,
        statusReason: row.status_reason ?? "",
      }));
    },

    async setAccountStatus(userId, targetId, status, rawReason) {
      const actor = await accounts.requireStaff(userId);
      const reason = String(rawReason ?? "").trim().slice(0, 500);
      if (targetId === userId) throw forbidden("Vous ne pouvez pas modifier votre propre compte.");
      asBadRequest(() => assertSanction(status, reason));
      const target = await db.query("select staff_role from ika_profiles where user_id = $1", [targetId]);
      if (!target[0]) throw notFound("Compte introuvable.");
      try {
        assertCanSanction(actor.staff_role, target[0].staff_role, status);
      } catch (error) {
        throw forbidden(error.message);
      }
      // Sanction, retrait des annonces, fermeture des sessions et trace d'audit : tout ou rien.
      await db.transaction(async (tx) => {
        await tx.query(
          "update ika_profiles set account_status = $2, status_reason = $3 where user_id = $1",
          [targetId, status, status === "ACTIVE" ? null : reason],
        );
        if (status === "BANNED") {
          // Annonces retirées : masquées, plus à la une, visibilité d'origine mémorisée ; sessions fermées.
          await tx.query(
            `update ika_listings
             set visibility_before_ban = visibility, visibility = 'HIDDEN', featured_until = null, updated_at = now()
             where owner_id = $1 and visibility <> 'HIDDEN' and visibility_before_ban is null`,
            [targetId],
          );
          await tx.query("delete from ika_sessions where user_id = $1", [targetId]);
        } else {
          await tx.query(
            `update ika_listings
             set visibility = coalesce(visibility_before_ban, 'NORMAL'), visibility_before_ban = null, updated_at = now()
             where owner_id = $1 and visibility_before_ban is not null`,
            [targetId],
          );
        }
        await accounts.audit(userId, "SANCTION", null, `${status} ${targetId} ${reason}`, tx);
      });
      return { ok: true };
    },

    async setStaffRole(userId, targetId, role) {
      await accounts.requireStaff(userId, "SUPERADMIN"); // refus rapide ; revérifié sous verrou ci-dessous
      if (!["USER", ...STAFF_ROLES].includes(role)) throw badRequest("Rôle inconnu.");
      if (targetId === userId) throw forbidden("Vous ne pouvez pas modifier votre propre rôle.");
      await db.transaction(async (tx) => {
        // Les changements de rôle sont sérialisés : deux SUPERADMIN qui se rétrogradent en même temps
        // sont traités l'un après l'autre, et le second voit que ses droits ont déjà disparu.
        await tx.query("select pg_advisory_xact_lock(727003)");
        const actor = (await tx.query("select staff_role, account_status from ika_profiles where user_id = $1", [userId]))[0];
        if (!actor || actor.staff_role !== "SUPERADMIN" || actor.account_status !== "ACTIVE") throw forbidden("Réservé au super administrateur.");
        try {
          assertStaffRoleChange(actor.staff_role, role);
        } catch (error) {
          throw badRequest(error.message);
        }
        // Protection du dernier SUPERADMIN actif : impossible de le rétrograder.
        if (role !== "SUPERADMIN") {
          const target = (await tx.query("select staff_role from ika_profiles where user_id = $1", [targetId]))[0];
          if (target?.staff_role === "SUPERADMIN") {
            const others = await tx.query(
              "select count(*)::int as n from ika_profiles where staff_role = 'SUPERADMIN' and account_status = 'ACTIVE' and user_id <> $1",
              [targetId]
            );
            if (others[0].n === 0) throw forbidden("Impossible de rétrograder le dernier super administrateur actif.");
          }
        }
        const updated = await tx.query(
          "update ika_profiles set staff_role = $2 where user_id = $1 returning user_id",
          [targetId, role],
        );
        if (!updated[0]) throw notFound("Compte introuvable.");
        // Garde-fou final : il doit toujours rester au moins un SUPERADMIN actif.
        const left = await tx.query("select count(*)::int as n from ika_profiles where staff_role = 'SUPERADMIN' and account_status = 'ACTIVE'");
        if (Number(left[0]?.n ?? 0) < 1) throw badRequest("Il doit rester au moins un super administrateur actif.");
        await accounts.audit(userId, "STAFF_ROLE", null, `${role} ${targetId}`, tx);
      });
      return { ok: true };
    },
  };
}
