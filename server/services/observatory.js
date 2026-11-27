/**
 * Observatoire de l'Owner Center : agrégats en LECTURE SEULE sur une période choisie, comparée à la période précédente de même durée.
 * Chiffres réels uniquement. Aucun nom de compte, e-mail, téléphone ni texte saisi n'est renvoyé.
 * Les événements d'usage respectent la collecte existante (« Ne pas suivre »/GPC exclus à la source) ; les robots sont comptés à part.
 * Heures et jours en UTC, qui est l'heure du Mali.
 */
import { badRequest } from "../lib/errors.js";

const DAY = 86_400_000;
export const MAX_DAYS = 731;

/** Séries comptées : [clé, groupe, libellé, table, colonne de date, filtre SQL (constante), baisseEstBonne]. */
export const METRICS = Object.freeze([
  ["pageViews", "audience", "Pages vues", "ika_analytics_events", "occurred_at", "event_type = 'page_view' and not is_bot"],
  ["listingViews", "audience", "Fiches annonces vues", "ika_analytics_events", "occurred_at", "event_type = 'listing_view' and not is_bot"],
  ["events", "audience", "Actions enregistrées", "ika_analytics_events", "occurred_at", "not is_bot"],
  ["logins", "audience", "Connexions réussies", "ika_login_history", "created_at", null],
  ["favorites", "reactions", "Favoris ajoutés", "ika_favorites", "created_at", null],
  ["likes", "reactions", "Mentions « J'aime »", "ika_likes", "created_at", null],
  ["comments", "reactions", "Commentaires", "ika_comments", "created_at", null],
  ["follows", "reactions", "Abonnements à un profil", "ika_follows", "created_at", null],
  ["reviews", "reactions", "Avis sur les annonceurs", "ika_reviews", "created_at", null],
  ["publicationSaves", "reactions", "Publications mises en favori", "ika_publication_favorites", "created_at", null],
  ["contacts", "contacts", "Contacts sur les annonces", "ika_contact_events", "created_at", null],
  ["profileContacts", "contacts", "Contacts depuis un profil", "ika_profile_contact_events", "created_at", null],
  ["threads", "contacts", "Conversations ouvertes", "ika_threads", "created_at", null],
  ["messages", "contacts", "Messages envoyés", "ika_messages", "created_at", null],
  ["visitRequests", "contacts", "Demandes de visite", "ika_visit_requests", "created_at", null],
  ["homeMessages", "contacts", "Formulaires de l'accueil", "ika_home_form_messages", "created_at", null],
  ["signups", "growth", "Inscriptions", "ika_users", "created_at", null],
  ["listingsCreated", "growth", "Annonces déposées", "ika_listings", "created_at", null],
  ["listingsPublished", "growth", "Annonces publiées", "ika_listings", "published_at", null],
  ["publications", "growth", "Publications Découvrir", "ika_publications", "created_at", null],
  ["savedSearches", "growth", "Alertes de recherche créées", "ika_saved_searches", "created_at", null],
  ["newsletter", "growth", "Inscriptions à la newsletter", "ika_newsletter_optin", "opted_in_at", null],
  ["reports", "safety", "Signalements d'annonces", "ika_reports", "created_at", null, true],
  ["publicationReports", "safety", "Signalements de publications", "ika_publication_reports", "created_at", null, true],
  ["securityEvents", "safety", "Entrées du journal de sécurité", "ika_security_log", "occurred_at", null, true],
  ["incidents", "safety", "Incidents", "ika_incidents", "created_at", null, true],
  ["paymentsStarted", "revenue", "Paiements lancés", "ika_payments", "created_at", null],
  ["paymentsPaid", "revenue", "Paiements encaissés", "ika_payments", "paid_at", "status = 'PAID'"],
  ["revenue", "revenue", "Montant encaissé (FCFA)", "ika_payments", "paid_at", "status = 'PAID'", false, "coalesce(sum(amount_xof), 0)"],
].map(([key, group, label, table, at, where, lowerIsBetter = false, agg = "count(*)"]) => Object.freeze({ key, group, label, table, at, where, lowerIsBetter, agg })));

const isoDay = (t) => new Date(t).toISOString().slice(0, 10);
function parseDay(value, name) {
  const s = String(value ?? "");
  const t = Date.parse(`${s}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(t) || isoDay(t) !== s) throw badRequest(`Date « ${name} » invalide (format AAAA-MM-JJ).`);
  return t;
}

/** Période demandée (bornes incluses) et période précédente de même durée. Sans dates : les 30 derniers jours. */
export function resolveRange({ from, to } = {}, now = new Date()) {
  const today = Date.parse(`${isoDay(now)}T00:00:00Z`);
  const end = to ? parseDay(to, "au") : today;
  const start = from ? parseDay(from, "du") : end - 29 * DAY;
  if (start > end) throw badRequest("La date de début doit précéder la date de fin.");
  if (end > today) throw badRequest("La date de fin ne peut pas être dans le futur.");
  const days = Math.round((end - start) / DAY) + 1;
  if (days > MAX_DAYS) throw badRequest(`Période trop longue (${MAX_DAYS} jours au maximum).`);
  return {
    from: isoDay(start), to: isoDay(end), days, previousFrom: isoDay(start - days * DAY), previousTo: isoDay(start - DAY),
    granularity: days <= 92 ? "day" : days <= 370 ? "week" : "month",
    // bornes SQL : début inclus, fin exclue
    startAt: new Date(start).toISOString(), endAt: new Date(end + DAY).toISOString(), previousAt: new Date(start - days * DAY).toISOString(),
  };
}

/** Début de la tranche (jour, lundi de la semaine, ou 1er du mois), jamais avant le début de la période. */
export function bucketOf(day, granularity, from) {
  let key = day;
  if (granularity === "week") { const d = new Date(`${day}T00:00:00Z`); key = isoDay(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY); }
  if (granularity === "month") key = `${day.slice(0, 7)}-01`;
  return key < from ? from : key;
}
export function bucketsOf({ from, days, granularity }) {
  const start = Date.parse(`${from}T00:00:00Z`);
  return [...new Set(Array.from({ length: days }, (_, i) => bucketOf(isoDay(start + i * DAY), granularity, from)))];
}
export const deltaPct = (current, previous) => (previous > 0 ? Math.round(((current - previous) / previous) * 1000) / 10 : null);

export function createObservatory({ db, analytics = null, clock = () => new Date() }) {
  const num = (rows) => rows.map((r) => ({ ...r, n: Number(r.n) }));

  async function series(range) {
    const day = (col) => `to_char(${col} at time zone 'UTC', 'YYYY-MM-DD')`;
    const sql = METRICS.map((m) => `select '${m.key}' as k, ${day(m.at)} as d, (${m.agg})::bigint as n from ${m.table} where ${m.at} >= $1 and ${m.at} < $2${m.where ? ` and ${m.where}` : ""} group by 2`).join(" union all ");
    const rows = num(await db.query(sql, [range.previousAt, range.endAt]));
    const buckets = bucketsOf(range);
    const index = new Map(buckets.map((b, i) => [b, i]));
    const byKey = new Map(METRICS.map((m) => [m.key, { values: buckets.map(() => 0), previous: 0, daily: new Map() }]));
    for (const r of rows) {
      const s = byKey.get(r.k);
      if (r.d < range.from) { s.previous += r.n; continue; }
      s.values[index.get(bucketOf(r.d, range.granularity, range.from))] += r.n;
      s.daily.set(r.d, r.n);
    }
    return {
      buckets,
      metrics: METRICS.map((m) => {
        const s = byKey.get(m.key);
        const total = s.values.reduce((a, b) => a + b, 0);
        const best = [...s.daily].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
        return { key: m.key, group: m.group, label: m.label, lowerIsBetter: m.lowerIsBetter, total, previous: s.previous, deltaPct: deltaPct(total, s.previous), values: s.values, bestDay: best && best[1] > 0 ? { day: best[0], value: best[1] } : null };
      }),
    };
  }

  /** Totaux cumulés des comptes et annonces à la fin de chaque tranche (comptes supprimés exclus). */
  async function cumulative(range, metrics) {
    const [base] = await db.query(
      `select (select count(*) from ika_users where created_at < $1 and deleted_at is null)::int as users,
              (select count(*) from ika_listings where created_at < $1)::int as listings`, [range.startAt]);
    const removed = await db.query("select count(*)::int as n from ika_users where created_at >= $1 and created_at < $2 and deleted_at is not null", [range.startAt, range.endAt]);
    const run = (start, values) => { let t = start; return values.map((v) => (t += v)); };
    const values = (k) => metrics.find((m) => m.key === k).values;
    return { users: run(base.users, values("signups")), listings: run(base.listings, values("listingsCreated")), deletedAccountsInRange: removed[0].n };
  }

  async function breakdowns(range) {
    const p = [range.startAt, range.endAt];
    const ev = "from ika_analytics_events where occurred_at >= $1 and occurred_at < $2";
    const q = async (sql) => num(await db.query(sql, p));
    const [eventTypes, sources, devices, pages, topListings, heat, bots, categories, transactions, places, listingStatus, contactKinds, loginMethods, security, paymentStatus, dwell, visitStatus] = await Promise.all([
      q(`select event_type as label, count(*) as n ${ev} and not is_bot group by 1 order by 2 desc, 1`),
      q(`select coalesce(source, 'inconnue') as label, count(*) as n ${ev} and not is_bot group by 1 order by 2 desc, 1`),
      q(`select coalesce(device_type, 'inconnu') as label, count(*) as n ${ev} and not is_bot group by 1 order by 2 desc, 1`),
      q(`select page_path as label, count(*) as n ${ev} and not is_bot and event_type = 'page_view' and page_path is not null group by 1 order by 2 desc, 1 limit 12`),
      db.query(
        `with v as (select listing_id as id, count(*) as views ${ev} and not is_bot and event_type = 'listing_view' and listing_id is not null group by 1),
              c as (select listing_id as id, count(*) as contacts from ika_contact_events where created_at >= $1 and created_at < $2 group by 1),
              f as (select listing_id as id, count(*) as favorites from ika_favorites where created_at >= $1 and created_at < $2 group by 1),
              ids as (select id from v union select id from c union select id from f)
         select l.id, l.title, l.neighborhood, coalesce(v.views, 0)::int as views, coalesce(c.contacts, 0)::int as contacts, coalesce(f.favorites, 0)::int as favorites
           from ids join ika_listings l on l.id = ids.id left join v on v.id = ids.id left join c on c.id = ids.id left join f on f.id = ids.id
          order by 4 desc, 5 desc, 6 desc, 1 limit 12`, p),
      q(`select extract(isodow from occurred_at at time zone 'UTC')::int as dow, extract(hour from occurred_at at time zone 'UTC')::int as hour, count(*) as n ${ev} and not is_bot group by 1, 2`),
      q(`select count(*) as n ${ev} and is_bot`),
      q("select category as label, count(*) as n from ika_listings where created_at >= $1 and created_at < $2 group by 1 order by 2 desc, 1 limit 10"),
      q("select transaction_type as label, count(*) as n from ika_listings where created_at >= $1 and created_at < $2 group by 1 order by 2 desc, 1 limit 6"),
      q("select neighborhood as label, count(*) as n from ika_listings where created_at >= $1 and created_at < $2 group by 1 order by 2 desc, 1 limit 10"),
      q("select status as label, count(*) as n from ika_listings where created_at >= $1 and created_at < $2 group by 1 order by 2 desc, 1"),
      q("select kind as label, count(*) as n from ika_contact_events where created_at >= $1 and created_at < $2 group by 1 order by 2 desc, 1"),
      q("select method as label, count(*) as n from ika_login_history where created_at >= $1 and created_at < $2 group by 1 order by 2 desc, 1"),
      q("select event || ' · ' || coalesce(outcome, '—') as label, count(*) as n from ika_security_log where occurred_at >= $1 and occurred_at < $2 group by 1 order by 2 desc, 1 limit 12"),
      q("select status as label, count(*) as n from ika_payments where created_at >= $1 and created_at < $2 group by 1 order by 2 desc, 1"),
      db.query(`select count(*)::int as n, coalesce(round(avg((metadata->>'seconds')::numeric)), 0)::int as average ${ev} and not is_bot and event_type = 'listing_dwell' and metadata ? 'seconds'`, p),
      q("select status as label, count(*) as n from ika_visit_requests where created_at >= $1 and created_at < $2 group by 1 order by 2 desc, 1"),
    ]);
    return { eventTypes, sources, devices, pages, topListings, heat, botEvents: bots[0]?.n ?? 0, categories, transactions, places, listingStatus, contactKinds, loginMethods, security, paymentStatus, dwell: { count: dwell[0].n, averageSeconds: dwell[0].average }, visitStatus };
  }

  /** Ce qui se passe maintenant, indépendamment du filtre de dates. */
  async function live(now) {
    const ago = (ms) => new Date(now.getTime() - ms).toISOString();
    const [counts] = await db.query(
      `select count(*) filter (where occurred_at >= $1)::int as last30m, count(*) filter (where occurred_at >= $2)::int as lasthour, count(*)::int as last24h
         from ika_analytics_events where occurred_at >= $3 and not is_bot`, [ago(1_800_000), ago(3_600_000), ago(DAY)]);
    const latest = await db.query(
      `select e.event_type as type, e.occurred_at as at, e.source, e.device_type as device, e.page_path as page, l.title as "listingTitle"
         from ika_analytics_events e left join ika_listings l on l.id = e.listing_id where not e.is_bot order by e.occurred_at desc, e.id desc limit 40`);
    const [pending] = await db.query(
      `select (select count(*) from ika_listings where status = 'PENDING')::int as listings,
              (select count(*) from ika_reports where status = 'OPEN')::int as reports,
              (select count(*) from ika_incidents where not resolved)::int as incidents,
              (select count(*) from ika_home_form_messages where handled_at is null)::int as messages`);
    return { ...counts, latest, pending };
  }

  return {
    /** Le contrôle d'accès est fait par la route (module « observatory », non délégable : Super Administrateur). */
    async report(query = {}) {
      const now = clock();
      const range = resolveRange(query, now);
      const { buckets, metrics } = await series(range);
      const [totals, detail, current, collect] = await Promise.all([cumulative(range, metrics), breakdowns(range), live(now), analytics ? analytics.status() : null]);
      const { startAt, endAt, previousAt, ...publicRange } = range;
      return { generatedAt: now.toISOString(), range: publicRange, collecting: collect ? collect.environment && collect.setting : null, buckets, metrics, cumulative: totals, breakdowns: detail, live: current };
    },
  };
}
