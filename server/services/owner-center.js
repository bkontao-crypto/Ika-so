/**
 * Owner Control Center v2 : tableau de bord réel, journal unifié des mouvements du site, traçage d'un compte ou d'une annonce,
 * export CSV et journal de connexions. Toutes les fonctions sont réservées au SUPERADMIN (contrôle refait ici, jamais côté navigateur).
 * Aucune donnée n'est inventée : un indicateur indisponible vaut null et l'interface affiche « — ».
 */
import { badRequest, notFound } from "../lib/errors.js";
import { newId } from "../lib/security.js";
import { classifyDevice } from "../lib/analytics-events.js";
import { CATEGORIES, CATEGORY_KEYS, DEFAULT_CATEGORIES, SOURCES, SOURCE_KEYS, buildSourceQuery, eventsToCsv, mergeEvents, selectSources, shapeEvent } from "../lib/activity-feed.js";

const SECURITY_EVENTS = Object.freeze(["REGISTER", "LOGIN", "LOGIN_FAILED", "LOGOUT"]);
const CURSOR_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/;
const EPOCH = "2000-01-01T00:00:00.000Z";
const DAY_MS = 86_400_000;
const TABLES = [...new Set(SOURCES.flatMap((s) => s.from.match(/\bika_[a-z_]+/g)))];

const text = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
const clamp = (n, lo, hi, fallback) => { const x = Number(n); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, Math.trunc(x))) : fallback; };
const list = (v, allowed) => (Array.isArray(v) ? v : String(v ?? "").split(",")).map((x) => String(x).trim()).filter((x) => allowed.includes(x));
const pct = (cur, prev) => (prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null);
const dayKey = (d) => d.toISOString().slice(0, 10);

function parseDate(value, name) {
  if (value == null || value === "") return null;
  const t = Date.parse(String(value));
  if (!Number.isFinite(t)) throw badRequest(`Date « ${name} » invalide.`);
  return new Date(t);
}

export function createOwnerCenter({ db, accounts, logger = null, clock = () => new Date() }) {
  let availCache = null;
  let secCache = null;

  const guard = (userId) => accounts.requireStaff(userId, "SUPERADMIN");
  const safe = async (promise, fallback = null) => { try { return await promise; } catch (error) { logger?.warn?.("owner_center_lecture", { message: String(error?.message ?? error).slice(0, 200) }); return fallback; } };

  /** Sources dont toutes les tables existent (migration appliquée). Mémorisé 60 s. */
  async function availability() {
    const now = clock().getTime();
    if (availCache && now - availCache.at < 60_000) return availCache.value;
    const rows = await db.query("select n as name, to_regclass(n) is not null as ok from unnest($1::text[]) as n", [TABLES]);
    const ok = new Set(rows.filter((r) => r.ok).map((r) => r.name));
    const usable = []; const unavailable = [];
    for (const s of SOURCES) {
      const missing = [...new Set(s.from.match(/\bika_[a-z_]+/g))].filter((t) => !ok.has(t));
      if (missing.length) unavailable.push({ key: s.key, label: s.label, missing }); else usable.push(s.key);
    }
    availCache = { at: now, value: { usable: new Set(usable), unavailable } };
    return availCache.value;
  }

  /** Fond commun du journal : une requête par source, fusion exacte, pagination par curseur à la microseconde. */
  async function readFeed(params = {}, { maxLimit = 200 } = {}) {
    const limit = clamp(params.limit, 1, maxLimit, 50);
    const from = parseDate(params.from, "from");
    const to = parseDate(params.to, "to");
    let upper = new Date(clock().getTime() + 60_000).toISOString();
    if (to) upper = to.toISOString();
    if (params.before) {
      const b = text(params.before, 40);
      if (!CURSOR_RE.test(b)) throw badRequest("Curseur invalide.");
      if (!to || Date.parse(b) <= to.getTime()) upper = b;
    }
    const filters = { actor: text(params.actor, 80) || null, q: text(params.q, 80) || null, listingId: text(params.listingId, 80) || null, userId: text(params.userId, 80) || null };
    const { usable, unavailable } = await availability();
    const chosen = selectSources({ sources: list(params.sources, SOURCE_KEYS), categories: list(params.categories, CATEGORY_KEYS) }).filter((s) => usable.has(s.key));
    const failed = [];
    const batches = await Promise.all(chosen.map(async (source) => {
      const query = buildSourceQuery(source, filters, { from: from ? from.toISOString() : EPOCH, before: upper, limit });
      if (!query) return [];
      try { return (await db.query(query.sql, query.params)).map((row) => shapeEvent(row, source)); } catch (error) {
        failed.push(source.key);
        logger?.warn?.("owner_journal_source", { source: source.key, message: String(error?.message ?? error).slice(0, 200) });
        return [];
      }
    }));
    const events = mergeEvents(batches, limit);
    return { events, nextCursor: events.length === limit ? events[events.length - 1].cursor : null, unavailable: unavailable.map((u) => ({ key: u.key, label: u.label })), failed };
  }

  function unionSql(sources) {
    return sources.map((s) => `select '${s.key}' as k, '${s.cat}' as c, ${s.time} as t, ${s.actor ?? "null::text"} as a, ${s.actorName ?? "null::text"} as an from ${s.from} where ${s.base} and ${s.time} >= $1::timestamptz and ${s.time} < $2::timestamptz`).join(" union all ");
  }

  function dayList(days) {
    const today = new Date(`${dayKey(clock())}T00:00:00Z`).getTime();
    return Array.from({ length: days }, (_, i) => dayKey(new Date(today - (days - 1 - i) * DAY_MS)));
  }
  const fillDays = (days, rows) => { const m = new Map((rows ?? []).map((r) => [r.d, Number(r.n)])); return days.map((d) => m.get(d) ?? 0); };

  return {
    /** Journal des mouvements (lecture). */
    async feed(userId, params = {}) {
      await guard(userId);
      return readFeed(params);
    },

    async catalog(userId) {
      await guard(userId);
      const { usable, unavailable } = await availability();
      return {
        categories: CATEGORIES, defaultCategories: DEFAULT_CATEGORIES,
        sources: SOURCES.map((s) => ({ key: s.key, category: s.cat, label: s.label, available: usable.has(s.key) })), unavailable,
      };
    },

    /** Volumes par jour, catégorie, source, heure et compte, sur la période (max 90 jours). */
    async summary(userId, { days = 7 } = {}) {
      await guard(userId);
      const n = clamp(days, 1, 90, 7);
      const { usable } = await availability();
      const sources = SOURCES.filter((s) => usable.has(s.key));
      if (!sources.length) return { days: n, perDay: [], bySource: {}, byCategory: {}, byHour: Array(24).fill(0), topActors: [], totals: { movements: 0, traffic: 0, actors: 0 }, peakHour: null };
      const upper = new Date(clock().getTime() + 60_000).toISOString();
      const from = new Date(new Date(`${dayKey(clock())}T00:00:00Z`).getTime() - (n - 1) * DAY_MS).toISOString();
      const u = unionSql(sources);
      const p = [from, upper];
      const [perDayRows, hourRows, actorRows, distinctRows] = await Promise.all([
        db.query(`select k, c, to_char(t at time zone 'UTC', 'YYYY-MM-DD') as d, count(*)::int as n from (${u}) x group by 1, 2, 3`, p),
        db.query(`select extract(hour from t at time zone 'UTC')::int as h, count(*)::int as n from (${u}) x where c <> 'traffic' group by 1`, p),
        db.query(`select a, max(an) as an, count(*)::int as n from (${u}) x where a is not null and c not in ('traffic', 'security') group by a order by n desc limit 8`, p),
        db.query(`select count(distinct a)::int as n from (${u}) x where a is not null and c <> 'traffic'`, p),
      ]);
      const keys = dayList(n);
      const perDay = keys.map((d) => ({ day: d, total: 0, byCategory: {} }));
      const idx = new Map(perDay.map((x) => [x.day, x]));
      const bySource = {}; const byCategory = {};
      for (const r of perDayRows) {
        bySource[r.k] = (bySource[r.k] ?? 0) + r.n;
        byCategory[r.c] = (byCategory[r.c] ?? 0) + r.n;
        const day = idx.get(r.d);
        if (!day) continue;
        day.byCategory[r.c] = (day.byCategory[r.c] ?? 0) + r.n;
        if (r.c !== "traffic") day.total += r.n;
      }
      const byHour = Array(24).fill(0);
      for (const r of hourRows) byHour[r.h] = r.n;
      const max = Math.max(...byHour);
      const traffic = byCategory.traffic ?? 0;
      return {
        days: n, from, perDay, bySource, byCategory, byHour, peakHour: max > 0 ? byHour.indexOf(max) : null,
        topActors: actorRows.map((r) => ({ id: r.a, name: r.an || null, count: r.n })),
        totals: { movements: Object.entries(byCategory).reduce((a, [c, v]) => a + (c === "traffic" ? 0 : v), 0), traffic, actors: distinctRows[0]?.n ?? 0 },
      };
    },

    /** Dossier complet d'un compte ou d'une annonce : fiche + tous ses mouvements. La consultation est elle-même inscrite au journal d'audit. */
    async trace(userId, { type, id, before, limit } = {}) {
      await guard(userId);
      const kind = text(type, 10);
      const target = text(id, 80);
      if (!["listing", "user"].includes(kind) || !target) throw badRequest("Indiquez un type (listing ou user) et un identifiant.");
      let entity;
      if (kind === "listing") {
        const rows = await db.query(
          `select l.id, l.title, l.status, l.category, l.transaction_type, l.neighborhood, l.price, l.owner_id, l.created_at, l.published_at, l.featured_until, pr.full_name as owner_name
           from ika_listings l left join ika_profiles pr on pr.user_id = l.owner_id where l.id = $1`, [target]);
        if (!rows[0]) throw notFound("Annonce introuvable.");
        const r = rows[0];
        const counts = await safe(db.query(
          `select (select count(*)::int from ika_favorites where listing_id = $1) as favorites,
                  (select count(*)::int from ika_contact_events where listing_id = $1) as contacts,
                  (select count(*)::int from ika_reports where listing_id = $1) as reports,
                  (select count(*)::int from ika_payments where listing_id = $1) as payments`, [target]), [{}]);
        entity = {
          type: "listing", id: r.id, title: r.title, status: r.status, owner: { id: r.owner_id, name: r.owner_name || null },
          facts: [["Catégorie", r.category], ["Transaction", r.transaction_type], ["Quartier", r.neighborhood], ["Prix (FCFA)", Number(r.price)], ["Déposée le", r.created_at?.toISOString?.() ?? null], ["Publiée le", r.published_at?.toISOString?.() ?? null]],
          counters: { favorites: counts[0]?.favorites ?? null, contacts: counts[0]?.contacts ?? null, reports: counts[0]?.reports ?? null, payments: counts[0]?.payments ?? null },
        };
      } else {
        const rows = await db.query(
          `select p.user_id, p.full_name, p.display_role, p.staff_role, p.account_status, p.status_reason, p.created_at, p.phone_verified_at
           from ika_profiles p where p.user_id = $1`, [target]);
        if (!rows[0]) throw notFound("Compte introuvable.");
        const r = rows[0];
        const counts = await safe(db.query(
          `select (select count(*)::int from ika_listings where owner_id = $1) as listings,
                  (select count(*)::int from ika_listings where owner_id = $1 and status = 'PUBLISHED') as published,
                  (select count(*)::int from ika_payments where user_id = $1) as payments,
                  (select count(*)::int from ika_favorites where user_id = $1) as favorites`, [target]), [{}]);
        const lastLogin = await safe(db.query("select max(occurred_at) as at from ika_security_log where user_id = $1 and event = 'LOGIN'", [target]), [{}]);
        entity = {
          type: "user", id: r.user_id, title: r.full_name || "Sans nom", status: r.account_status, role: r.staff_role, statusReason: r.status_reason || null,
          facts: [["Rôle affiché", r.display_role], ["Rôle équipe", r.staff_role], ["Inscrit le", r.created_at?.toISOString?.() ?? null], ["Numéro vérifié", r.phone_verified_at ? "oui" : "non"], ["Dernière connexion enregistrée", lastLogin[0]?.at?.toISOString?.() ?? null]],
          counters: { listings: counts[0]?.listings ?? null, published: counts[0]?.published ?? null, payments: counts[0]?.payments ?? null, favorites: counts[0]?.favorites ?? null },
        };
      }
      await accounts.audit(userId, "OWNER_TRACE", kind === "listing" ? target : null, `${kind} ${target}`);
      const feed = await readFeed({ categories: CATEGORY_KEYS, [kind === "listing" ? "listingId" : "userId"]: target, before, limit: limit ?? 100 });
      return { entity, ...feed };
    },

    /** Export CSV des mouvements filtrés (5 000 lignes au plus). L'export est inscrit au journal d'audit. */
    async exportCsv(userId, params = {}) {
      await guard(userId);
      const feed = await readFeed({ ...params, limit: 5000 }, { maxLimit: 5000 });
      await accounts.audit(userId, "OWNER_ACTIVITY_EXPORT", null, `${feed.events.length} ligne(s) ; catégories ${text(params.categories, 120) || "par défaut"}`);
      return eventsToCsv(feed.events);
    },

    /** Tableau de bord de la maquette : tout vient de la base ; un bloc illisible vaut null et n'empêche pas le reste. */
    async dashboard(userId, { days = 30 } = {}) {
      await guard(userId);
      const n = clamp(days, 7, 90, 30);
      const keys = dayList(n);
      const fromDay = `${keys[0]}T00:00:00Z`;
      const t0 = Date.now();
      const main = await safe(db.query(
        `select
          (select count(*)::int from ika_listings where status = 'PUBLISHED') as listings_published,
          (select count(*)::int from ika_listings where published_at >= now() - make_interval(days => $1::int)) as listings_new,
          (select count(*)::int from ika_listings where published_at >= now() - make_interval(days => $1::int * 2) and published_at < now() - make_interval(days => $1::int)) as listings_prev,
          (select count(*)::int from ika_listings where status = 'PENDING') as listings_pending,
          (select count(*)::int from ika_profiles where account_status = 'ACTIVE') as users_active,
          (select count(*)::int from ika_profiles where created_at >= now() - make_interval(days => $1::int)) as users_new,
          (select count(*)::int from ika_profiles where created_at >= now() - make_interval(days => $1::int * 2) and created_at < now() - make_interval(days => $1::int)) as users_prev,
          (select count(*)::int from ika_contact_events where created_at >= now() - interval '7 days') as contacts_7,
          (select count(*)::int from ika_contact_events where created_at >= now() - interval '14 days' and created_at < now() - interval '7 days') as contacts_prev_7,
          (select count(*)::int from ika_payments where status = 'PENDING') as pay_pending,
          (select count(*)::int from ika_payments where status = 'PENDING' and created_at < now() - interval '24 hours') as pay_stale,
          (select count(*)::int from ika_reports where status in ('OPEN', 'IN_PROGRESS')) as complaints_open,
          (select count(*)::int from ika_reports where status in ('OPEN', 'IN_PROGRESS') and created_at < now() - interval '72 hours') as complaints_priority`, [n]), null);
      const dbMs = Date.now() - t0;
      const m = main?.[0] ?? null;
      const byDay = (table, col) => safe(db.query(`select to_char(${col} at time zone 'UTC', 'YYYY-MM-DD') as d, count(*)::int as n from ${table} where ${col} >= $1::timestamptz group by 1`, [fromDay]), []);
      const [sListings, sContacts, sSignups, sVisits, proofs, alerts, incidents, backup, operations] = await Promise.all([
        byDay("ika_listings", "created_at"), byDay("ika_contact_events", "created_at"), byDay("ika_profiles", "created_at"), byDay("ika_visit_requests", "created_at"),
        safe(db.query("select count(*)::int as n from ika_proofs where status = 'PENDING'"), null),
        safe(db.query("select count(*)::int as n from ika_alerts where status = 'OPEN'"), null),
        safe(db.query("select count(*)::int as n, count(*) filter (where severity = 'CRITICAL')::int as critical from ika_incidents where resolved = false"), null),
        safe(db.query("select status, created_at, verified_at, error, (select max(created_at) from ika_backup_log where status = 'OK') as last_ok from ika_backup_log order by created_at desc limit 1"), null),
        safe(readFeed({ categories: ["admin", "system", "growth", "finance"], limit: 8 }), { events: [] }),
      ]);
      const mem = process.memoryUsage();
      const health = [];
      health.push({ key: "database", label: "Base de données PostgreSQL", tone: m ? "ok" : "bad", text: m ? "Connectée" : "Injoignable", detail: m ? `${dbMs} ms` : null });
      health.push({ key: "api", label: "API & serveur Node.js", tone: "ok", text: "En ligne", detail: process.version });
      health.push({ key: "payments", label: "Service de paiement", tone: !m ? "neutral" : m.pay_stale > 0 ? "warn" : "ok", text: !m ? "—" : m.pay_stale > 0 ? "À surveiller" : "Normal", detail: m ? (m.pay_stale > 0 ? `${m.pay_stale} en attente depuis plus de 24 h` : `${m.pay_pending} en attente`) : null });
      const b = backup?.[0];
      const lastOkAge = b?.last_ok ? (clock().getTime() - new Date(b.last_ok).getTime()) / 3_600_000 : null;
      health.push(!backup ? { key: "backup", label: "Dernière sauvegarde", tone: "neutral", text: "—", detail: null }
        : !b ? { key: "backup", label: "Dernière sauvegarde", tone: "warn", text: "Aucune", detail: "Aucune sauvegarde enregistrée" }
        : b.status === "FAILED" ? { key: "backup", label: "Dernière sauvegarde", tone: "bad", text: "En échec", detail: b.error ? String(b.error).slice(0, 120) : null }
        : lastOkAge != null && lastOkAge <= 36 ? { key: "backup", label: "Dernière sauvegarde", tone: "ok", text: "Vérifiée", detail: `il y a ${Math.max(1, Math.round(lastOkAge))} h` }
        : { key: "backup", label: "Dernière sauvegarde", tone: "warn", text: lastOkAge == null ? "Non vérifiée" : "Ancienne", detail: lastOkAge == null ? "Aucun fichier vérifié" : `il y a ${Math.round(lastOkAge / 24)} j` });
      const inc = incidents?.[0];
      health.push({ key: "incidents", label: "Incidents non résolus", tone: !incidents ? "neutral" : inc.critical > 0 ? "bad" : inc.n > 0 ? "warn" : "ok", text: !incidents ? "—" : inc.n > 0 ? `${inc.n} ouvert${inc.n > 1 ? "s" : ""}` : "Aucun", detail: null });
      health.push({ key: "uptime", label: "En ligne depuis", tone: "neutral", text: process.uptime() >= 86_400 ? `${Math.floor(process.uptime() / 86_400)} j ${Math.floor((process.uptime() % 86_400) / 3600)} h` : `${Math.floor(process.uptime() / 3600)} h ${Math.floor((process.uptime() % 3600) / 60)} min`, detail: "depuis le dernier démarrage du serveur" });
      const worst = health.some((x) => x.tone === "bad") ? "bad" : health.some((x) => x.tone === "warn") ? "warn" : "ok";

      const plural = (c, one, many) => `${c} ${c > 1 ? many : one}`;
      const alertsList = [];
      if (m?.complaints_priority > 0) alertsList.push({ tone: "bad", icon: "flag", module: "complaints", title: plural(m.complaints_priority, "réclamation prioritaire", "réclamations prioritaires"), text: "ouverte depuis plus de 72 h, sans résolution.", where: "Signalements & réclamations" });
      if (incidents?.[0]?.critical > 0) alertsList.push({ tone: "bad", icon: "activity", module: "monitoring", title: plural(incidents[0].critical, "incident critique", "incidents critiques"), text: "à traiter en priorité.", where: "Surveillance & incidents" });
      if (b?.status === "FAILED") alertsList.push({ tone: "bad", icon: "database", module: "backups", title: "Dernière sauvegarde en échec", text: "relancez-la et contrôlez l'espace disque.", where: "Sauvegardes & restaurations" });
      if (m?.pay_pending > 0) alertsList.push({ tone: "warn", icon: "wallet", module: "payments", title: plural(m.pay_pending, "paiement", "paiements"), text: `en attente de confirmation${m.pay_stale ? ` dont ${m.pay_stale} depuis plus de 24 h` : ""}.`, where: "Paiements & finances" });
      if (m?.listings_pending > 0) alertsList.push({ tone: "warn", icon: "list", module: "listings", title: plural(m.listings_pending, "annonce", "annonces"), text: "en attente de modération.", where: "Annonces & modération" });
      if (alerts?.[0]?.n > 0) alertsList.push({ tone: "warn", icon: "shield", module: "trust", title: plural(alerts[0].n, "alerte de confiance", "alertes de confiance"), text: "ouverte(s) (documents, doublons).", where: "Confiance & vérifications" });
      if (proofs?.[0]?.n > 0) alertsList.push({ tone: "info", icon: "shield", module: "trust", title: plural(proofs[0].n, "pièce justificative", "pièces justificatives"), text: "à contrôler.", where: "Confiance & vérifications" });
      const rank = { bad: 0, warn: 1, info: 2 };
      alertsList.sort((a, c) => rank[a.tone] - rank[c.tone]);

      return {
        generatedAt: clock().toISOString(), days: n,
        kpis: m && {
          listingsPublished: { value: m.listings_published, added: m.listings_new, previous: m.listings_prev, change: pct(m.listings_new, m.listings_prev) },
          usersActive: { value: m.users_active, added: m.users_new, previous: m.users_prev, change: pct(m.users_new, m.users_prev) },
          contacts7d: { value: m.contacts_7, previous: m.contacts_prev_7, change: pct(m.contacts_7, m.contacts_prev_7) },
          paymentsPending: { value: m.pay_pending, stale: m.pay_stale },
          complaintsOpen: { value: m.complaints_open, priority: m.complaints_priority },
        },
        series: { days: keys, listings: fillDays(keys, sListings), contacts: fillDays(keys, sContacts), signups: fillDays(keys, sSignups), visits: fillDays(keys, sVisits) },
        health: { status: worst, items: health, memoryMb: Math.round(mem.rss / 1048576), uptimeSeconds: Math.round(process.uptime()) },
        alerts: alertsList,
        operations: operations.events,
        counts: { pendingListings: m?.listings_pending ?? null, openComplaints: m?.complaints_open ?? null, pendingProofs: proofs?.[0]?.n ?? null, openIncidents: incidents?.[0]?.n ?? null, pendingPayments: m?.pay_pending ?? null },
      };
    },

    // ---------- Journal de connexions ----------
    async securityLogStatus(userId) {
      await guard(userId);
      const rows = await safe(db.query("select value from ika_settings where key = 'security_log_enabled'"), []);
      const stats = await safe(db.query("select count(*)::int as total, count(*) filter (where occurred_at >= now() - interval '24 hours')::int as last24h, min(occurred_at) as since from ika_security_log"), null);
      return { enabled: rows[0]?.value !== "false", total: stats?.[0]?.total ?? null, last24h: stats?.[0]?.last24h ?? null, since: stats?.[0]?.since?.toISOString?.() ?? null, available: stats != null };
    },
    async setSecurityLog(userId, enabled) {
      await guard(userId);
      const on = enabled === true;
      await db.transaction(async (tx) => {
        await tx.query("insert into ika_settings (key, value) values ('security_log_enabled', $1) on conflict (key) do update set value = $1", [on ? "true" : "false"]);
        await accounts.audit(userId, "OWNER_SECURITY_LOG", null, on ? "activé" : "désactivé", tx);
      });
      secCache = null;
      return { enabled: on };
    },
    /** Meilleur effort : ne lève jamais, n'attend personne. Aucune adresse IP, aucun e-mail, aucun agent utilisateur brut. */
    async recordSecurity(event, fields = {}, req = null) {
      try {
        if (!SECURITY_EVENTS.includes(event)) return;
        const now = clock().getTime();
        if (!secCache || now - secCache.at >= 60_000) {
          const pending = db.query("select value from ika_settings where key = 'security_log_enabled'").then((rows) => rows[0]?.value !== "false");
          secCache = { at: now, pending };
          pending.catch(() => { if (secCache?.pending === pending) secCache = null; });
        }
        if (!(await secCache.pending)) return;
        await db.query(
          "insert into ika_security_log (id, event, user_id, device_type, outcome, detail) values ($1, $2, $3, $4, $5, $6)",
          [newId("sec"), event, fields.userId ? text(fields.userId, 80) : null, classifyDevice(req?.headers?.["user-agent"]), event === "LOGIN_FAILED" ? "FAILED" : "OK", fields.detail ? text(fields.detail, 200) : null]);
      } catch (error) {
        logger?.warn?.("journal_securite_echec", { message: String(error?.message ?? error).slice(0, 200) });
      }
    },
  };
}

