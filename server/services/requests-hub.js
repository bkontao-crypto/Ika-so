// Page « Demandes & validations » du Owner Center : toutes les demandes en attente au même endroit, et notification de l'équipe.
// Chaque type n'est montré qu'à l'équipe habilitée (même garde par module que les écrans de traitement).
const STAFF = "('MODERATOR', 'ADMIN', 'SUPERADMIN')";
const LATE_HOURS = 48;
const iso = (d) => (d ? new Date(d).toISOString() : null);

export function createRequestsHub({ db, ownerDelegations, notify }) {
  async function allowed(userId, module) {
    try { return await ownerDelegations.gate(userId, module); } catch { return false; }
  }
  const late = (d) => Date.now() - new Date(d).getTime() > LATE_HOURS * 3600_000;

  return {
    /** Prévient l'équipe (modérateurs, administrateurs, super-administrateurs) d'une nouvelle demande. Ne bloque jamais la demande. */
    async notifyStaff({ kind, title, body, link, exceptUserId, module }) {
      if (!notify) return;
      try {
        const staff = await db.query(`select user_id, staff_role from ika_profiles where staff_role in ${STAFF} and account_status <> 'BANNED' and user_id <> $1`, [exceptUserId ?? ""]);
        const targets = [];
        for (const r of staff) if (!module || (await allowed(r.user_id, module))) targets.push(r);
        await Promise.all(targets.map((r) => notify(r.user_id, { kind, title, body, link }).catch(() => undefined)));
      } catch { /* la demande est déjà enregistrée */ }
    },

    /** Compteurs et les 8 plus anciennes demandes de chaque type (les plus anciennes d'abord : ce sont elles qui attendent le plus). */
    async summary(userId) {
      const [okAgencies, okListings, okPayments] = await Promise.all([allowed(userId, "agencies"), allowed(userId, "moderation"), allowed(userId, "payments")]);
      const sections = [];
      const safe = async (promise) => { try { return await promise; } catch { return null; } };
      if (okAgencies) {
        const rows = await safe(db.query(
          `select a.id, a.type, a.status, a.created_at, p.full_name, u.email from ika_advertiser_applications a join ika_users u on u.id = a.user_id left join ika_profiles p on p.user_id = a.user_id
            where a.status in ('PENDING', 'UNDER_REVIEW', 'ADDITIONAL_INFO_REQUIRED') order by a.created_at asc limit 8`));
        const n = await safe(db.query("select count(*)::int as n from ika_advertiser_applications where status in ('PENDING', 'UNDER_REVIEW', 'ADDITIONAL_INFO_REQUIRED')"));
        sections.push({ key: "advertisers", title: "Demandes annonceur", module: "agencies", total: n?.[0]?.n ?? null,
          items: (rows ?? []).map((r) => ({ id: r.id, title: r.full_name || r.email, detail: `${r.type === "AGENCE" ? "Agence immobilière" : "Particulier"} · ${({ PENDING: "à examiner", UNDER_REVIEW: "en cours d'examen", ADDITIONAL_INFO_REQUIRED: "informations demandées" })[r.status] ?? r.status}`, createdAt: iso(r.created_at), late: late(r.created_at) })) });
      }
      if (okListings) {
        const rows = await safe(db.query(
          `select l.id, l.title, l.neighborhood, l.created_at, p.full_name from ika_listings l left join ika_profiles p on p.user_id = l.owner_id where l.status = 'PENDING' order by l.created_at asc limit 8`));
        const n = await safe(db.query("select count(*)::int as n from ika_listings where status = 'PENDING'"));
        sections.push({ key: "listings", title: "Annonces à valider", module: "listings", total: n?.[0]?.n ?? null,
          items: (rows ?? []).map((r) => ({ id: r.id, title: r.title, detail: [r.full_name, r.neighborhood].filter(Boolean).join(" · "), createdAt: iso(r.created_at), late: late(r.created_at) })) });
        const fr = await safe(db.query(
          `select r.id, l.title, r.created_at, p.full_name from ika_featured_requests r join ika_listings l on l.id = r.listing_id left join ika_profiles p on p.user_id = r.requester_id where r.status = 'PENDING' order by r.created_at asc limit 8`));
        const fn = await safe(db.query("select count(*)::int as n from ika_featured_requests where status = 'PENDING'"));
        sections.push({ key: "featured", title: "Demandes de mise à la une", module: "listings", total: fn?.[0]?.n ?? null,
          items: (fr ?? []).map((r) => ({ id: r.id, title: r.title, detail: r.full_name ?? "", createdAt: iso(r.created_at), late: late(r.created_at) })) });
      }
      if (okPayments) {
        const rows = await safe(db.query(
          `select r.id, r.months, r.account_type, r.created_at, p.full_name from ika_premium_requests r left join ika_profiles p on p.user_id = r.user_id where r.status = 'PENDING' order by r.created_at asc limit 8`));
        const n = await safe(db.query("select count(*)::int as n from ika_premium_requests where status = 'PENDING'"));
        sections.push({ key: "premium", title: "Demandes Premium", module: "payments", total: n?.[0]?.n ?? null,
          items: (rows ?? []).map((r) => ({ id: r.id, title: r.full_name || "Annonceur", detail: `${r.months} mois demandés · ${({ AGENCY: "agence", INDIVIDUAL: "particulier", OTHER: "autre" })[r.account_type] ?? ""}`, createdAt: iso(r.created_at), late: late(r.created_at) })) });
      }
      const pending = sections.reduce((s, x) => s + (x.total ?? 0), 0);
      return { sections, pending, lateAfterHours: LATE_HOURS };
    },
  };
}
