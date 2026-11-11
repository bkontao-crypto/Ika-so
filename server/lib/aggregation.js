// Agrégation journalière (migration 024) : MANUELLE, reconstructible, sans donnée personnelle. Jamais branchée sur une minuterie.
// Jours en UTC (Mali : UTC+0). Les événements de robots sont exclus des indicateurs et comptés à part (qualité).
export const METHOD_VERSION = 1;
export const MAX_DAYS = 400;
const LOCK_KEY = 7210024; // verrou consultatif : une seule agrégation à la fois
const IN_DAY = "occurred_at >= $1::timestamptz and occurred_at < $2::timestamptz";

/** Chaque requête renvoie (metric, dim_type, dim_id, value) pour la plage [$1, $2[. Aucune colonne d'identité de personne. */
export const DAILY_QUERIES = Object.freeze([
  { label: "actions par type", sql: `select 'event.' || event_type as metric, ''::text as dim_type, ''::text as dim_id, count(*)::numeric as value from ika_analytics_events where ${IN_DAY} and not is_bot group by event_type` },
  { label: "vues par annonce", sql: `select 'listing.views' as metric, 'listing'::text as dim_type, listing_id as dim_id, count(*)::numeric as value from ika_analytics_events where event_type = 'listing_view' and listing_id is not null and ${IN_DAY} and not is_bot group by listing_id` },
  { label: "favoris ajoutés par annonce", sql: `select 'listing.favorites' as metric, 'listing'::text as dim_type, listing_id as dim_id, count(*)::numeric as value from ika_analytics_events where event_type = 'listing_favorite_added' and listing_id is not null and ${IN_DAY} and not is_bot group by listing_id` },
  { label: "clics de contact par annonce", sql: `select 'listing.contact_clicks' as metric, 'listing'::text as dim_type, listing_id as dim_id, count(*)::numeric as value from ika_analytics_events where event_type in ('phone_clicked', 'whatsapp_clicked') and listing_id is not null and ${IN_DAY} and not is_bot group by listing_id` },
  { label: "événements de robots (qualité)", sql: `select 'quality.bot_events' as metric, ''::text as dim_type, ''::text as dim_id, count(*)::numeric as value from ika_analytics_events where ${IN_DAY} and is_bot` },
  { label: "inscriptions (historique réel)", sql: "select 'users.registered' as metric, ''::text as dim_type, ''::text as dim_id, count(*)::numeric as value from ika_users where created_at >= $1::timestamptz and created_at < $2::timestamptz" },
  { label: "annonces publiées (historique réel)", sql: "select 'listings.published' as metric, ''::text as dim_type, ''::text as dim_id, count(*)::numeric as value from ika_listings where published_at >= $1::timestamptz and published_at < $2::timestamptz" },
]);

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export function parseDay(value) {
  if (!DAY_RE.test(String(value ?? ""))) throw new Error(`Date invalide « ${value} » (attendu : AAAA-MM-JJ).`);
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) throw new Error(`Date inexistante « ${value} ».`);
  return d;
}
const iso = (d) => d.toISOString().slice(0, 10);

/** Liste des jours (UTC) à traiter. Par défaut : les `days` derniers jours COMPLETS (le jour en cours n'est jamais agrégé). */
export function planDays({ from, to, days = 3, now = new Date() } = {}) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let start; let end;
  if (from || to) {
    if (!from || !to) throw new Error("Indiquez --from et --to ensemble.");
    start = parseDay(from); end = parseDay(to);
  } else {
    const n = Number(days);
    if (!Number.isInteger(n) || n < 1) throw new Error("--days doit être un entier positif.");
    end = new Date(today.getTime() - 86_400_000);
    start = new Date(end.getTime() - (n - 1) * 86_400_000);
  }
  if (end < start) throw new Error("La date de fin précède la date de début.");
  if (end >= today) throw new Error("Le jour en cours n'est pas terminé : agrégation refusée.");
  const out = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) out.push(iso(new Date(t)));
  if (out.length > MAX_DAYS) throw new Error(`Plage trop longue (${MAX_DAYS} jours au plus).`);
  return out;
}
const bounds = (day) => [`${day}T00:00:00Z`, new Date(new Date(`${day}T00:00:00Z`).getTime() + 86_400_000).toISOString()];

/** Simulation : combien de lignes seraient écrites, sans rien écrire. */
export async function simulateDay(db, day) {
  const [a, b] = bounds(day);
  const parts = [];
  for (const q of DAILY_QUERIES) {
    const r = (await db.query(`select count(*)::int as lines, coalesce(sum(value), 0)::text as total from (${q.sql}) t`, [a, b]))[0] ?? {};
    parts.push({ label: q.label, lines: r.lines ?? 0, total: r.total ?? "0" });
  }
  return parts;
}

/** Recalcule UN jour : supprime puis réécrit les lignes de cette version de méthode (idempotent), contrôle de cohérence consigné. */
export async function aggregateDay(db, day, { newId }) {
  const [a, b] = bounds(day);
  return db.transaction(async (tx) => {
    const lock = (await tx.query("select pg_try_advisory_xact_lock($1) as ok", [LOCK_KEY]))[0];
    if (!lock?.ok) return { day, skipped: "Une autre agrégation est en cours." };
    await tx.query("delete from ika_agg_daily where day = $1::date and method_version = $2", [day, METHOD_VERSION]);
    let lines = 0;
    for (const q of DAILY_QUERIES) {
      const inserted = await tx.query(
        `insert into ika_agg_daily (day, metric, dim_type, dim_id, country_code, value, method_version)
         select $3::date, metric, dim_type, dim_id, '', value, $4 from (${q.sql}) t returning 1`,
        [a, b, day, METHOD_VERSION]);
      lines += inserted.length;
    }
    // Contrôle : la somme des « event.* » écrits doit égaler le nombre d'événements hors robots du jour.
    const expected = (await tx.query(`select count(*)::numeric as n from ika_analytics_events where ${IN_DAY} and not is_bot`, [a, b]))[0]?.n ?? 0;
    const observed = (await tx.query("select coalesce(sum(value), 0) as n from ika_agg_daily where day = $1::date and method_version = $2 and metric like 'event.%'", [day, METHOD_VERSION]))[0]?.n ?? 0;
    const ok = Number(expected) === Number(observed);
    await tx.query(
      "insert into ika_analytics_checks (id, check_name, scope, expected, observed, ok, detail) values ($1, 'daily_total_matches_events', $2, $3, $4, $5, $6)",
      [newId("ck"), day, expected, observed, ok, ok ? null : "Somme des agrégats différente du nombre d'événements : recalculer et enquêter."]);
    return { day, lines, expected: Number(expected), observed: Number(observed), ok };
  });
}
