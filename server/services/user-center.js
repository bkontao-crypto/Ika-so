// Centre « Utilisateurs » de l'Owner Center : annuaire filtrable + analyse d'un compte.
// Toutes les données viennent de tables réelles ; ce qui n'est pas collecté est déclaré comme tel (jamais inventé).
import { badRequest, notFound } from "../lib/errors.js";

const SEG_ACTIVE_DAYS = 7;   // connecté dans les 7 derniers jours
const SEG_STANDBY_DAYS = 30; // 8 à 30 jours : « en veille » ; au-delà : inactif
const SORTS = {
  created: "created_at", login: "last_login_at", logins: "logins_30d", listings: "listings", name: "lower(full_name)",
};
const SEGMENTS = ["active", "standby", "inactive", "never"];
const STATUSES = ["ACTIVE", "RESTRICTED", "BANNED"];

const text = (v, n = 80) => String(v ?? "").trim().slice(0, n);
const day = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")) ? String(v) : null);
const iso = (v) => (v ? new Date(v).toISOString() : null);

export function createUserCenter(ctx, accounts) {
  const { db } = ctx;
  const safe = async (p, fallback) => { try { return await p; } catch { return fallback; } };

  /** Vue de base : une ligne par compte, avec segments calculés. `$n` des filtres est ajouté par l'appelant. */
  const BASE = `
    select p.user_id, u.email, coalesce(nullif(p.full_name, ''), u.name, 'Sans nom') as full_name, p.phone, p.phone_verified_at,
           p.display_role, p.staff_role, p.account_status, p.status_reason, p.status_until, p.created_at, p.last_login_at,
           p.login_count, p.premium_until, p.agency_verified_at,
           (select count(*)::int from ika_listings l where l.owner_id = p.user_id) as listings,
           (select count(*)::int from ika_listings l where l.owner_id = p.user_id and l.status = 'PUBLISHED') as published,
           (select count(*)::int from ika_login_history h where h.user_id = p.user_id and h.created_at > now() - interval '30 days') as logins_30d,
           case when exists (select 1 from ika_advertiser_applications a where a.user_id = p.user_id and a.status = 'APPROVED') then 'confirmed'
                when exists (select 1 from ika_advertiser_applications a where a.user_id = p.user_id and a.status not in ('CANCELLED', 'DRAFT')) then 'unconfirmed'
                else 'none' end as advertiser,
           case when p.last_login_at is null then 'never'
                when p.last_login_at >= now() - interval '${SEG_ACTIVE_DAYS} days' then 'active'
                when p.last_login_at >= now() - interval '${SEG_STANDBY_DAYS} days' then 'standby'
                else 'inactive' end as segment
    from ika_profiles p join ika_users u on u.id = p.user_id where u.deleted_at is null`;

  function filters(params = {}) {
    const where = [];
    const args = [];
    const add = (value) => { args.push(value); return `$${args.length}`; };
    const q = text(params.q, 80).toLowerCase();
    if (q) {
      const n = add(q);
      where.push(`(position(${n} in lower(user_id)) > 0 or position(${n} in lower(email)) > 0 or position(${n} in lower(full_name)) > 0 or position(${n} in lower(coalesce(phone, ''))) > 0)`);
    }
    if (SEGMENTS.includes(params.segment)) where.push(`segment = ${add(params.segment)}`);
    if (STATUSES.includes(params.status)) where.push(`account_status = ${add(params.status)}`);
    if (params.role === "STAFF") where.push("staff_role <> 'USER'");
    else if (["USER", "MODERATOR", "ADMIN", "SUPERADMIN"].includes(params.role)) where.push(`staff_role = ${add(params.role)}`);
    if (["confirmed", "unconfirmed", "none"].includes(params.advertiser)) where.push(`advertiser = ${add(params.advertiser)}`);
    if (params.listings === "with") where.push("listings >= 1");
    else if (params.listings === "without") where.push("listings = 0");
    if (params.premium === "yes") where.push("premium_until > now()");
    else if (params.premium === "no") where.push("(premium_until is null or premium_until <= now())");
    if (params.verified === "yes") where.push("phone_verified_at is not null");
    else if (params.verified === "no") where.push("phone_verified_at is null");
    const field = params.dateField === "login" ? "last_login_at" : "created_at";
    const from = day(params.from);
    const to = day(params.to);
    if (from) where.push(`${field} >= ${add(from)}::date`);
    if (to) where.push(`${field} < (${add(to)}::date + 1)`);
    return { clause: where.length ? `where ${where.join(" and ")}` : "", args };
  }

  function order(params = {}) {
    const col = SORTS[params.sort] ?? SORTS.created;
    const dir = params.dir === "asc" ? "asc" : "desc";
    return `order by ${col} ${dir} ${col === "last_login_at" ? "nulls last" : ""}, user_id asc`;
  }

  const row = (r) => ({
    userId: r.user_id, email: r.email, fullName: r.full_name, phone: r.phone ?? "", phoneVerified: Boolean(r.phone_verified_at),
    displayRole: r.display_role, staffRole: r.staff_role, accountStatus: r.account_status, statusReason: r.status_reason ?? "",
    statusUntil: iso(r.status_until), createdAt: iso(r.created_at), lastLoginAt: iso(r.last_login_at), loginCount: Number(r.login_count ?? 0),
    logins30d: Number(r.logins_30d ?? 0), listings: Number(r.listings ?? 0), published: Number(r.published ?? 0),
    advertiser: r.advertiser, segment: r.segment, premium: Boolean(r.premium_until && new Date(r.premium_until) > new Date()),
  });

  return {
    async directory(actorId, params = {}) {
      await accounts.requireStaff(actorId, "ADMIN");
      const { clause, args } = filters(params);
      const pageSize = Math.min(Math.max(Number(params.pageSize) || 25, 5), 100);
      const page = Math.max(Number(params.page) || 1, 1);
      const [count, items] = await Promise.all([
        db.query(`select count(*)::int as n from (${BASE}) t ${clause}`, args),
        db.query(`select * from (${BASE}) t ${clause} ${order(params)} limit ${pageSize} offset ${(page - 1) * pageSize}`, args),
      ]);
      const total = Number(count[0]?.n ?? 0);
      return { total, page, pageSize, pages: Math.max(Math.ceil(total / pageSize), 1), items: items.map(row) };
    },

    /** Agrégats sur l'ensemble des comptes (indépendants des filtres). */
    async aggregates(actorId) {
      await accounts.requireStaff(actorId, "ADMIN");
      const a = (await db.query(
        `select count(*)::int as total,
                count(*) filter (where segment = 'active')::int as active, count(*) filter (where segment = 'standby')::int as standby,
                count(*) filter (where segment = 'inactive')::int as inactive, count(*) filter (where segment = 'never')::int as never,
                count(*) filter (where created_at >= now() - interval '7 days')::int as new7d,
                count(*) filter (where created_at >= now() - interval '30 days')::int as new30d,
                count(*) filter (where account_status = 'RESTRICTED')::int as restricted, count(*) filter (where account_status = 'BANNED')::int as banned,
                count(*) filter (where advertiser = 'confirmed')::int as advertisers_confirmed,
                count(*) filter (where advertiser = 'unconfirmed')::int as advertisers_unconfirmed,
                count(*) filter (where listings >= 1)::int as with_listing,
                count(*) filter (where premium_until > now())::int as premium,
                count(*) filter (where phone_verified_at is not null)::int as verified,
                count(*) filter (where staff_role <> 'USER')::int as staff,
                count(*) filter (where logins_30d >= 12)::int as freq_high,
                count(*) filter (where logins_30d between 4 and 11)::int as freq_mid,
                count(*) filter (where logins_30d between 1 and 3)::int as freq_low,
                coalesce(round(avg(logins_30d) filter (where logins_30d > 0)::numeric, 1), 0)::float as avg_logins_30d
         from (${BASE}) t`))[0] ?? {};
      const act = (await safe(db.query(
        `select count(distinct user_id) filter (where created_at > now() - interval '1 day')::int as dau,
                count(distinct user_id) filter (where created_at > now() - interval '7 days')::int as wau,
                count(distinct user_id) filter (where created_at > now() - interval '30 days')::int as mau,
                min(created_at) as since
         from ika_login_history`), []))[0] ?? {};
      const dau = Number(act.dau ?? 0);
      const mau = Number(act.mau ?? 0);
      return {
        total: a.total ?? 0, segments: { active: a.active ?? 0, standby: a.standby ?? 0, inactive: a.inactive ?? 0, never: a.never ?? 0 },
        newUsers: { d7: a.new7d ?? 0, d30: a.new30d ?? 0 },
        sanctions: { restricted: a.restricted ?? 0, banned: a.banned ?? 0 },
        advertisers: { confirmed: a.advertisers_confirmed ?? 0, unconfirmed: a.advertisers_unconfirmed ?? 0, withListing: a.with_listing ?? 0 },
        premium: a.premium ?? 0, verified: a.verified ?? 0, staff: a.staff ?? 0,
        frequency: { high: a.freq_high ?? 0, mid: a.freq_mid ?? 0, low: a.freq_low ?? 0, avgLogins30d: a.avg_logins_30d ?? 0 },
        usage: { dau, wau: Number(act.wau ?? 0), mau, stickiness: mau ? Math.round((dau / mau) * 1000) / 10 : null, historySince: iso(act.since) },
        definitions: { active: `connecté depuis moins de ${SEG_ACTIVE_DAYS} jours`, standby: `dernière connexion il y a ${SEG_ACTIVE_DAYS + 1} à ${SEG_STANDBY_DAYS} jours`, inactive: `dernière connexion il y a plus de ${SEG_STANDBY_DAYS} jours`, never: "aucune connexion enregistrée" },
      };
    },

    async exportCsv(actorId, params = {}) {
      await accounts.requireStaff(actorId, "ADMIN");
      const { clause, args } = filters(params);
      const rows = (await db.query(`select * from (${BASE}) t ${clause} ${order(params)} limit 5000`, args)).map(row);
      await accounts.audit(actorId, "OWNER_USERS_EXPORT", null, `${rows.length} compte(s)`);
      const cell = (v) => { const s = String(v ?? ""); const safeText = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; return `"${safeText.replace(/"/g, '""')}"`; };
      const head = ["Identifiant", "Nom", "E-mail", "Téléphone", "Rôle", "Statut", "Segment", "Inscrit le", "Dernière connexion", "Connexions 30 j", "Annonces", "Annonceur", "Premium"];
      const lines = rows.map((r) => [r.userId, r.fullName, r.email, r.phone, r.staffRole, r.accountStatus, r.segment, r.createdAt, r.lastLoginAt ?? "", r.logins30d, r.listings, r.advertiser, r.premium ? "oui" : "non"].map(cell).join(","));
      return `﻿${head.map(cell).join(",")}\n${lines.join("\n")}\n`;
    },

    /** Centre d'analyse d'un compte. */
    async analysis(actorId, targetId) {
      await accounts.requireStaff(actorId, "ADMIN");
      const id = text(targetId, 80);
      if (!id) throw badRequest("Identifiant manquant.");
      const base = (await db.query(`select * from (${BASE}) t where user_id = $1`, [id]))[0];
      if (!base) throw notFound("Compte introuvable.");
      const user = row(base);
      const [auth, loginDays, loginRecent, loginMethods, listingRows, received, receivedDays, made, profileClicks, engagement, analytics, sanctionLog, audits] = await Promise.all([
        safe(db.query("select has_password, (google_sub is not null) as google from ika_users where id = $1", [id]), [{}]),
        safe(db.query(`select to_char(d::date, 'YYYY-MM-DD') as day, coalesce(c.n, 0)::int as n
                       from generate_series(current_date - 29, current_date, '1 day') d
                       left join (select created_at::date as day, count(*) as n from ika_login_history where user_id = $1 and created_at >= current_date - 29 group by 1) c on c.day = d::date
                       order by d`, [id]), []),
        safe(db.query("select method, created_at from ika_login_history where user_id = $1 order by created_at desc limit 15", [id]), []),
        safe(db.query("select method, count(*)::int as n from ika_login_history where user_id = $1 group by method order by n desc", [id]), []),
        safe(db.query(
          `select l.id, l.title, l.status, l.visibility, l.created_at, l.price,
                  (select count(*)::int from ika_contact_events e where e.listing_id = l.id and e.kind = 'CALL') as calls,
                  (select count(*)::int from ika_contact_events e where e.listing_id = l.id and e.kind = 'WHATSAPP') as whatsapp,
                  (select count(*)::int from ika_favorites f where f.listing_id = l.id) as favorites,
                  (select count(*)::int from ika_reports r where r.listing_id = l.id) as reports
           from ika_listings l where l.owner_id = $1 order by l.created_at desc limit 25`, [id]), []),
        safe(db.query(
          `select count(*) filter (where e.kind = 'CALL')::int as calls, count(*) filter (where e.kind = 'WHATSAPP')::int as whatsapp,
                  count(*) filter (where e.kind = 'CALL' and e.created_at > now() - interval '7 days')::int as calls7,
                  count(*) filter (where e.kind = 'WHATSAPP' and e.created_at > now() - interval '7 days')::int as whatsapp7,
                  count(*) filter (where e.kind = 'CALL' and e.created_at > now() - interval '30 days')::int as calls30,
                  count(*) filter (where e.kind = 'WHATSAPP' and e.created_at > now() - interval '30 days')::int as whatsapp30
           from ika_contact_events e join ika_listings l on l.id = e.listing_id where l.owner_id = $1`, [id]), [{}]),
        safe(db.query(
          `select to_char(d::date, 'YYYY-MM-DD') as day, coalesce(c.calls, 0)::int as calls, coalesce(c.wa, 0)::int as whatsapp
           from generate_series(current_date - 29, current_date, '1 day') d
           left join (select e.created_at::date as day, count(*) filter (where e.kind = 'CALL') as calls, count(*) filter (where e.kind = 'WHATSAPP') as wa
                      from ika_contact_events e join ika_listings l on l.id = e.listing_id
                      where l.owner_id = $1 and e.created_at >= current_date - 29 group by 1) c on c.day = d::date order by d`, [id]), []),
        safe(db.query("select count(*) filter (where kind = 'CALL')::int as calls, count(*) filter (where kind = 'WHATSAPP')::int as whatsapp from ika_contact_events where user_id = $1", [id]), [{}]),
        safe(db.query("select count(*) filter (where kind = 'CALL')::int as calls, count(*) filter (where kind = 'WHATSAPP')::int as whatsapp from ika_profile_contact_events where advertiser_id = $1", [id]), [{}]),
        safe(db.query(
          `select (select count(*)::int from ika_favorites where user_id = $1) as favorites,
                  (select count(*)::int from ika_threads where owner_id = $1 or visitor_id = $1) as threads,
                  (select count(*)::int from ika_visit_requests where requester_id = $1 or owner_id = $1) as visits,
                  (select count(*)::int from ika_reviews where advertiser_id = $1 and status = 'VISIBLE') as reviews_received,
                  (select count(*)::int from ika_reports r join ika_listings l on l.id = r.listing_id where l.owner_id = $1) as reports_on_listings,
                  (select count(*)::int from ika_reports where reporter_id = $1) as reports_made,
                  (select count(*)::int from ika_user_reports where reported_id = $1) as user_reports_against,
                  (select count(*)::int from ika_payments where user_id = $1 and status = 'PAID') as payments,
                  (select coalesce(sum(amount_xof), 0)::bigint from ika_payments where user_id = $1 and status = 'PAID') as paid_xof`, [id]), [{}]),
        safe(db.query(
          `select event_type, count(*)::int as n, max(occurred_at) as last_at from ika_analytics_events
           where user_id = $1 and occurred_at > now() - interval '30 days' group by event_type order by n desc`, [id]), []),
        safe(db.query(
          `select action, note, actor_id, created_at from ika_audit
           where action in ('SANCTION', 'SANCTION_EXPIRED') and note like $2 order by created_at desc limit 20`, [id, `% ${id} %`]), []),
        safe(db.query(
          `select * from ((select created_at as at, 'Équipe' as source, action, note as detail, actor_id from ika_audit where actor_id = $1 or note like $2)
           union all
           (select created_at, 'Modération', action, coalesce(details::text, ''), actor_id from ika_moderation_audit where target_id = $1 or actor_id = $1)
           union all
           (select occurred_at, 'Administration', action, coalesce(nullif(reason, ''), object_type), actor_id from ika_admin_audit where subject_user_id = $1 or actor_id = $1)
           ) x order by at desc limit 40`, [id, `% ${id} %`]), []),
      ]);
      const en = engagement[0] ?? {};
      const rc = received[0] ?? {};
      const analyticsTotal = analytics.reduce((n, r) => n + Number(r.n), 0);
      const analyticsOn = Boolean(ctx.config?.analytics?.enabled);

      const signals = [];
      const flag = (level, label) => signals.push({ level, label });
      if (user.accountStatus === "BANNED") flag("high", user.statusUntil ? `Compte bloqué jusqu'au ${user.statusUntil.slice(0, 10)}` : "Compte bloqué sans date de fin");
      if (user.accountStatus === "RESTRICTED") flag("medium", user.statusUntil ? `Compte restreint jusqu'au ${user.statusUntil.slice(0, 10)}` : "Compte restreint");
      if (sanctionLog.filter((s) => s.action === "SANCTION").length >= 2) flag("medium", "Plusieurs sanctions dans l'historique");
      if (Number(en.reports_on_listings ?? 0) >= 3) flag("high", `${en.reports_on_listings} signalements sur ses annonces`);
      else if (Number(en.reports_on_listings ?? 0) >= 1) flag("low", `${en.reports_on_listings} signalement(s) sur ses annonces`);
      if (Number(en.user_reports_against ?? 0) >= 1) flag("medium", `${en.user_reports_against} signalement(s) de conversation contre ce compte`);
      if (user.listings > 0 && user.advertiser !== "confirmed" && user.staffRole === "USER") flag("low", "Annonces déposées sans statut d'annonceur confirmé");
      if (!user.phoneVerified && user.listings > 0) flag("low", "Numéro de téléphone non vérifié");
      if (user.segment === "never") flag("low", "Aucune connexion enregistrée");

      return {
        user,
        auth: { hasPassword: auth[0]?.has_password !== false, google: Boolean(auth[0]?.google) },
        logins: { total: user.loginCount, last30: loginDays.reduce((n, d) => n + d.n, 0), days: loginDays, recent: loginRecent.map((r) => ({ method: r.method, at: iso(r.created_at) })), methods: loginMethods },
        listings: listingRows.map((l) => ({ id: l.id, title: l.title, status: l.status, visibility: l.visibility, createdAt: iso(l.created_at), price: Number(l.price ?? 0), calls: l.calls, whatsapp: l.whatsapp, favorites: l.favorites, reports: l.reports })),
        contactsReceived: { calls: rc.calls ?? 0, whatsapp: rc.whatsapp ?? 0, calls7: rc.calls7 ?? 0, whatsapp7: rc.whatsapp7 ?? 0, calls30: rc.calls30 ?? 0, whatsapp30: rc.whatsapp30 ?? 0, profileCalls: profileClicks[0]?.calls ?? 0, profileWhatsapp: profileClicks[0]?.whatsapp ?? 0, days: receivedDays },
        contactsMade: { calls: made[0]?.calls ?? 0, whatsapp: made[0]?.whatsapp ?? 0 },
        engagement: { favorites: en.favorites ?? 0, threads: en.threads ?? 0, visits: en.visits ?? 0, reviewsReceived: en.reviews_received ?? 0, reportsOnListings: en.reports_on_listings ?? 0, reportsMade: en.reports_made ?? 0, userReportsAgainst: en.user_reports_against ?? 0, payments: en.payments ?? 0, paidXof: Number(en.paid_xof ?? 0) },
        analytics: {
          collecting: analyticsOn, eventsLast30d: analyticsTotal, byType: analytics.map((r) => ({ type: r.event_type, n: r.n, lastAt: iso(r.last_at) })),
          notCollected: ["Durée de visionnage d'une annonce", "Pages vues par compte", ...(analyticsOn ? [] : ["Événements d'usage (collecte désactivée, consentement requis)"])],
        },
        sanctions: { current: user.accountStatus === "ACTIVE" ? null : { status: user.accountStatus, reason: user.statusReason, until: user.statusUntil }, history: sanctionLog.map((s) => ({ action: s.action, note: s.note, actorId: s.actor_id, at: iso(s.created_at) })) },
        signals,
        audits: audits.map((a) => ({ at: iso(a.at), source: a.source, action: a.action, detail: String(a.detail ?? "").slice(0, 300), actorId: a.actor_id })),
      };
    },
  };
}
