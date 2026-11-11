// Annuaire des annonceurs (public) et centre de contrôle des annonceurs Premium certifiés (privé).
// Aucune donnée de contact n'est jamais renvoyée par l'annuaire. Le centre ne lit que les données de SON titulaire.
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import { newId } from "../lib/security.js";
import { compareDirectory, filterDirectory, premiumAccess, scoreAdvertiser } from "../lib/advertiser-ranking.js";
import { shortName } from "./reviews.js";

const LIVE = "l.status = 'PUBLISHED' and l.visibility <> 'HIDDEN' and (l.expires_at is null or l.expires_at > now())";
const PERIODS = [7, 14, 30, 90];
const iso = (d) => (d instanceof Date ? d.toISOString() : d ? String(d) : null);
const snippet = (t) => { const s = String(t ?? "").replace(/\s+/g, " ").trim(); return s.length > 90 ? `${s.slice(0, 87)}…` : s; };
const pct = (now, before) => (before > 0 ? Math.round(((now - before) / before) * 100) : now > 0 ? 100 : 0);

export function createAdvertiserCenter({ db, accounts }) {
  async function access(userId) {
    const rows = await db.query(
      `select p.premium_until, p.agency_verified_at, p.agency_name, p.full_name, p.display_role, p.account_status,
              (select count(*)::int from ika_listings l where l.owner_id = p.user_id and ${LIVE} and l.document_verified_at is not null) as title_checked
       from ika_profiles p where p.user_id = $1`, [userId]);
    const p = rows[0];
    if (!p) throw notFound("Profil introuvable.");
    if (p.account_status === "RESTRICTED") throw Object.assign(forbidden("Compte restreint : le centre de contrôle est indisponible."), { code: "RESTRICTED" });
    return { ...premiumAccess({ premiumUntil: p.premium_until, agencyVerified: p.agency_verified_at, titleChecked: p.title_checked }), name: p.agency_verified_at && p.agency_name ? p.agency_name : p.full_name, role: p.display_role, status: p.account_status };
  }

  async function series(userId, days, shift) {
    const rows = await db.query(
      `with d as (select generate_series(current_date - ($2::int - 1) - $3::int, current_date - $3::int, interval '1 day')::date as day)
       select d.day::text as day,
         (select count(*)::int from ika_analytics_events e join ika_listings l on l.id = e.listing_id
            where l.owner_id = $1 and e.event_type = 'listing_view' and not e.is_bot and e.occurred_at::date = d.day) as views,
         (select count(*)::int from ika_contact_events c join ika_listings l on l.id = c.listing_id where l.owner_id = $1 and c.created_at::date = d.day)
         + (select count(*)::int from ika_threads t where t.owner_id = $1 and t.created_at::date = d.day)
         + (select count(*)::int from ika_visit_requests v where v.owner_id = $1 and v.created_at::date = d.day) as contacts
       from d order by d.day`, [userId, days, shift]);
    return rows.map((r) => ({ day: r.day, views: r.views, contacts: r.contacts }));
  }

  return {
    access,

    /** Score de l'utilisateur lui-même (même calcul que l'annuaire, même sans annonce en ligne). Null si le compte n'est pas actif. */
    async myScore(userId) {
      const { items } = await this.directory({ onlyId: userId });
      const r = items[0];
      return r ? { score: r.score, parts: r.parts, responseRate: r.responseRate, trust: r.trust, rating: r.rating, memberDays: r.memberDays } : null;
    },

    /** Annuaire public. Boostés d'abord ; ensuite confiance, visibilité, fidélité, réactivité. */
    async directory({ q, kind, limit = 30, offset = 0, onlyId = null } = {}) {
      const rows = await db.query(
        `with cand as (
           select u.id, u.name, p.full_name, p.display_role, p.agency_verified_at, p.agency_name, p.phone_verified_at, p.phone_channel, p.created_at as profile_created,
                  ap.avatar_url, ap.images_hidden,
                  (select count(*)::int from ika_listings l where l.owner_id = u.id and ${LIVE}) as live
           from ika_users u join ika_profiles p on p.user_id = u.id left join ika_advertiser_profiles ap on ap.user_id = u.id
           where u.deleted_at is null and p.account_status = 'ACTIVE' and ($1::text is null or u.id = $1))
         select c.*,
           (select count(*)::int from ika_listings l where l.owner_id = c.id and l.status in ('SOLD', 'RENTED')) as closed,
           (select count(*)::int from ika_listings l where l.owner_id = c.id and ${LIVE} and l.document_verified_at is not null) as title_checked,
           (select max(l.featured_until) from ika_listings l where l.owner_id = c.id and ${LIVE} and l.featured_until > now()) as boosted_until,
           (select l.neighborhood from ika_listings l where l.owner_id = c.id and l.status = 'PUBLISHED' group by l.neighborhood order by count(*) desc, l.neighborhood limit 1) as hood,
           (select count(*)::int from ika_reviews r where r.advertiser_id = c.id and r.status = 'VISIBLE') as review_n,
           (select coalesce(avg(r.rating), 0)::float from ika_reviews r where r.advertiser_id = c.id and r.status = 'VISIBLE') as review_avg,
           (select count(*)::int from ika_reviews r where r.advertiser_id = c.id and r.status = 'VISIBLE' and r.reply_body is not null) as replied,
           (select count(*)::int from ika_threads t where t.owner_id = c.id) as threads,
           (select count(*)::int from ika_threads t where t.owner_id = c.id and exists (select 1 from ika_messages m where m.thread_id = t.id and m.sender_id = c.id)) as answered,
           (select count(*)::int from ika_analytics_events e join ika_listings l on l.id = e.listing_id
              where l.owner_id = c.id and e.event_type = 'listing_view' and not e.is_bot and e.occurred_at > now() - interval '30 days') as views30
         from cand c where ($1::text is not null or c.live > 0) order by c.live desc limit 300`, [onlyId]);
      const now = Date.now();
      const all = rows.map((r) => {
        const average = r.review_n ? Math.round(r.review_avg * 10) / 10 : 0;
        const days = Math.max(0, Math.floor((now - new Date(r.profile_created).getTime()) / 86_400_000));
        const agencyVerified = Boolean(r.agency_verified_at);
        const s = scoreAdvertiser({ average, reviewCount: r.review_n, replied: r.replied, days, live: r.live, closed: r.closed, views30: r.views30, threads: r.threads, answered: r.answered, phoneBySms: r.phone_verified_at && r.phone_channel === "SMS", titleChecked: r.title_checked, agencyVerified });
        return {
          id: r.id, name: agencyVerified && r.agency_name ? r.agency_name : (r.full_name || r.name), role: r.display_role,
          certified: agencyVerified || r.title_checked > 0, agencyVerified,
          photoUrl: r.avatar_url && !r.images_hidden ? r.avatar_url : null, neighborhood: r.hood ?? "",
          listings: r.live, rating: { average, count: r.review_n }, score: s.score, parts: s.parts, responseRate: s.responseRate,
          trust: { level: s.trust.level, label: s.trust.label }, memberDays: days, boosted: Boolean(r.boosted_until),
        };
      });
      if (onlyId) return { total: all.length, items: all };
      const filtered = filterDirectory(all, { q, kind }).sort(compareDirectory);
      const lim = Math.min(60, Math.max(1, Number(limit) || 30)); const off = Math.max(0, Number(offset) || 0);
      return { total: filtered.length, items: filtered.slice(off, off + lim) };
    },

    /** Tableau de bord du centre de contrôle. Refusé sans Premium en cours ET sans certification. */
    async overview(userId, { days = 7 } = {}) {
      const acc = await access(userId);
      if (acc.status !== "ACTIVE") throw forbidden("Compte restreint : le centre de contrôle est indisponible.");
      if (!acc.eligible) throw Object.assign(forbidden(acc.premium ? "Le centre de contrôle est réservé aux annonceurs certifiés (agence vérifiée ou titre foncier contrôlé)." : "Le centre de contrôle est réservé aux annonceurs Premium."), { code: acc.premium ? "NOT_CERTIFIED" : "NOT_PREMIUM" });
      const n = PERIODS.includes(Number(days)) ? Number(days) : 7;
      const [cur, prev, kpi, listings, threads, visits, notifs, reports, expiring, boosts, active, payments, fav] = await Promise.all([
        series(userId, n, 0), series(userId, n, n),
        db.query(
          `select count(*) filter (where l.status = 'PUBLISHED')::int as live, count(*) filter (where l.status = 'PENDING')::int as pending, count(*)::int as total,
                  (select count(*)::int from ika_visit_requests v where v.owner_id = $1) as visits, (select count(*)::int from ika_visit_requests v where v.owner_id = $1 and v.status = 'PENDING') as visits_pending,
                  (select count(*)::int from ika_threads t where t.owner_id = $1 and (t.owner_read_at is null or t.owner_read_at < t.last_message_at)) as unread
           from ika_listings l where l.owner_id = $1 and l.status in ('PUBLISHED', 'PENDING', 'REJECTED', 'EXPIRED')`, [userId]),
        db.query(
          `select l.id, l.title, l.price, l.transaction_type, l.neighborhood, l.image_url, l.status, l.featured_until, l.expires_at,
                  (select count(*)::int from ika_favorites f where f.listing_id = l.id) as favs,
                  (select count(*)::int from ika_contact_events c where c.listing_id = l.id) as contacts,
                  (select count(*)::int from ika_analytics_events e where e.listing_id = l.id and e.event_type = 'listing_view' and not e.is_bot and e.occurred_at > now() - ($2 || ' days')::interval) as views
           from ika_listings l where l.owner_id = $1 and l.status in ('PUBLISHED', 'PENDING', 'REJECTED', 'EXPIRED') order by l.created_at desc limit 6`, [userId, String(n)]),
        db.query(
          `select t.id, t.last_message_at, t.owner_read_at, l.title, coalesce(nullif(pr.full_name, ''), u.name) as visitor,
                  (select m.body from ika_messages m where m.thread_id = t.id order by m.created_at desc limit 1) as last_body,
                  (select m.sender_id from ika_messages m where m.thread_id = t.id order by m.created_at desc limit 1) as last_sender
           from ika_threads t join ika_listings l on l.id = t.listing_id join ika_users u on u.id = t.visitor_id left join ika_profiles pr on pr.user_id = u.id
           where t.owner_id = $1 order by t.last_message_at desc limit 4`, [userId]),
        db.query(
          `select v.id, v.status, v.proposed_at, v.created_at, l.title from ika_visit_requests v join ika_listings l on l.id = v.listing_id
           where v.owner_id = $1 order by v.created_at desc limit 3`, [userId]),
        db.query("select id, kind, title, body, link, read_at, created_at from ika_notifications where user_id = $1 order by created_at desc limit 4", [userId]),
        db.query(
          `select l.id, l.title, r.created_at from ika_reports r join ika_listings l on l.id = r.listing_id
           where l.owner_id = $1 and r.status = 'OPEN' order by r.created_at desc limit 3`, [userId]),
        db.query(
          `select l.id, l.title, l.expires_at from ika_listings l where l.owner_id = $1 and l.status = 'PUBLISHED' and l.expires_at is not null and l.expires_at < now() + interval '30 days'
           order by l.expires_at limit 3`, [userId]),
        db.query("select l.id, l.title, l.featured_until from ika_listings l where l.owner_id = $1 and l.featured_until > now() order by l.featured_until limit 3", [userId]),
        db.query("select exists (select 1 from ika_analytics_events where occurred_at > now() - interval '30 days') as on"),
        db.query("select amount_xof, paid_at from ika_payments where user_id = $1 and status = 'PAID' and paid_at > now() - interval '7 days' order by paid_at desc limit 1", [userId]),
        db.query("select count(*)::int as n from ika_favorites f join ika_listings l on l.id = f.listing_id where l.owner_id = $1 and f.created_at > now() - ($2 || ' days')::interval", [userId, String(n)]),
      ]);
      const sum = (rows, k) => rows.reduce((a, r) => a + r[k], 0);
      const totals = { views: sum(cur, "views"), contacts: sum(cur, "contacts") };
      const before = { views: sum(prev, "views"), contacts: sum(prev, "contacts") };
      const k = kpi[0];
      const alerts = [
        ...reports.map((r) => ({ level: "warn", text: `Votre annonce « ${r.title} » a été signalée par un utilisateur.`, at: iso(r.created_at), link: `#/annonce/${encodeURIComponent(r.id)}` })),
        ...expiring.map((r) => ({ level: "info", text: `« ${r.title} » expire bientôt : prolongez-la pour la garder en ligne.`, at: iso(r.expires_at), link: "#/mes-annonces" })),
        ...payments.map((p) => ({ level: "ok", text: "Votre paiement a été confirmé.", at: iso(p.paid_at), link: "#/paiements" })),
      ];
      const deadlines = [
        { kind: "PREMIUM", label: "Renouvellement Premium", at: acc.premiumUntil, daysLeft: acc.daysLeft },
        ...boosts.map((b) => ({ kind: "BOOST", label: `Mise à la une : ${b.title}`, at: iso(b.featured_until), daysLeft: Math.ceil((new Date(b.featured_until) - Date.now()) / 86_400_000) })),
        ...expiring.map((e) => ({ kind: "EXPIRY", label: `Expiration : ${e.title}`, at: iso(e.expires_at), daysLeft: Math.max(0, Math.ceil((new Date(e.expires_at) - Date.now()) / 86_400_000)) })),
      ];
      return {
        access: { name: acc.name, role: acc.role, premiumUntil: acc.premiumUntil, daysLeft: acc.daysLeft },
        days: n, analyticsActive: Boolean(active[0]?.on),
        kpis: { listings: k.total, live: k.live, pending: k.pending, favorites: fav[0].n, unread: k.unread, visits: k.visits, visitsPending: k.visits_pending },
        stats: { series: cur, views: totals.views, contacts: totals.contacts, viewsChange: pct(totals.views, before.views), contactsChange: pct(totals.contacts, before.contacts) },
        listings: listings.map((l) => ({ id: l.id, title: l.title, price: Number(l.price), transactionType: l.transaction_type, neighborhood: l.neighborhood, imageUrl: l.image_url, status: l.status, boosted: Boolean(l.featured_until && new Date(l.featured_until) > new Date()), views: l.views, favorites: l.favs, contacts: l.contacts })),
        messages: threads.map((t) => ({ id: t.id, from: shortName(t.visitor), listing: t.title, text: snippet(t.last_body), at: iso(t.last_message_at), unread: t.last_sender !== userId && (!t.owner_read_at || new Date(t.owner_read_at) < new Date(t.last_message_at)) })),
        requests: visits.map((v) => ({ id: v.id, title: v.title, status: v.status, proposedAt: iso(v.proposed_at), createdAt: iso(v.created_at) })),
        notifications: notifs.map((x) => ({ id: x.id, kind: x.kind, title: x.title, body: x.body, link: x.link, read: Boolean(x.read_at), createdAt: iso(x.created_at) })),
        alerts, deadlines: deadlines.filter((d) => d.at),
      };
    },

    /**
     * Espace « standard » : mêmes blocs que le centre Premium, mais sans courbes, sans chiffres de vues ni carte.
     * Ouvert à tout annonceur connecté ; ne renvoie que des compteurs simples et le strict nécessaire (4 messages, 4 annonces).
     * Le teaser « contacts reçus » donne un nombre brut sur 7 jours, sans comparaison : la comparaison reste Premium.
     */
    async standardOverview(userId) {
      const acc = await access(userId);
      if (acc.status !== "ACTIVE") throw forbidden("Compte restreint : l'espace annonceur est indisponible.");
      const [kpi, listings, threads, notifs, prof] = await Promise.all([
        db.query(
          `select count(*)::int as total, count(*) filter (where l.status = 'PUBLISHED')::int as live, count(*) filter (where l.status = 'PENDING')::int as pending,
                  (select count(*)::int from ika_favorites f join ika_listings fl on fl.id = f.listing_id where fl.owner_id = $1) as favorites,
                  (select count(*)::int from ika_visit_requests v where v.owner_id = $1) as visits,
                  (select count(*)::int from ika_threads t where t.owner_id = $1 and (t.owner_read_at is null or t.owner_read_at < t.last_message_at)) as unread,
                  (select count(*)::int from ika_contact_events c join ika_listings cl on cl.id = c.listing_id where cl.owner_id = $1 and c.created_at > now() - interval '7 days')
                  + (select count(*)::int from ika_threads t where t.owner_id = $1 and t.created_at > now() - interval '7 days')
                  + (select count(*)::int from ika_visit_requests v where v.owner_id = $1 and v.created_at > now() - interval '7 days') as contacts7
           from ika_listings l where l.owner_id = $1 and l.status in ('PUBLISHED', 'PENDING', 'REJECTED', 'EXPIRED')`, [userId]),
        db.query(
          `select l.id, l.title, l.price, l.transaction_type, l.neighborhood, l.image_url, l.status,
                  (select count(*)::int from ika_contact_events c where c.listing_id = l.id) as contacts
           from ika_listings l where l.owner_id = $1 and l.status in ('PUBLISHED', 'PENDING', 'REJECTED', 'EXPIRED') order by l.created_at desc limit 4`, [userId]),
        db.query(
          `select t.id, t.last_message_at, t.owner_read_at, coalesce(nullif(pr.full_name, ''), u.name) as visitor,
                  (select m.body from ika_messages m where m.thread_id = t.id order by m.created_at desc limit 1) as last_body,
                  (select m.sender_id from ika_messages m where m.thread_id = t.id order by m.created_at desc limit 1) as last_sender
           from ika_threads t join ika_users u on u.id = t.visitor_id left join ika_profiles pr on pr.user_id = u.id
           where t.owner_id = $1 order by t.last_message_at desc limit 3`, [userId]),
        db.query("select id, kind, title, body, link, read_at, created_at from ika_notifications where user_id = $1 order by created_at desc limit 3", [userId]),
        db.query(
          `select p.phone_verified_at, ap.avatar_url, (ap.bio is not null and length(trim(ap.bio)) > 0) as has_bio
           from ika_profiles p left join ika_advertiser_profiles ap on ap.user_id = p.user_id where p.user_id = $1`, [userId]),
      ]);
      const k = kpi[0]; const pr = prof[0] ?? {};
      const steps = [
        { key: "phone", label: "Numéro de téléphone vérifié", done: Boolean(pr.phone_verified_at), href: "#/profil" },
        { key: "photo", label: "Photo de profil", done: Boolean(pr.avatar_url), href: "#/mon-profil-public" },
        { key: "bio", label: "Présentation de votre activité", done: Boolean(pr.has_bio), href: "#/mon-profil-public" },
        { key: "listing", label: "Une annonce en ligne", done: k.live > 0, href: "#/publier" },
        { key: "certified", label: "Profil certifié (agence vérifiée ou titre foncier contrôlé)", done: acc.certified, href: "#/profil" },
      ];
      return {
        access: { name: acc.name, role: acc.role, premium: acc.premium, certified: acc.certified, eligible: acc.eligible },
        kpis: { listings: k.total, live: k.live, pending: k.pending, favorites: k.favorites, unread: k.unread, visits: k.visits },
        contacts7: k.contacts7,
        listings: listings.map((l) => ({ id: l.id, title: l.title, price: Number(l.price), transactionType: l.transaction_type, neighborhood: l.neighborhood, imageUrl: l.image_url, status: l.status, contacts: l.contacts })),
        messages: threads.map((t) => ({ id: t.id, from: shortName(t.visitor), text: snippet(t.last_body), at: iso(t.last_message_at), unread: t.last_sender !== userId && (!t.owner_read_at || new Date(t.owner_read_at) < new Date(t.last_message_at)) })),
        notifications: notifs.map((x) => ({ id: x.id, title: x.title, body: x.body, link: x.link, read: Boolean(x.read_at), createdAt: iso(x.created_at) })),
        profile: { percent: Math.round((steps.filter((s) => s.done).length / steps.length) * 100), steps },
      };
    },

    /** Repères de la carte : chargés seulement quand l'annonceur ouvre la carte (économie de requêtes et de données). */
    async mapPins(userId) {
      const acc = await access(userId);
      if (!acc.eligible) throw forbidden("Réservé aux annonceurs Premium certifiés.");
      const rows = await db.query(
        `select l.id, l.title, l.price, l.transaction_type, l.neighborhood, l.status, l.featured_until, l.image_url,
                coalesce(g.latitude, l.latitude) as lat, coalesce(g.longitude, l.longitude) as lng
         from ika_listings l left join ika_listing_geo g on g.listing_id = l.id
         where l.owner_id = $1 and l.status in ('PUBLISHED', 'PENDING') and coalesce(g.latitude, l.latitude) is not null order by l.created_at desc limit 100`, [userId]);
      return rows.map((r) => ({ id: r.id, title: r.title, price: Number(r.price), transactionType: r.transaction_type, neighborhood: r.neighborhood, status: r.status, imageUrl: r.image_url, featured: Boolean(r.featured_until && new Date(r.featured_until) > new Date()), latitude: Number(r.lat), longitude: Number(r.lng) }));
    },

    /** Octroi d'une période Premium : super administrateur seulement, motif obligatoire, tracé dans la même transaction. */
    async grantPremium(staffId, targetId, { days, reason } = {}) {
      await accounts.requireStaff(staffId, "SUPERADMIN");
      const d = Math.floor(Number(days));
      if (!Number.isFinite(d) || d < 1 || d > 3660) throw badRequest("Durée invalide (1 à 3660 jours).");
      const why = String(reason ?? "").trim().slice(0, 300);
      if (why.length < 3) throw badRequest("Indiquez le motif.");
      const id = String(targetId ?? "").slice(0, 80);
      return db.transaction(async (tx) => {
        const rows = await tx.query(
          "update ika_profiles set premium_until = greatest(coalesce(premium_until, now()), now()) + ($2 || ' days')::interval where user_id = $1 returning premium_until", [id, String(d)]);
        if (!rows[0]) throw notFound("Profil introuvable.");
        await tx.query("insert into ika_premium_grants (id, user_id, granted_by, days, reason) values ($1, $2, $3, $4, $5)", [newId("pg"), id, staffId, d, why]);
        await accounts.audit(staffId, "PREMIUM_GRANT", null, `${id} +${d}j ${why}`, tx);
        return { ok: true, premiumUntil: iso(rows[0].premium_until) };
      });
    },
  };
}
