/** Tableau « Statistiques » du centre de contrôle : lit UNIQUEMENT les agrégats (ika_agg_daily), jamais les événements bruts. */
import { METHOD_VERSION, planDays as plan } from "../lib/aggregation.js";
import { badRequest, notFound } from "../lib/errors.js";
import { newId } from "../lib/security.js";
import { LISTING_COLUMNS, toCard } from "./cards.js";

const planDays = (opts) => { try { return plan(opts); } catch (error) { throw badRequest(error.message); } };

export const STAT_DEFINITIONS = Object.freeze([
  { key: "views", label: "Vues d'annonces", metrics: ["event.listing_view"], note: "Nombre de consultations de fiches, robots exclus. Ce n'est pas un nombre de visiteurs (aucun visiteur unique n'est mesuré)." },
  { key: "contacts", label: "Clics de contact", metrics: ["event.phone_clicked", "event.whatsapp_clicked"], note: "Clics sur « Appeler » ou « WhatsApp ». Un clic ne prouve ni un appel, ni un message, ni une transaction." },
  { key: "favorites", label: "Favoris ajoutés", metrics: ["event.listing_favorite_added"], note: "Ajouts uniquement ; un retrait n'est pas déduit." },
  { key: "pageViews", label: "Pages vues", metrics: ["event.page_view"], note: "Affichages de pages, robots exclus, sans identifiant de visiteur ni de session : ce n'est ni un nombre de visiteurs ni de sessions." },
  { key: "contactRequests", label: "Demandes de contact", metrics: ["event.contact_request_created"], note: "Messages ou demandes envoyés à un annonceur (action réussie côté serveur)." },
  { key: "contactAny", label: "Clics de contact (compteur général)", metrics: ["event.contact_clicked"], note: "Chaque clic Appeler ou WhatsApp est compté ici ET dans « Clics de contact » : ne pas additionner les deux." },
  { key: "updated", label: "Annonces modifiées", metrics: ["event.listing_updated"], note: "Modifications enregistrées par les annonceurs." },
  { key: "publishedEvents", label: "Publications approuvées", metrics: ["event.listing_published"], note: "Approbations par la modération, comptées à partir de l'activation de la collecte (voir aussi « Annonces publiées », historique réel)." },
  { key: "archived", label: "Annonces archivées", metrics: ["event.listing_archived"], note: "Archivages demandés par les annonceurs." },
  { key: "commentsHidden", label: "Commentaires masqués", metrics: ["event.comment_deleted"], note: "Commentaires masqués par la modération." },
  { key: "verifications", label: "Vérifications terminées", metrics: ["event.verification_completed"], note: "Numéros vérifiés par code SMS et pièces justificatives acceptées par l'équipe." },
  { key: "payments", label: "Paiements confirmés", metrics: ["event.payment_completed"], note: "Comptés uniquement sur confirmation signée du fournisseur de paiement, une fois par paiement." },
  { key: "registered", label: "Inscriptions", metrics: ["users.registered"], note: "Comptes créés (historique réel, disponible sans collecte)." },
  { key: "published", label: "Annonces publiées", metrics: ["listings.published"], note: "Annonces passées en ligne (historique réel, disponible sans collecte)." },
]);
/** Pondérations par défaut de l'indice de performance (le contact pèse plus qu'une vue). Le Superadmin peut les régler (réglages ranking_weight_*). */
export const DEFAULT_RANKING_WEIGHTS = Object.freeze({ view: 1, favorite: 3, contactClick: 5 });
export const RANKING_WEIGHTS = DEFAULT_RANKING_WEIGHTS;
const WEIGHT_KEYS = Object.freeze({ view: "ranking_weight_view", favorite: "ranking_weight_favorite", contactClick: "ranking_weight_contact" });
export const WEIGHT_MAX = 100;
/** En dessous, le taux d'interaction n'est pas affiché : trop peu de vues pour être significatif. */
export const MIN_VIEWS_FOR_RATE = 20;
export const rankingDefinitions = (w) => [
  { key: "score", label: "Indice de performance", note: `Vues × ${w.view} + favoris ajoutés × ${w.favorite} + clics de contact × ${w.contactClick}. Les pondérations sont réglées par le Superadmin ; chaque changement est inscrit dans le journal.` },
  { key: "rate", label: "Taux d'interaction", note: `(favoris ajoutés + clics de contact) ÷ vues × 100, affiché à partir de ${MIN_VIEWS_FOR_RATE} vues. Ce sont des vues, pas des visiteurs uniques : une même personne peut compter plusieurs fois.` },
  { key: "caution", label: "À lire avec prudence", note: "Un classement mesure la popularité, pas la fiabilité ni la qualité juridique du bien. Un faible score peut venir d'une annonce récente ou d'un petit territoire." },
];
export const RANKING_DEFINITIONS = rankingDefinitions(DEFAULT_RANKING_WEIGHTS);

/** Valide des pondérations : entiers de 0 à 100, un contact doit peser plus qu'une simple vue, au moins une pondération non nulle. */
export function validateWeights(input) {
  const out = {};
  for (const k of Object.keys(DEFAULT_RANKING_WEIGHTS)) {
    const n = Number(input?.[k]);
    if (input?.[k] === "" || input?.[k] == null || !Number.isInteger(n) || n < 0 || n > WEIGHT_MAX) throw badRequest(`Pondération « ${k} » invalide : entier de 0 à ${WEIGHT_MAX}.`);
    out[k] = n;
  }
  if (out.contactClick <= out.view) throw badRequest("Un clic de contact doit peser plus qu'une simple vue.");
  if (!out.view && !out.favorite && !out.contactClick) throw badRequest("Au moins une pondération doit être non nulle.");
  return out;
}
const ALL_METRICS = [...new Set(STAT_DEFINITIONS.flatMap((d) => d.metrics))];
const DAY_MS = 86_400_000;

const sumByDef = (rows) => {
  const byDay = new Map();
  for (const r of rows) {
    const def = STAT_DEFINITIONS.find((d) => d.metrics.includes(r.metric));
    if (!def) continue;
    const entry = byDay.get(r.day) ?? {};
    entry[def.key] = (entry[def.key] ?? 0) + Number(r.value);
    byDay.set(r.day, entry);
  }
  return byDay;
};

/** Indice et taux à partir des compteurs d'une annonce ou d'un annonceur. Taux nul (non affiché) sous le seuil de vues. */
export function scored({ views, favorites, contactClicks }, w = DEFAULT_RANKING_WEIGHTS) {
  const score = views * w.view + favorites * w.favorite + contactClicks * w.contactClick;
  const interactionRate = views >= MIN_VIEWS_FOR_RATE ? Math.round(((favorites + contactClicks) / views) * 1000) / 10 : null;
  return { views, favorites, contactClicks, score, interactionRate };
}

/** Un chemin du site : commence par « / », sans « // », sans caractère d'URL dangereux. */
const SITE_PATH = /^\/(?!\/)[A-Za-z0-9\-._~%/]*$/;
/** Logo : chemin du site ou adresse https, sans espace ni guillemet ni chevron (il finit dans un attribut HTML). */
const LOGO_URL = /^(\/(?!\/)[^\s"'<>\\]*|https:\/\/[^\s"'<>\\]+)$/;
const trimPath = (value) => { const v = String(value ?? "").trim(); return v.length > 1 ? v.replace(/\/+$/, "") : v; };

const CAMPAIGN_KINDS = ["BANNER", "PROMO", "SPONSORED", "NEWS", "SIDEBAR"];
const CAMPAIGN_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "ENDED"];
/** Visuels permis : fichier du dossier public/media ou photo stockée (la politique de sécurité du site bloque les images externes). */
const CAMPAIGN_IMAGE = /^(\/media\/[\w.-]+\.(jpe?g|png|webp)|\/api\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
/** Lien permis : page interne (#/…) ou adresse https:// ; jamais javascript: ni data:. */
const CAMPAIGN_LINK = /^(#\/[\w\-./%?=&]{0,200}|https:\/\/[^\s"'<>]{3,280})$/i;
const optDate = (v, label) => {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) throw badRequest(`${label} invalide.`);
  return d.toISOString();
};
/** Nettoie et valide les champs de diffusion d'une campagne. */
async function campaignFieldsWith(db, input) {
  const listingId = String(input.listingId ?? "").trim().slice(0, 80) || null;
  const imageUrl = String(input.imageUrl ?? "").trim() || null;
  const linkUrl = String(input.linkUrl ?? "").trim() || null;
  if (imageUrl && !CAMPAIGN_IMAGE.test(imageUrl)) throw badRequest("Visuel invalide : utilisez une image du site (/media/… ou /api/media/…).");
  if (linkUrl && !CAMPAIGN_LINK.test(linkUrl)) throw badRequest("Lien invalide : page interne (#/…) ou adresse https:// uniquement.");
  if (listingId && !(await db.query("select 1 from ika_listings where id = $1", [listingId])).length) throw badRequest("Annonce liée introuvable.");
  const startsAt = optDate(input.startsAt, "Date de début");
  const endsAt = optDate(input.endsAt, "Date de fin");
  if (startsAt && endsAt && endsAt <= startsAt) throw badRequest("La date de fin doit suivre la date de début.");
  const sortOrder = Math.max(0, Math.min(999, Number.parseInt(input.sortOrder ?? 0, 10) || 0));
  return { listingId, imageUrl, linkUrl, ctaLabel: String(input.ctaLabel ?? "").trim().slice(0, 30) || null, sortOrder, startsAt, endsAt };
}
/** Une SPONSORED ne peut être active que si elle a de quoi s'afficher : une annonce liée, ou un visuel ET un lien. */
function assertDiffusable(kind, f) {
  if (kind === "SPONSORED" && !f.listingId && !(f.imageUrl && f.linkUrl)) {
    throw badRequest("Une campagne SPONSORED doit être liée à une annonce, ou avoir un visuel et un lien.");
  }
}

export function createStats({ db, accounts, analytics = null, clock = () => new Date(), backup = null, sendEmail = null, onSettingsChanged = () => {} }) {
  const campaignFields = (input) => campaignFieldsWith(db, input);
  const totalsOf = (byDay, days) => {
    const t = Object.fromEntries(STAT_DEFINITIONS.map((d) => [d.key, 0]));
    for (const day of days) for (const [k, v] of Object.entries(byDay.get(day) ?? {})) t[k] += v;
    return t;
  };
  /** Pondérations en vigueur : une valeur absente ou invalide en base retombe sur la valeur par défaut. */
  async function readWeights() {
    const rows = await db.query("select key, value from ika_settings where key = any($1)", [Object.values(WEIGHT_KEYS)]);
    const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const weights = {}; let custom = false;
    for (const [k, key] of Object.entries(WEIGHT_KEYS)) {
      const n = Number(stored[key]);
      const ok = stored[key] != null && Number.isInteger(n) && n >= 0 && n <= WEIGHT_MAX;
      weights[k] = ok ? n : DEFAULT_RANKING_WEIGHTS[k];
      if (ok && n !== DEFAULT_RANKING_WEIGHTS[k]) custom = true;
    }
    return { weights, custom };
  }
  const periodOf = (opts, now) => {
    const { days, from, to } = opts ?? {};
    const list = from || to ? planDays({ from, to, now }) : planDays({ days: [7, 30, 90].includes(Number(days)) ? Number(days) : 7, now });
    const [start, end] = [list[0], list[list.length - 1]];
    const prevEnd = new Date(new Date(`${start}T00:00:00Z`).getTime() - DAY_MS).toISOString().slice(0, 10);
    const prevStart = new Date(new Date(`${start}T00:00:00Z`).getTime() - list.length * DAY_MS).toISOString().slice(0, 10);
    return { start, end, prevStart, prevEnd, days: list.length };
  };
  async function advertiserBase(advertiserId) {
    const id = String(advertiserId ?? "").slice(0, 80);
    const rows = await db.query(
      `select u.id, u.name, u.created_at, p.full_name, p.display_role, p.agency_name, p.agency_verified_at, p.account_status, p.status_reason, p.phone, p.phone_verified_at
       from ika_users u join ika_profiles p on p.user_id = u.id where u.id = $1 and u.deleted_at is null`, [id]);
    if (!rows[0]) throw notFound("Annonceur introuvable.");
    return rows[0];
  }
  const publicName = (r) => (r.agency_verified_at && r.agency_name ? r.agency_name : r.full_name || r.name);
  /** Compteurs d'un annonceur (somme de ses annonces) sur la période et la période précédente, lus dans les agrégats. */
  async function performanceOf(ownerId, p, weights) {
    const listings = await db.query("select id, title, status from ika_listings where owner_id = $1", [ownerId]);
    const ids = listings.map((l) => l.id);
    const empty = () => ({ views: 0, favorites: 0, contactClicks: 0 });
    const load = async (from, to) => {
      const per = new Map();
      if (!ids.length) return per;
      const rows = await db.query(
        "select dim_id, metric, sum(value)::float as value from ika_agg_daily where dim_type = 'listing' and dim_id = any($1) and metric in ('listing.views', 'listing.favorites', 'listing.contact_clicks') and day between $2::date and $3::date and method_version = $4 group by dim_id, metric",
        [ids, from, to, METHOD_VERSION]);
      for (const r of rows) {
        const e = per.get(r.dim_id) ?? empty();
        if (r.metric === "listing.views") e.views += Number(r.value); else if (r.metric === "listing.favorites") e.favorites += Number(r.value); else e.contactClicks += Number(r.value);
        per.set(r.dim_id, e);
      }
      return per;
    };
    const [cur, prev] = await Promise.all([load(p.start, p.end), load(p.prevStart, p.prevEnd)]);
    const sum = (per) => { const t = empty(); for (const e of per.values()) { t.views += e.views; t.favorites += e.favorites; t.contactClicks += e.contactClicks; } return scored(t, weights); };
    const best = listings.map((l) => ({ listingId: l.id, title: l.title, status: l.status, ...scored(cur.get(l.id) ?? empty(), weights) })).filter((l) => l.score > 0).sort((a, b) => b.score - a.score || b.views - a.views).slice(0, 5);
    return { current: sum(cur), previous: sum(prev), bestListings: best, listings };
  }
  const range = (days) => [days[0], days[days.length - 1]];
  const dailyRows = (from, to) => db.query(
    "select day::text as day, metric, sum(value)::float as value from ika_agg_daily where day between $1::date and $2::date and method_version = $3 and dim_type = '' and metric = any($4) group by day, metric",
    [from, to, METHOD_VERSION, ALL_METRICS]);

  return {
    /** Classements d'annonces et d'annonceurs (agences séparées des autres), calculés sur les agrégats par annonce. */
    async rankings(staffId, { days = 7, from, to, limit = 10 } = {}) {
      await accounts.requireStaff(staffId, "ADMIN");
      const list = from || to ? planDays({ from, to, now: clock() }) : planDays({ days: [7, 30, 90].includes(Number(days)) ? Number(days) : 7, now: clock() });
      const [start, end] = range(list);
      const top = Math.min(Math.max(Number(limit) || 10, 1), 50);
      const { weights, custom } = await readWeights();
      const rows = await db.query(
        "select dim_id, metric, sum(value)::float as value from ika_agg_daily where dim_type = 'listing' and metric in ('listing.views', 'listing.favorites', 'listing.contact_clicks') and day between $1::date and $2::date and method_version = $3 group by dim_id, metric",
        [start, end, METHOD_VERSION]);
      const per = new Map();
      for (const r of rows) {
        const e = per.get(r.dim_id) ?? { views: 0, favorites: 0, contactClicks: 0 };
        if (r.metric === "listing.views") e.views += Number(r.value);
        else if (r.metric === "listing.favorites") e.favorites += Number(r.value);
        else e.contactClicks += Number(r.value);
        per.set(r.dim_id, e);
      }
      const ids = [...per.keys()];
      const info = ids.length ? await db.query(
        `select l.id, l.title, l.owner_id, p.display_role, p.agency_name, p.agency_verified_at, p.full_name, u.name
         from ika_listings l join ika_profiles p on p.user_id = l.owner_id join ika_users u on u.id = l.owner_id where l.id = any($1)`, [ids]) : [];
      const listings = []; const owners = new Map();
      for (const l of info) {
        const m = per.get(l.id);
        const verified = Boolean(l.agency_verified_at);
        const name = verified && l.agency_name ? l.agency_name : l.full_name || l.name;
        const entry = { listingId: l.id, title: l.title, ownerId: l.owner_id, ownerName: name, ...scored(m, weights) };
        listings.push(entry);
        const o = owners.get(l.owner_id) ?? { ownerId: l.owner_id, name, role: l.display_role, agencyVerified: verified, isAgency: l.display_role === "Agence immobilière", listingsCounted: 0, views: 0, favorites: 0, contactClicks: 0 };
        o.listingsCounted += 1; o.views += m.views; o.favorites += m.favorites; o.contactClicks += m.contactClicks;
        owners.set(l.owner_id, o);
      }
      const byScore = (a, b) => b.score - a.score || b.views - a.views;
      const advertisers = [...owners.values()].map((o) => ({ ...o, ...scored(o, weights) })).filter((o) => o.score > 0).sort(byScore);
      return {
        period: { from: start, to: end, days: list.length },
        minViewsForRate: MIN_VIEWS_FOR_RATE, weights, defaultWeights: DEFAULT_RANKING_WEIGHTS, weightsCustomised: custom, weightMax: WEIGHT_MAX,
        listings: listings.filter((l) => l.score > 0).sort(byScore).slice(0, top),
        agencies: advertisers.filter((o) => o.isAgency).slice(0, top),
        others: advertisers.filter((o) => !o.isAgency).slice(0, top),
        definitions: rankingDefinitions(weights),
        notice: "Classements calculés sur les agrégats de la période. Aucun visiteur unique n'est mesuré.",
      };
    },

    /** Fiche détaillée d'un annonceur (administrateurs). Chaque consultation est inscrite au journal (donnée sensible). */
    async advertiserSheet(staffId, advertiserId, opts = {}) {
      await accounts.requireStaff(staffId, "ADMIN");
      const p = periodOf(opts, clock());
      const base = await advertiserBase(advertiserId);
      const { weights } = await readWeights();
      await accounts.audit(staffId, "VIEW_ADVERTISER_SHEET", null, base.id);
      const [perf, reviews, listingReports, userReports, history, session] = await Promise.all([
        performanceOf(base.id, p, weights),
        db.query("select count(*)::int as n, coalesce(avg(rating), 0)::float as avg from ika_reviews where advertiser_id = $1 and status = 'VISIBLE'", [base.id]),
        db.query("select count(*) filter (where r.status = 'OPEN')::int as open, count(*)::int as total from ika_reports r join ika_listings l on l.id = r.listing_id where l.owner_id = $1", [base.id]),
        db.query("select count(*) filter (where status = 'OPEN')::int as open, count(*)::int as total from ika_user_reports where reported_id = $1", [base.id]),
        db.query("select action, note, created_at from ika_audit where action in ('SANCTION', 'HIDE_PROFILE_IMAGES', 'SHOW_PROFILE_IMAGES', 'STAFF_ROLE') and strpos(note, $1) > 0 order by created_at desc limit 20", [base.id]),
        db.query("select max(created_at) as at from ika_sessions where user_id = $1", [base.id]),
      ]);
      const byStatus = {};
      for (const l of perf.listings) byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;
      return {
        period: { from: p.start, to: p.end, days: p.days, previousFrom: p.prevStart, previousTo: p.prevEnd },
        advertiser: { id: base.id, name: publicName(base), role: base.display_role, agencyVerified: Boolean(base.agency_verified_at), accountStatus: base.account_status, statusReason: base.status_reason ?? null, memberSince: base.created_at ? new Date(base.created_at).toISOString() : null, phone: base.phone ?? null, phoneVerifiedBySms: Boolean(base.phone_verified_at) },
        listingsByStatus: byStatus, listingsTotal: perf.listings.length,
        performance: { current: perf.current, previous: perf.previous }, bestListings: perf.bestListings, weights,
        reviews: { count: reviews[0]?.n ?? 0, average: reviews[0]?.n ? Math.round(reviews[0].avg * 10) / 10 : null },
        reports: { listingOpen: listingReports[0]?.open ?? 0, listingTotal: listingReports[0]?.total ?? 0, userOpen: userReports[0]?.open ?? 0, userTotal: userReports[0]?.total ?? 0 },
        history: history.map((h) => ({ action: h.action, note: h.note, at: new Date(h.created_at).toISOString() })),
        lastSessionAt: session[0]?.at ? new Date(session[0].at).toISOString() : null,
        notice: "Fiche réservée à l'équipe : sa consultation est inscrite au journal. Les signalements en cours ne prouvent rien tant que la modération ne les a pas examinés. Popularité n'est pas fiabilité.",
      };
    },

    /** Comparaison de deux annonceurs sur la même période (mêmes pondérations). */
    async compareAdvertisers(staffId, aId, bId, opts = {}) {
      await accounts.requireStaff(staffId, "ADMIN");
      if (!aId || !bId || String(aId) === String(bId)) throw badRequest("Choisissez deux annonceurs différents.");
      const p = periodOf(opts, clock());
      const { weights } = await readWeights();
      const side = async (id) => {
        const base = await advertiserBase(id);
        const perf = await performanceOf(base.id, p, weights);
        await accounts.audit(staffId, "VIEW_ADVERTISER_SHEET", null, base.id);
        return { id: base.id, name: publicName(base), role: base.display_role, agencyVerified: Boolean(base.agency_verified_at), listingsTotal: perf.listings.length, current: perf.current, previous: perf.previous, bestListings: perf.bestListings.slice(0, 3) };
      };
      const [a, b] = [await side(aId), await side(bId)];
      return { period: { from: p.start, to: p.end, days: p.days }, weights, a, b, notice: "Comparaison sur les mêmes jours et les mêmes pondérations. Un écart de score ne dit rien de la fiabilité de l'annonceur." };
    },

    /** Réglage des pondérations : Superadmin seulement, motif obligatoire, ancien et nouveau réglage inscrits au journal (même transaction). */
    async setWeights(staffId, input) {
      await accounts.requireStaff(staffId, "SUPERADMIN");
      const next = validateWeights(input);
      const reason = String(input?.reason ?? "").trim().slice(0, 300);
      if (reason.length < 3) throw badRequest("Indiquez le motif du changement.");
      const before = (await readWeights()).weights;
      await db.transaction(async (tx) => {
        for (const [k, key] of Object.entries(WEIGHT_KEYS)) {
          await tx.query("insert into ika_settings (key, value) values ($1, $2) on conflict (key) do update set value = $2", [key, String(next[k])]);
        }
        await accounts.audit(staffId, "RANKING_WEIGHTS", null, `vue ${before.view}→${next.view}, favori ${before.favorite}→${next.favorite}, contact ${before.contactClick}→${next.contactClick} : ${reason}`, tx);
      });
      return { weights: next };
    },

    /** Période : 7, 30 ou 90 derniers jours complets, ou plage libre. Comparaison avec la période précédente de même durée. */
    async overview(staffId, { days = 7, from, to } = {}) {
      await accounts.requireStaff(staffId, "ADMIN");
      const now = clock();
      const list = from || to ? planDays({ from, to, now }) : planDays({ days: [7, 30, 90].includes(Number(days)) ? Number(days) : 7, now });
      const [start, end] = range(list);
      const prevEnd = new Date(new Date(`${start}T00:00:00Z`).getTime() - DAY_MS).toISOString().slice(0, 10);
      const prevStart = new Date(new Date(`${start}T00:00:00Z`).getTime() - list.length * DAY_MS).toISOString().slice(0, 10);
      const prevList = planDaysFrom(prevStart, prevEnd);

      const [cur, prev, last, checks, status, top] = await Promise.all([
        dailyRows(start, end), dailyRows(prevStart, prevEnd),
        db.query("select max(day)::text as day from ika_agg_daily where method_version = $1", [METHOD_VERSION]),
        db.query("select count(*)::int as n from ika_analytics_checks where ok = false and checked_at >= $1::timestamptz - interval '7 days'", [now.toISOString()]),
        analytics?.status ? analytics.status() : { environment: false, setting: false },
        db.query(
          "select dim_id, metric, sum(value)::float as value from ika_agg_daily where dim_type = 'listing' and metric in ('listing.views', 'listing.contact_clicks') and day between $1::date and $2::date and method_version = $3 group by dim_id, metric",
          [start, end, METHOD_VERSION]),
      ]);

      const byDay = sumByDef(cur);
      const perListing = new Map();
      for (const r of top) {
        const e = perListing.get(r.dim_id) ?? { listingId: r.dim_id, views: 0, contactClicks: 0 };
        if (r.metric === "listing.views") e.views += Number(r.value); else e.contactClicks += Number(r.value);
        perListing.set(r.dim_id, e);
      }
      const best = [...perListing.values()].sort((a, b) => b.views - a.views || b.contactClicks - a.contactClicks).slice(0, 10);
      const titles = best.length ? await db.query("select id, title from ika_listings where id = any($1)", [best.map((b) => b.listingId)]) : [];
      const titleOf = new Map(titles.map((t) => [t.id, t.title]));

      return {
        period: { from: start, to: end, days: list.length, previousFrom: prevStart, previousTo: prevEnd },
        collection: { environmentOn: Boolean(status.environment), settingOn: Boolean(status.setting), lastAggregatedDay: last[0]?.day ?? null, checksFailed7d: checks[0]?.n ?? 0 },
        totals: totalsOf(byDay, list), previousTotals: totalsOf(sumByDef(prev), prevList),
        daily: list.map((day) => ({ day, ...Object.fromEntries(STAT_DEFINITIONS.map((d) => [d.key, byDay.get(day)?.[d.key] ?? 0])) })),
        topListings: best.map((b) => ({ ...b, title: titleOf.get(b.listingId) ?? null })),
        definitions: STAT_DEFINITIONS.map(({ key, label, note }) => ({ key, label, note })),
        notice: "Chiffres lus dans les agrégats du jour précédent et avant, jamais en direct. Aucun visiteur unique ni pays n'est mesuré.",
      };
    },










    /** Répartition des annonces par région / quartier. */
    /** Conversion du Premium par emplacement d'invitation. Clics : événements mesurés (robots exclus, collecte consentie). Paiements lancés et confirmés : lus dans les paiements eux-mêmes, donc exacts. */
    async premiumFunnel(userId, days = 30) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const d = Math.min(365, Math.max(1, Number.parseInt(days, 10) || 30));
      const clicks = await db.query(
        `select coalesce(metadata->>'from', 'autre') as origin, count(*)::int as n
           from ika_analytics_events
          where event_type = 'premium_cta_clicked' and is_bot = false and occurred_at > now() - ($1 || ' days')::interval
          group by 1`,
        [String(d)],
      );
      const pays = await db.query(
        `select coalesce(origin, 'autre') as origin, count(*)::int as started, count(*) filter (where status = 'PAID')::int as paid
           from ika_payments
          where kind = 'PREMIUM' and created_at > now() - ($1 || ' days')::interval
          group by 1`,
        [String(d)],
      );
      const by = new Map();
      for (const r of clicks) by.set(r.origin, { origin: r.origin, clicks: r.n, started: 0, paid: 0 });
      for (const r of pays) { const e = by.get(r.origin) ?? { origin: r.origin, clicks: 0, started: 0, paid: 0 }; e.started = r.started; e.paid = r.paid; by.set(r.origin, e); }
      const rows = [...by.values()]
        .map((e) => ({ ...e, conversionPct: e.clicks >= 20 ? Math.round((e.paid / e.clicks) * 1000) / 10 : null }))
        .sort((x, y) => y.paid - x.paid || y.clicks - x.clicks);
      const status = await analytics?.status?.().catch(() => null);
      return { days: d, collecting: status ? status.environment && status.setting : null, rows, note: "Taux affiché à partir de 20 clics. Les clics des visiteurs qui envoient « Ne pas suivre » (ou GPC) ne sont pas comptés, et rien n'est compté tant que la collecte est éteinte : le taux est donc un peu surestimé. Les paiements, eux, sont toujours exacts." };
    },

    async regionsOverview(userId) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const rows = await db.query(
        `select neighborhood, 
                count(*)::int as total,
                count(*) filter (where status = 'PUBLISHED')::int as published,
                count(*) filter (where transaction_type = 'Vente')::int as sale,
                count(*) filter (where transaction_type = 'Location')::int as rent
         from ika_listings
         where neighborhood is not null and neighborhood <> ''
         group by neighborhood
         order by published desc, total desc
         limit 50`
      );
      return rows.map(r => ({
        neighborhood: r.neighborhood,
        total: r.total,
        published: r.published,
        sale: r.sale,
        rent: r.rent,
      }));
    },

    /** Gestion autonome des formules. */
    async manageOffers(userId, action, input = {}) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      if (action === "list") {
        const rows = await db.query("select code, label, days, price_xof, active, kind from ika_offers order by kind, days");
        return rows;
      }
      if (action === "create") {
        const code = String(input.code || "").trim().toUpperCase().slice(0, 20);
        const label = String(input.label || "").trim().slice(0, 80);
        const days = Math.max(1, Number(input.days) || 7);
        const price = Math.max(0, Number(input.price) || 0);
        const kind = input.kind === "PREMIUM" ? "PREMIUM" : "BOOST";
        if (!code || !label) throw new Error("Code et libellé obligatoires.");
        await db.query(
          "insert into ika_offers (code, label, days, price_xof, kind) values ($1, $2, $3, $4, $5) on conflict (code) do nothing",
          [code, label, days, price, kind]
        );
        await accounts.audit(userId, "OFFER_CREATE", null, code);
        return { code, label, days, price };
      }
      if (action === "toggle") {
        const code = String(input.code || "");
        await db.query("update ika_offers set active = not active where code = $1", [code]);
        await accounts.audit(userId, "OFFER_TOGGLE", null, code);
        return { code, toggled: true };
      }
      throw new Error("Action inconnue.");
    },
    /** Journal des restaurations. */
    async logRestore(userId, backupId, note = "Restauration manuelle") {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const id = "rs_" + Date.now().toString(36);
      await db.query(
        "insert into ika_restore_log (id, backup_id, note, created_by) values ($1, $2, $3, $4)",
        [id, backupId || null, String(note).slice(0, 200), userId]
      );
      await accounts.audit(userId, "RESTORE_LOG", null, note);
      return { id, note };
    },
    async listRestores(userId) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const rows = await db.query("select id, backup_id, note, created_at from ika_restore_log order by created_at desc limit 20");
      return rows.map(r => ({ ...r, created_at: r.created_at?.toISOString?.() }));
    },
    /** Vue des abonnements / offres et paiements. */
    async subscriptionsOverview(userId) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const offers = await db.query("select code, label, days from ika_offers order by days");
      const payments = await db.query(
        `select status, count(*)::int as n, coalesce(sum(amount_xof),0)::bigint as total
         from ika_payments group by status`
      );
      const recent = await db.query(
        `select p.id, p.status, p.amount_xof, p.created_at, o.label
         from ika_payments p left join ika_offers o on o.code = p.offer_code
         order by p.created_at desc limit 20`
      );
      return {
        offers: offers.map(o => ({ code: o.code, label: o.label, days: o.days })),
        byStatus: Object.fromEntries(payments.map(r => [r.status, { count: r.n, total: Number(r.total) }])),
        recent: recent.map(r => ({
          id: r.id, status: r.status, amount: r.amount_xof, label: r.label,
          createdAt: r.created_at?.toISOString?.()
        })),
      };
    },

    /** Aide à la rédaction IA (suggestions de titre et description). */
    async aiWriteAssist(userId, input = {}) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const category = String(input.category || "Maison").trim();
      const transaction = String(input.transaction || "Vente").trim();
      const neighborhood = String(input.neighborhood || "Bamako").trim();
      const price = Number(input.price) || 0;
      const surface = Number(input.surface) || 0;
      const rooms = Number(input.rooms) || 0;

      const priceStr = price > 0 ? `${price.toLocaleString("fr")} XOF` : "prix à discuter";
      const surfaceStr = surface > 0 ? `${surface} m²` : "";
      const roomsStr = rooms > 0 ? `${rooms} pièces` : "";

      const titles = [
        `${category} ${transaction.toLowerCase()} à ${neighborhood}${surfaceStr ? " - " + surfaceStr : ""}`,
        `${category} ${roomsStr ? roomsStr + " " : ""}à ${neighborhood} - ${transaction}`,
        `${transaction} ${category.toLowerCase()} ${neighborhood}${price > 0 ? " - " + priceStr : ""}`,
      ];

      const description = [
        `${category} disponible en ${transaction.toLowerCase()} à ${neighborhood}.`,
        surfaceStr ? `Surface : ${surfaceStr}.` : "",
        roomsStr ? `Composé de ${roomsStr}.` : "",
        price > 0 ? `Prix : ${priceStr}.` : "",
        "Contactez-nous pour plus d'informations et pour organiser une visite.",
      ].filter(Boolean).join(" ");

      return {
        suggestedTitles: titles,
        suggestedDescription: description,
        tips: [
          "Ajoutez des photos de qualité",
          "Mentionnez les atouts (parking, jardin, sécurité)",
          "Précisez les charges si location",
          "Indiquez la disponibilité",
        ],
      };
    },
    /** Assistance IA : détection de doublons potentiels et annonces suspectes. */
    async aiAssist(userId) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      // Doublons potentiels : même quartier, même type, prix proche, titres similaires
      const duplicates = await db.query(
        `select a.id as id1, b.id as id2, a.title as title1, b.title as title2, a.neighborhood, a.price
         from ika_listings a
         join ika_listings b on a.id < b.id
           and a.neighborhood = b.neighborhood
           and a.category = b.category
           and a.transaction_type = b.transaction_type
           and a.status in ('PENDING','PUBLISHED')
           and b.status in ('PENDING','PUBLISHED')
           and abs(a.price - b.price) < greatest(a.price, b.price) * 0.05
         limit 20`
      );
      // Annonces avec prix anormalement bas ou élevé dans leur quartier
      const outliers = await db.query(
        `select id, title, neighborhood, price, category
         from ika_listings
         where status = 'PUBLISHED'
           and price > 0
           and (price < 100000 or price > 500000000)
         order by price desc
         limit 15`
      );
      // Rafales : plus de 3 annonces du même propriétaire en 24h
      const bursts = await db.query(
        `select owner_id, count(*)::int as n
         from ika_listings
         where created_at > now() - interval '24 hours'
         group by owner_id
         having count(*) >= 3
         limit 10`
      );
      return {
        potentialDuplicates: duplicates.map(r => ({
          id1: r.id1, id2: r.id2, title1: r.title1, title2: r.title2,
          neighborhood: r.neighborhood, price: r.price
        })),
        priceOutliers: outliers,
        bursts: bursts.map(r => ({ ownerId: r.owner_id, count: r.n })),
        generatedAt: new Date().toISOString(),
      };
    },

    /** Génère un PDF minimal du rapport Owner. */
    async reportPdf(userId) {
      const data = await this.fullReport(userId);
      const lines = [
        "IKA SO - RAPPORT OWNER CONTROL CENTER",
        "Genere le : " + new Date(data.generatedAt).toLocaleString("fr"),
        "",
        "ANNONCES",
        "  Total : " + data.overview.listings.total,
        "  Publiees : " + data.overview.listings.published,
        "  En attente : " + data.overview.listings.pending,
        "  Vente : " + data.overview.listings.sale,
        "  Location : " + data.overview.listings.rent,
        "",
        "UTILISATEURS",
        "  Total : " + data.overview.users.total,
        "  Actifs : " + data.overview.users.active,
        "  Personnel : " + data.overview.users.staff,
        "",
        "ACTIVITE",
        "  Contacts 7j : " + data.overview.activity.contacts7d,
        "  Visites en attente : " + data.overview.activity.visitsPending,
        "  Signalements : " + data.overview.activity.reportsOpen,
        "",
        "FINANCES",
        "  Paiements reussis : " + data.overview.finance.paymentsPaid,
        "  Montant encaisse : " + data.overview.finance.amountPaid + " XOF",
        "",
        "AGENCES : " + data.agenciesCount,
        "RECLAMATIONS OUVERTES : " + data.openComplaints,
        "BASE DE DONNEES : " + data.health.database,
      ];
      // PDF minimal (texte simple)
      const content = lines.join("\n");
      const pdf = [
        "%PDF-1.4",
        "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
        "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
        "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
        "4 0 obj << /Length " + (content.length + 50) + " >> stream",
        "BT /F1 10 Tf 50 800 Td 14 TL",
        ...content.split("\n").map((l, i) => `(${l.replace(/[()\\]/g, "\\$&")}) Tj T*`),
        "ET",
        "endstream endobj",
        "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
        "xref",
        "0 6",
        "0000000000 65535 f ",
        "trailer << /Size 6 /Root 1 0 R >>",
        "startxref",
        "0",
        "%%EOF",
      ].join("\n");
      return Buffer.from(pdf, "utf8");
    },
    /** Rapport consolidé (JSON) pour export / impression. */
    async fullReport(userId) {
      const overview = await this.ownerOverview(userId);
      const agencies = await this.agenciesOverview(userId);
      const complaints = await this.complaintsOverview(userId);
      const health = await this.health(userId);
      return {
        generatedAt: new Date().toISOString(),
        overview,
        agenciesCount: agencies.length,
        openComplaints: complaints.listingReports.length + complaints.userReports.length,
        health,
      };
    },


    /** Gestion du logo. */
    async getLogo(userId) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const rows = await db.query("select value from ika_settings where key = 'platform_logo'");
      return { logoUrl: rows[0]?.value || "" };
    },
    async saveLogo(userId, logoUrl) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const url = String(logoUrl || "").trim().slice(0, 500);
      if (url && !LOGO_URL.test(url)) throw badRequest("Logo invalide : indiquez un chemin du site (/media/logo.png) ou une adresse https.");
      await db.query("insert into ika_settings (key, value) values ('platform_logo', $1) on conflict (key) do update set value = $1", [url]);
      await accounts.audit(userId, "LOGO_UPDATE", null, url.slice(0, 50));
      onSettingsChanged();
      return { logoUrl: url };
    },
    /** Newsletters. */
    async listNewsletters(userId) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const rows = await db.query(
        "select id, subject, status, recipients, failed, last_error, sent_at, created_at from ika_newsletters order by created_at desc limit 30"
      ).catch(() => []);
      return rows.map(r => ({ ...r, created_at: r.created_at?.toISOString?.(), sent_at: r.sent_at?.toISOString?.() }));
    },
    async createNewsletter(userId, input) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const id = "nl_" + Date.now().toString(36);
      const subject = String(input.subject || "").trim().slice(0, 120);
      const content = String(input.content || "").slice(0, 5000);
      if (!subject) throw new Error("Sujet obligatoire.");
      await db.query(
        "insert into ika_newsletters (id, subject, content, created_by) values ($1, $2, $3, $4)",
        [id, subject, content, userId]
      );
      await accounts.audit(userId, "NEWSLETTER_CREATE", null, subject);
      return { id, subject, status: "DRAFT" };
    },
    /**
     * Envoi RÉEL : jamais « SENT » sans e-mail parti. Exige un fournisseur e-mail configuré et des abonnés ayant consenti
     * (table ika_newsletter_optin). Sans l'un des deux, la newsletter reste en brouillon et l'erreur est explicite.
     */
    async sendNewsletter(userId, newsletterId) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      if (!sendEmail) throw badRequest("Envoi impossible : aucun fournisseur e-mail n'est configuré (EMAIL_PROVIDER). La newsletter reste en brouillon.");
      // Réservation : un seul envoi à la fois par newsletter (sent_at posé = en cours ou terminé).
      const claimed = await db.query(
        "update ika_newsletters set sent_at = now(), last_error = null where id = $1 and status = 'DRAFT' and sent_at is null returning id, subject, content",
        [newsletterId]
      );
      if (!claimed.length) throw badRequest("Newsletter introuvable, déjà envoyée ou envoi en cours.");
      const nl = claimed[0];
      const release = (message) => db.query("update ika_newsletters set sent_at = null, last_error = $2 where id = $1", [newsletterId, message]);
      const subscribers = await db.query(
        "select u.email from ika_newsletter_optin o join ika_users u on u.id = o.user_id order by o.opted_in_at limit 500"
      );
      if (!subscribers.length) {
        await release("Aucun abonné consentant.");
        throw badRequest("Aucun abonné consentant : la newsletter reste en brouillon.");
      }
      const footer = "\n\n—\nVous recevez ce message car vous avez accepté la newsletter d'Ika So. Pour ne plus la recevoir : Mon compte > Newsletter.";
      let sent = 0; let failed = 0;
      for (const { email } of subscribers) {
        try { await sendEmail({ to: email, subject: nl.subject, text: `${nl.content ?? ""}${footer}` }); sent += 1; }
        catch { failed += 1; }
      }
      if (!sent) {
        await release("Aucun e-mail n'a pu partir (fournisseur en erreur).");
        throw badRequest("Aucun e-mail n'a pu être envoyé : la newsletter reste en brouillon.");
      }
      await db.query("update ika_newsletters set status = 'SENT', recipients = $2, failed = $3 where id = $1", [newsletterId, sent, failed]);
      await accounts.audit(userId, "NEWSLETTER_SEND", null, `${newsletterId} envoyés=${sent} échecs=${failed}`);
      return { id: newsletterId, status: "SENT", recipients: sent, failed };
    },
    /** Consentement d'un compte à la newsletter (action de la personne elle-même, pas du personnel). */
    async setNewsletterOptIn(userId, on) {
      if (on) await db.query("insert into ika_newsletter_optin (user_id) values ($1) on conflict (user_id) do nothing", [userId]);
      else await db.query("delete from ika_newsletter_optin where user_id = $1", [userId]);
      return { subscribed: Boolean(on) };
    },
    async newsletterOptIn(userId) {
      const rows = await db.query("select 1 from ika_newsletter_optin where user_id = $1", [userId]);
      return { subscribed: rows.length > 0 };
    },
    /** Pages légales (CGU, confidentialité). */
    async getLegalPages(userId) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const keys = ["legal_cgu", "legal_privacy", "legal_mentions"];
      const rows = await db.query("select key, value from ika_settings where key = any($1)", [keys]);
      const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
      return {
        cgu: map.legal_cgu || "",
        privacy: map.legal_privacy || "",
        mentions: map.legal_mentions || "",
      };
    },
    async saveLegalPages(userId, input) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const allowed = {
        legal_cgu: String(input.cgu ?? "").slice(0, 10000),
        legal_privacy: String(input.privacy ?? "").slice(0, 10000),
        legal_mentions: String(input.mentions ?? "").slice(0, 5000),
      };
      for (const [k, v] of Object.entries(allowed)) {
        await db.query("insert into ika_settings (key, value) values ($1, $2) on conflict (key) do update set value = $2", [k, v]);
      }
      await accounts.audit(userId, "LEGAL_UPDATE", null, "cgu,privacy,mentions");
      onSettingsChanged();
      return this.getLegalPages(userId);
    },
    /** Paramètres SEO de base. */
    async getSeoSettings(userId) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const keys = ["seo_title", "seo_description", "seo_keywords"];
      const rows = await db.query("select key, value from ika_settings where key = any($1)", [keys]);
      const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
      return {
        title: map.seo_title || "Ika So – Immobilier au Mali",
        description: map.seo_description || "Maisons, appartements, terrains et locaux au Mali.",
        keywords: map.seo_keywords || "immobilier, mali, bamako, vente, location",
      };
    },
    async saveSeoSettings(userId, input) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const allowed = {
        seo_title: String(input.title ?? "").trim().slice(0, 120),
        seo_description: String(input.description ?? "").trim().slice(0, 300),
        seo_keywords: String(input.keywords ?? "").trim().slice(0, 200),
      };
      for (const [k, v] of Object.entries(allowed)) {
        if (v) await db.query("insert into ika_settings (key, value) values ($1, $2) on conflict (key) do update set value = $2", [k, v]);
      }
      await accounts.audit(userId, "SEO_UPDATE", null, "title,description,keywords");
      onSettingsChanged();
      return this.getSeoSettings(userId);
    },
    /** Envoi d'une notification collective (in-app). */
    async broadcastNotification(userId, { title, body, target = "ALL" } = {}) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const t = String(title || "").trim().slice(0, 120);
      const b = String(body || "").trim().slice(0, 500);
      if (!t || !b) throw new Error("Titre et message obligatoires.");
      let where = "account_status = 'ACTIVE'";
      if (target === "STAFF") where = "staff_role <> 'USER' and account_status = 'ACTIVE'";
      if (target === "AGENCIES") where = "agency_name is not null and account_status = 'ACTIVE'";
      const users = await db.query(`select user_id from ika_profiles where ${where} limit 500`);
      let sent = 0;
      for (const u of users) {
        await db.query(
          "insert into ika_notifications (id, user_id, kind, title, body) values ($1, $2, 'BROADCAST', $3, $4)",
          ["nt_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), u.user_id, t, b]
        );
        sent++;
      }
      await accounts.audit(userId, "BROADCAST", null, `${target} · ${sent} destinataires · ${t}`);
      return { sent, target, title: t };
    },

    /** Pipeline CRM complet (7 étapes). */
    async crmPipeline(userId) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const rows = await db.query(
        `select p.id, p.listing_id, p.contact_name, p.contact_phone, p.stage, p.note, p.updated_at, l.title
         from ika_crm_pipeline p
         left join ika_listings l on l.id = p.listing_id
         order by p.updated_at desc limit 100`
      ).catch(() => []);
      const counts = await db.query(
        "select stage, count(*)::int as n from ika_crm_pipeline group by stage"
      ).catch(() => []);
      return {
        items: rows.map(r => ({
          id: r.id, listingId: r.listing_id, title: r.title, name: r.contact_name,
          phone: r.contact_phone, stage: r.stage, note: r.note,
          updatedAt: r.updated_at?.toISOString?.()
        })),
        counts: Object.fromEntries(counts.map(r => [r.stage, r.n])),
      };
    },
    async createPipelineItem(userId, input) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const id = "pl_" + Date.now().toString(36);
      const stage = ["NEW","CONTACTED","VISIT_PLANNED","VISIT_DONE","NEGOTIATION","WON","LOST"].includes(input.stage) ? input.stage : "NEW";
      await db.query(
        `insert into ika_crm_pipeline (id, listing_id, contact_name, contact_phone, stage, note, created_by)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [id, input.listingId || null, String(input.name||"").slice(0,80), String(input.phone||"").slice(0,30), stage, String(input.note||"").slice(0,500), userId]
      );
      await accounts.audit(userId, "CRM_PIPELINE_CREATE", null, id);
      return { id, stage };
    },
    async updatePipelineStage(userId, itemId, stage) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const allowed = ["NEW","CONTACTED","VISIT_PLANNED","VISIT_DONE","NEGOTIATION","WON","LOST"];
      if (!allowed.includes(stage)) throw new Error("Étape invalide.");
      const rows = await db.query(
        "update ika_crm_pipeline set stage = $2, updated_at = now() where id = $1 returning id, stage",
        [itemId, stage]
      );
      if (!rows.length) throw new Error("Élément introuvable.");
      await accounts.audit(userId, "CRM_PIPELINE_STAGE", null, `${itemId} → ${stage}`);
      return rows[0];
    },


    /** Gestion des langues. */
    async getLanguages(userId) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const rows = await db.query("select code, label, active from ika_languages order by label").catch(() => []);
      return rows;
    },
    async toggleLanguage(userId, code) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      await db.query("update ika_languages set active = not active where code = $1", [code]);
      await accounts.audit(userId, "LANGUAGE_TOGGLE", null, code);
      onSettingsChanged();
      return { code, toggled: true };
    },
    /** Redirections. */
    async getRedirects(userId) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const rows = await db.query("select id, from_path, to_path, active from ika_redirects order by created_at desc limit 50").catch(() => []);
      return rows;
    },
    async createRedirect(userId, input) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const id = "rd_" + Date.now().toString(36);
      const from = trimPath(String(input.from || "").slice(0, 200));
      const to = trimPath(String(input.to || "").slice(0, 200));
      if (!from || !to) throw badRequest("Chemins source et cible obligatoires.");
      // Redirections internes seulement (pas d'adresse externe : ce serait une redirection ouverte exploitable pour l'hameçonnage).
      if (!SITE_PATH.test(from) || !SITE_PATH.test(to)) throw badRequest("Chemins invalides : ils doivent commencer par « / » (pas d'adresse complète, pas de paramètres).");
      if (from === "/" || from === "/admin.html" || from.startsWith("/api/") || from === "/api") throw badRequest("Cette adresse source ne peut pas être redirigée.");
      if (from === to) throw badRequest("La source et la cible sont identiques.");
      const loop = await db.query("select id from ika_redirects where from_path = $1 and active = true limit 1", [to]);
      if (loop.length) throw badRequest("La cible est déjà redirigée ailleurs : cela ferait une chaîne ou une boucle.");
      await db.query(
        "insert into ika_redirects (id, from_path, to_path) values ($1, $2, $3)",
        [id, from, to]
      );
      await accounts.audit(userId, "REDIRECT_CREATE", null, from);
      onSettingsChanged();
      return { id, from, to };
    },
    /** Gestion des catégories. */
    async getCategories(userId) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const rows = await db.query("select code, label, active from ika_categories order by label").catch(() => []);
      return rows;
    },
    async toggleCategory(userId, code) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      await db.query("update ika_categories set active = not active where code = $1", [code]);
      await accounts.audit(userId, "CATEGORY_TOGGLE", null, code);
      onSettingsChanged();
      return { code, toggled: true };
    },
    /** Analyse des tendances (prix médians, volumes). */
    async trends(userId, { days = 90 } = {}) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const byCategory = await db.query(
        `select category, count(*)::int as n,
                percentile_cont(0.5) within group (order by price)::float8 as median
         from ika_listings
         where status = 'PUBLISHED' and created_at > now() - ($1 || ' days')::interval and price > 0
         group by category order by n desc`, [days]
      );
      const byNeighborhood = await db.query(
        `select neighborhood, count(*)::int as n
         from ika_listings
         where status = 'PUBLISHED' and created_at > now() - ($1 || ' days')::interval
         group by neighborhood order by n desc limit 10`, [days]
      );
      return {
        period: days,
        byCategory: byCategory.map(r => ({ category: r.category, count: r.n, medianPrice: Math.round(r.median || 0) })),
        topNeighborhoods: byNeighborhood.map(r => ({ neighborhood: r.neighborhood, count: r.n })),
      };
    },
    /** Données pour graphiques (annonces par mois, contacts par jour). */
    async chartData(userId, { days = 30 } = {}) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const listings = await db.query(
        `select date_trunc('day', created_at)::date as day, count(*)::int as n
         from ika_listings where created_at > now() - ($1 || ' days')::interval
         group by 1 order by 1`, [days]
      );
      const contacts = await db.query(
        `select date_trunc('day', created_at)::date as day, count(*)::int as n
         from ika_contact_events where created_at > now() - ($1 || ' days')::interval
         group by 1 order by 1`, [days]
      ).catch(() => []);
      return {
        listings: listings.map(r => ({ day: r.day, n: r.n })),
        contacts: contacts.map(r => ({ day: r.day, n: r.n })),
      };
    },
    /** Pipeline CRM : mise à jour du statut d'une visite. */
    async updateVisitStatus(userId, visitId, status) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const allowed = ["PENDING", "ACCEPTED", "DECLINED", "CANCELLED"];
      if (!allowed.includes(status)) throw new Error("Statut invalide.");
      const rows = await db.query(
        "update ika_visit_requests set status = $2, answered_at = now() where id = $1 returning id, status",
        [visitId, status]
      );
      if (!rows.length) throw new Error("Visite introuvable.");
      await accounts.audit(userId, "CRM_VISIT_STATUS", null, `${visitId} → ${status}`);
      return rows[0];
    },



    /** Réclamations côté client. */
    async myComplaints(userId) {
      const rows = await db.query(
        `select r.id, r.listing_id, r.reason, r.status, r.created_at, r.resolution, l.title
         from ika_reports r left join ika_listings l on l.id = r.listing_id
         where r.reporter_id = $1 order by r.created_at desc limit 50`,
        [userId]
      );
      return rows.map(r => ({
        id: r.id, listingId: r.listing_id, title: r.title, reason: r.reason,
        status: r.status, resolution: r.resolution,
        createdAt: r.created_at?.toISOString?.()
      }));
    },
    async createMyComplaint(userId, input) {
      const id = "rp_" + Date.now().toString(36);
      const reason = String(input.reason || "").trim().slice(0, 200);
      const details = String(input.details || "").trim().slice(0, 1000);
      if (!reason) throw new Error("Motif obligatoire.");
      await db.query(
        "insert into ika_reports (id, reporter_id, listing_id, reason, details, status) values ($1, $2, $3, $4, $5, 'OPEN')",
        [id, userId, input.listingId || null, reason, details]
      );
      return { id, status: "OPEN" };
    },
    async myComplaintDetail(userId, reportId) {
      const reports = await db.query(
        "select id, listing_id, reason, details, status, resolution, created_at, resolved_at, closed_at from ika_reports where id = $1 and reporter_id = $2",
        [reportId, userId]
      );
      if (!reports.length) throw new Error("Réclamation introuvable.");
      // Le plaignant voit ses propres commentaires et les réponses que l'équipe a choisi de lui rendre visibles ; jamais les notes internes.
      const comments = await db.query(
        "select content, created_at, (author_id is distinct from $2) as from_team from ika_complaint_comments where report_id = $1 and (author_id = $2 or visible_to_complainant) order by created_at",
        [reportId, userId]
      );
      return {
        ...reports[0],
        created_at: reports[0].created_at?.toISOString?.(),
        resolved_at: reports[0].resolved_at?.toISOString?.(),
        closed_at: reports[0].closed_at?.toISOString?.(),
        comments: comments.map(c => ({ content: c.content, at: c.created_at?.toISOString?.(), fromTeam: Boolean(c.from_team) })),
      };
    },
    async addMyComment(userId, reportId, content) {
      const reports = await db.query("select id from ika_reports where id = $1 and reporter_id = $2", [reportId, userId]);
      if (!reports.length) throw new Error("Réclamation introuvable.");
      const id = newId("cc");
      const text = String(content || "").trim().slice(0, 1000);
      if (!text) throw new Error("Commentaire vide.");
      await db.query(
        "insert into ika_complaint_comments (id, report_id, author_id, content) values ($1, $2, $3, $4)",
        [id, reportId, userId, text]
      );
      return { id };
    },
    /** Workflow riche des réclamations. */
    async getComplaint(userId, reportId) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const reports = await db.query(
        `select r.*, l.title from ika_reports r left join ika_listings l on l.id = r.listing_id where r.id = $1`,
        [reportId]
      );
      if (!reports.length) throw new Error("Réclamation introuvable.");
      const comments = await db.query(
        "select id, author_id, content, visible_to_complainant, created_at from ika_complaint_comments where report_id = $1 order by created_at",
        [reportId]
      ).catch(() => []);
      return {
        ...reports[0],
        created_at: reports[0].created_at?.toISOString?.(),
        resolved_at: reports[0].resolved_at?.toISOString?.(),
        closed_at: reports[0].closed_at?.toISOString?.(),
        comments: comments.map(c => ({ ...c, created_at: c.created_at?.toISOString?.() })),
      };
    },
    async assignComplaint(userId, reportId, assigneeId) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const rows = await db.query(
        "update ika_reports set assigned_to = $2, status = case when status = 'OPEN' then 'IN_PROGRESS' else status end where id = $1 returning id, assigned_to, status",
        [reportId, assigneeId || null]
      );
      if (!rows.length) throw new Error("Réclamation introuvable.");
      await accounts.audit(userId, "COMPLAINT_ASSIGN", null, `${reportId} → ${assigneeId}`);
      return rows[0];
    },
    /** Note interne par défaut. Elle n'est visible du plaignant que si l'équipe le demande explicitement (visibleToComplainant === true). */
    async addComplaintComment(userId, reportId, content, visibleToComplainant = false) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const id = newId("cc");
      const visible = visibleToComplainant === true;
      const text = String(content || "").trim().slice(0, 1000);
      if (!text) throw new Error("Commentaire vide.");
      await db.query(
        "insert into ika_complaint_comments (id, report_id, author_id, content, visible_to_complainant) values ($1, $2, $3, $4, $5)",
        [id, reportId, userId, text, visible]
      );
      await accounts.audit(userId, "COMPLAINT_COMMENT", null, `${reportId} ${visible ? "visible du plaignant" : "note interne"}`);
      return { id, content: text, visibleToComplainant: visible };
    },
    async closeComplaint(userId, reportId) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const rows = await db.query(
        "update ika_reports set status = 'CLOSED', closed_at = now() where id = $1 and status in ('RESOLVED', 'DISMISSED') returning id, status",
        [reportId]
      );
      if (!rows.length) throw new Error("Réclamation non résolue ou introuvable.");
      await accounts.audit(userId, "COMPLAINT_CLOSE", null, reportId);
      return rows[0];
    },
    /** Workflow des réclamations. */
    async resolveComplaint(userId, reportId, resolution) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const rows = await db.query(
        `update ika_reports set status = 'RESOLVED', resolution = $2, resolved_at = now(), assigned_to = $3
         where id = $1 returning id, status`,
        [reportId, String(resolution || "").slice(0, 500), userId]
      );
      if (!rows.length) throw new Error("Réclamation introuvable.");
      await accounts.audit(userId, "COMPLAINT_RESOLVE", null, reportId);
      return rows[0];
    },
    /** Alertes d'incident. */
    async listIncidents(userId) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const rows = await db.query(
        "select id, kind, severity, message, resolved, created_at from ika_incidents order by created_at desc limit 30"
      ).catch(() => []);
      return rows.map(r => ({ ...r, created_at: r.created_at?.toISOString?.() }));
    },
    async createIncident(userId, input) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const id = "inc_" + Date.now().toString(36);
      const kind = ["DB","PAYMENT","STORAGE","ERROR","OTHER"].includes(input.kind) ? input.kind : "OTHER";
      const severity = ["INFO","WARNING","CRITICAL"].includes(input.severity) ? input.severity : "WARNING";
      const message = String(input.message || "").trim().slice(0, 300);
      if (!message) throw new Error("Message obligatoire.");
      await db.query(
        "insert into ika_incidents (id, kind, severity, message) values ($1, $2, $3, $4)",
        [id, kind, severity, message]
      );
      await accounts.audit(userId, "INCIDENT_CREATE", null, id);
      return { id, kind, severity };
    },
    async resolveIncident(userId, incidentId) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      await db.query("update ika_incidents set resolved = true where id = $1", [incidentId]);
      await accounts.audit(userId, "INCIDENT_RESOLVE", null, incidentId);
      return { id: incidentId, resolved: true };
    },
    /** Vue des réclamations / signalements. */
    async complaintsOverview(userId) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const reports = await db.query(
        `select r.id, r.listing_id, r.reason, r.status, r.created_at, l.title
         from ika_reports r left join ika_listings l on l.id = r.listing_id
         where r.status in ('OPEN', 'IN_PROGRESS') order by r.created_at desc limit 50`
      );
      const userReports = await db.query(
        `select id, reporter_id, reported_id, reason, status, created_at
         from ika_user_reports where status = 'OPEN' order by created_at desc limit 50`
      );
      return {
        listingReports: reports.map(r => ({ ...r, created_at: r.created_at?.toISOString?.() })),
        userReports: userReports.map(r => ({ ...r, created_at: r.created_at?.toISOString?.() })),
      };
    },

    /**
     * Sauvegarde automatique (scheduler) : produit un vrai fichier pg_dump vérifié, puis journalise le résultat réel.
     * Un échec est journalisé (FAILED) ET ouvre un incident CRITICAL : plus jamais de « sauvegarde » qui n'a rien sauvegardé.
     * `force` : déclenchement manuel, sans la protection contre les doublons (plusieurs instances / redémarrages).
     */
    async autoBackup({ force = false } = {}) {
      if (!force) {
        const recent = await db.query("select id from ika_backup_log where auto = true and status = 'OK' and created_at > now() - interval '20 hours' limit 1");
        if (recent.length) return { skipped: true, reason: "Une sauvegarde automatique réussie date de moins de 20 heures." };
      }
      const id = "bk_auto_" + Date.now().toString(36);
      let result = null; let failure = null;
      if (!backup) failure = "Sauvegarde non configurée sur ce serveur.";
      else { try { result = await backup.backup(); } catch (error) { failure = String(error?.message ?? error).slice(0, 300); } }
      if (result) {
        await db.query(
          "insert into ika_backup_log (id, kind, note, auto, status, file_name, size_bytes, sha256, verified_at) values ($1, 'AUTO', 'Sauvegarde automatique', true, 'OK', $2, $3, $4, now())",
          [id, result.fileName, result.sizeBytes, result.sha256]
        );
        return { id, kind: "AUTO", status: "OK", fileName: result.fileName, sizeBytes: result.sizeBytes, sha256: result.sha256 };
      }
      await db.query(
        "insert into ika_backup_log (id, kind, note, auto, status, error) values ($1, 'AUTO', 'Sauvegarde automatique en échec', true, 'FAILED', $2)",
        [id, failure]
      );
      const message = "Sauvegarde automatique en échec";
      const open = await db.query("select id from ika_incidents where kind = 'DB' and message = $1 and resolved = false limit 1", [message]);
      if (!open.length) {
        await db.query(
          "insert into ika_incidents (id, kind, severity, message, auto) values ($1, 'DB', 'CRITICAL', $2, true)",
          ["inc_auto_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), message]
        );
      }
      return { id, kind: "AUTO", status: "FAILED", error: failure };
    },
    /** Déclenchement manuel (route HTTP) : SUPERADMIN uniquement, journalisé. */
    async autoBackupNow(userId) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const out = await this.autoBackup({ force: true });
      await accounts.audit(userId, "BACKUP_AUTO_MANUAL", null, `${out.id} ${out.status}`);
      return out;
    },
    /** Contrôle d'intégrité d'une sauvegarde déjà faite (fichier présent, empreinte inchangée, archive lisible). Ce n'est PAS une restauration. */
    async verifyBackup(userId, backupId) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const rows = await db.query("select id, file_name from ika_backup_log where id = $1", [backupId]);
      if (!rows.length) throw notFound("Sauvegarde introuvable.");
      if (!rows[0].file_name) throw badRequest("Cette ligne est une simple note : aucun fichier à vérifier.");
      if (!backup) throw badRequest("Vérification indisponible : sauvegarde non configurée sur ce serveur.");
      const check = await backup.verify(rows[0].file_name);
      if (check.ok) await db.query("update ika_backup_log set verified_at = now(), status = 'OK', error = null where id = $1", [backupId]);
      else await db.query("update ika_backup_log set status = 'FAILED', error = $2 where id = $1", [backupId, String(check.reason).slice(0, 300)]);
      await accounts.audit(userId, "BACKUP_VERIFY", null, `${backupId} ${check.ok ? "ok" : "échec"}`);
      return { id: backupId, ok: check.ok, reason: check.reason ?? null };
    },
    async autoCheckIncidentsNow(userId) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const out = await this.autoCheckIncidents();
      await accounts.audit(userId, "INCIDENTS_CHECK_MANUAL", null, String(out.created));
      return out;
    },
    /** Vérification automatique des incidents. */
    async autoCheckIncidents() {
      const incidents = [];
      // Base de données
      const dbOk = await db.query("select 1 as ok").then(() => true).catch(() => false);
      if (!dbOk) {
        incidents.push({ kind: "DB", severity: "CRITICAL", message: "Base de données inaccessible" });
      }
      // Paiements en attente depuis plus de 3 jours
      const pending = await db.query(
        "select count(*)::int as n from ika_payments where status = 'PENDING' and created_at < now() - interval '3 days'"
      );
      if ((pending[0]?.n ?? 0) > 5) {
        incidents.push({ kind: "PAYMENT", severity: "WARNING", message: `${pending[0].n} paiements en attente depuis plus de 3 jours` });
      }
      // Signalements ouverts nombreux
      const reports = await db.query("select count(*)::int as n from ika_reports where status = 'OPEN'");
      if ((reports[0]?.n ?? 0) > 10) {
        incidents.push({ kind: "OTHER", severity: "WARNING", message: `${reports[0].n} signalements ouverts` });
      }
      // Créer les incidents qui n'existent pas déjà (non résolus)
      for (const inc of incidents) {
        const exists = await db.query(
          "select id from ika_incidents where kind = $1 and message = $2 and resolved = false limit 1",
          [inc.kind, inc.message]
        );
        if (!exists.length) {
          const id = "inc_auto_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
          await db.query(
            "insert into ika_incidents (id, kind, severity, message, auto) values ($1, $2, $3, $4, true)",
            [id, inc.kind, inc.severity, inc.message]
          );
        }
      }
      return { checked: true, created: incidents.length };
    },
    /** Démarre le scheduler (sauvegarde toutes les 24 h, vérification toutes les 15 min). Minuteries « unref » : elles n'empêchent pas l'arrêt du processus. */
    startScheduler() {
      const keep = (timer) => { timer?.unref?.(); return timer; };
      keep(setInterval(() => this.autoBackup().catch(() => {}), 24 * 60 * 60 * 1000));
      keep(setInterval(() => this.autoCheckIncidents().catch(() => {}), 15 * 60 * 1000));
      // Première vérification au démarrage ; la sauvegarde du jour démarre peu après si aucune n'a réussi dans les 20 dernières heures.
      keep(setTimeout(() => this.autoCheckIncidents().catch(() => {}), 5000));
      keep(setTimeout(() => this.autoBackup().catch(() => {}), 60_000));
      return { started: true };
    },
    /** Journal des sauvegardes. */
    async listBackups(userId) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const rows = await db.query("select id, kind, note, status, file_name, size_bytes, sha256, verified_at, error, created_at from ika_backup_log order by created_at desc limit 30");
      return rows.map(r => ({ ...r, created_at: r.created_at?.toISOString?.(), verified_at: r.verified_at?.toISOString?.() ?? null }));
    },
    /** Simple NOTE dans le journal (statut LOGGED) : aucun fichier n'est créé. Pour une vraie copie, voir autoBackup. */
    async logBackup(userId, note = "Sauvegarde manuelle") {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const id = "bk_" + Date.now().toString(36);
      await db.query(
        "insert into ika_backup_log (id, kind, note, created_by) values ($1, 'MANUAL', $2, $3)",
        [id, String(note).slice(0, 200), userId]
      );
      await accounts.audit(userId, "BACKUP_LOG", null, note);
      return { id, note };
    },
    /** Paramètres généraux de la plateforme (lecture / écriture SUPERADMIN). */
    async getSettings(userId) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const keys = ["platform_name", "contact_email", "contact_phone", "default_currency"];
      const rows = await db.query("select key, value from ika_settings where key = any($1)", [keys]);
      const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
      return {
        platformName: map.platform_name || "Ika So",
        contactEmail: map.contact_email || "",
        contactPhone: map.contact_phone || "",
        currency: map.default_currency || "XOF",
      };
    },
    async saveSettings(userId, input) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const allowed = {
        platform_name: String(input.platformName ?? "").trim().slice(0, 80),
        contact_email: String(input.contactEmail ?? "").trim().slice(0, 120),
        contact_phone: String(input.contactPhone ?? "").trim().slice(0, 30),
        default_currency: String(input.currency ?? "XOF").trim().slice(0, 8),
      };
      for (const [k, v] of Object.entries(allowed)) {
        if (v) await db.query("insert into ika_settings (key, value) values ($1, $2) on conflict (key) do update set value = $2", [k, v]);
      }
      await accounts.audit(userId, "SETTINGS_UPDATE", null, Object.keys(allowed).join(","));
      return this.getSettings(userId);
    },


    /** Marketing : campagnes et annonces sponsorisées. */
    async marketingOverview(userId) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const campaigns = await db.query(
        "select id, name, kind, status, starts_at, ends_at, listing_id, link_url from ika_campaigns order by created_at desc limit 30"
      ).catch(() => []);
      const featured = await db.query(
        `select id, title, neighborhood, featured_until
         from ika_listings
         where featured_until > now() and status = 'PUBLISHED'
         order by featured_until desc limit 20`
      );
      return {
        campaigns: campaigns.map(c => ({
          id: c.id, name: c.name, kind: c.kind, status: c.status, listingId: c.listing_id ?? null, linkUrl: c.link_url ?? null,
          startsAt: c.starts_at?.toISOString?.(), endsAt: c.ends_at?.toISOString?.()
        })),
        featured: featured.map(f => ({
          id: f.id, title: f.title, neighborhood: f.neighborhood,
          until: f.featured_until?.toISOString?.()
        })),
      };
    },
    async createCampaign(userId, input) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const id = "cp_" + Date.now().toString(36);
      const name = String(input.name || "").trim().slice(0, 80);
      const kind = CAMPAIGN_KINDS.includes(input.kind) ? input.kind : "PROMO";
      if (!name) throw badRequest("Nom de campagne obligatoire.");
      const f = await campaignFields(input);
      await db.query(
        `insert into ika_campaigns (id, name, kind, status, content, listing_id, image_url, link_url, cta_label, sort_order, starts_at, ends_at, created_by)
         values ($1, $2, $3, 'DRAFT', $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [id, name, kind, String(input.content || "").slice(0, 500), f.listingId, f.imageUrl, f.linkUrl, f.ctaLabel, f.sortOrder, f.startsAt, f.endsAt, userId]
      );
      await accounts.audit(userId, "CAMPAIGN_CREATE", null, name);
      return { id, name, kind, status: "DRAFT" };
    },
    /** Modifie une campagne non terminée (champs fournis seulement). */
    async updateCampaign(userId, campaignId, input) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const rows = await db.query("select id, name, kind, status from ika_campaigns where id = $1", [campaignId]);
      if (!rows.length) throw notFound("Campagne introuvable.");
      if (rows[0].status === "ENDED") throw badRequest("Une campagne terminée ne peut plus être modifiée.");
      const name = input.name === undefined ? rows[0].name : String(input.name || "").trim().slice(0, 80);
      if (!name) throw badRequest("Nom de campagne obligatoire.");
      const cur = await db.query("select content, listing_id, image_url, link_url, cta_label, sort_order, starts_at, ends_at from ika_campaigns where id = $1", [campaignId]);
      const merged = { content: cur[0].content, listingId: cur[0].listing_id, imageUrl: cur[0].image_url, linkUrl: cur[0].link_url, ctaLabel: cur[0].cta_label, sortOrder: cur[0].sort_order, startsAt: cur[0].starts_at, endsAt: cur[0].ends_at, ...input };
      const f = await campaignFields(merged);
      if (rows[0].status === "ACTIVE") assertDiffusable(rows[0].kind, f);
      await db.query(
        `update ika_campaigns set name = $2, content = $3, listing_id = $4, image_url = $5, link_url = $6, cta_label = $7, sort_order = $8, starts_at = $9, ends_at = $10 where id = $1`,
        [campaignId, name, String(merged.content || "").slice(0, 500), f.listingId, f.imageUrl, f.linkUrl, f.ctaLabel, f.sortOrder, f.startsAt, f.endsAt]
      );
      await accounts.audit(userId, "CAMPAIGN_UPDATE", null, name);
      return { id: campaignId, name };
    },
    /** Change l'état : DRAFT → ACTIVE, ACTIVE ⇄ PAUSED, tout → ENDED (définitif). Une SPONSORED active doit être diffusable. */
    async setCampaignStatus(userId, campaignId, status) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      if (!CAMPAIGN_STATUSES.includes(status)) throw badRequest("Statut invalide.");
      const rows = await db.query("select id, name, kind, status, listing_id, image_url, link_url from ika_campaigns where id = $1", [campaignId]);
      if (!rows.length) throw notFound("Campagne introuvable.");
      const c = rows[0];
      if (c.status === "ENDED") throw badRequest("Une campagne terminée ne peut pas être réactivée : créez-en une nouvelle.");
      if (status === "DRAFT" && c.status !== "DRAFT") throw badRequest("Une campagne lancée ne revient pas en brouillon : mettez-la en pause.");
      if (status === "ACTIVE") assertDiffusable(c.kind, { listingId: c.listing_id, imageUrl: c.image_url, linkUrl: c.link_url });
      await db.query("update ika_campaigns set status = $2 where id = $1", [campaignId, status]);
      await accounts.audit(userId, "CAMPAIGN_" + status, null, c.name);
      return { id: campaignId, status };
    },
    /**
     * PUBLIC (sans compte) : campagnes SPONSORED actives dans leur fenêtre de dates.
     * Une campagne liée à une annonce n'est servie que si l'annonce est encore publiée et visible ; sinon elle est ignorée.
     */
    async publicSponsored() {
      const campaigns = await db.query(
        `select id, name, content, listing_id, image_url, link_url, cta_label
         from ika_campaigns
         where kind = 'SPONSORED' and status = 'ACTIVE'
           and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())
         order by sort_order asc, created_at desc limit 12`
      );
      const ids = [...new Set(campaigns.map((c) => c.listing_id).filter(Boolean))];
      const cards = new Map();
      if (ids.length) {
        const rows = await db.query(
          `select ${LISTING_COLUMNS} from ika_listings
           where id = any($1::text[]) and status = 'PUBLISHED' and visibility <> 'HIDDEN' and (expires_at is null or expires_at > now())`,
          [ids]
        );
        for (const r of rows) cards.set(r.id, toCard(r));
      }
      const out = [];
      for (const c of campaigns) {
        const listing = c.listing_id ? cards.get(c.listing_id) ?? null : null;
        if (c.listing_id && !listing) continue;
        out.push({
          id: c.id, name: c.name, text: c.content || "",
          imageUrl: c.image_url || listing?.imageUrl || "",
          linkUrl: c.link_url || (listing ? `#/annonce/${encodeURIComponent(listing.id)}` : ""),
          ctaLabel: c.cta_label || "Découvrir",
          listing,
        });
      }
      return out;
    },
    /** PUBLIC : nom de la plateforme et coordonnées de contact (trois réglages, rien d'autre). */
    async publicPlatform() {
      const rows = await db.query("select key, value from ika_settings where key = any($1)", [["platform_name", "contact_email", "contact_phone"]]);
      const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      return { platformName: map.platform_name || "Ika So", contactEmail: map.contact_email || "", contactPhone: map.contact_phone || "" };
    },
    /** PUBLIC : publicités latérales actives pour un placement (home | annonces | both). */
    async publicSidebar(placement = "home") {
      const rows = await db.query(
        `select id, name, content, image_url, link_url, cta_label
         from ika_campaigns
         where kind = 'SIDEBAR' and status = 'ACTIVE'
           and (placement = $1 or placement = 'both')
           and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())
         order by sort_order asc, created_at desc limit 6`,
        [placement]
      );
      return rows.map((r) => ({
        id: r.id, name: r.name, text: r.content || "",
        imageUrl: r.image_url || "", linkUrl: r.link_url || "#",
        ctaLabel: r.cta_label || "Découvrir",
      }));
    },
    /** Surveillance avancée. */
    async advancedMonitoring(userId) {
      const base = await this.health(userId);
      const mem = process.memoryUsage();
      const recentAudit = await db.query(
        "select action, created_at from ika_audit order by created_at desc limit 10"
      );
      const recentErrors = await db.query(
        "select count(*)::int as n from ika_audit where action like '%ERROR%' or action like '%FAIL%' and created_at > now() - interval '24 hours'"
      ).catch(() => [{ n: 0 }]);
      const pendingPayments = await db.query(
        "select count(*)::int as n from ika_payments where status = 'PENDING' and created_at > now() - interval '7 days'"
      );
      const openReports = await db.query(
        "select count(*)::int as n from ika_reports where status = 'OPEN'"
      );
      return {
        ...base,
        memory: {
          rss: Math.round(mem.rss / 1024 / 1024),
          heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
          heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
        },
        recentAudit: recentAudit.map(r => ({
          action: r.action,
          at: r.created_at?.toISOString?.()
        })),
        pendingPayments7d: pendingPayments[0]?.n ?? 0,
        openReports: openReports[0]?.n ?? 0,
        nodeVersion: process.version,
      };
    },
    /** Santé technique basique. */
    async health(userId) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const dbOk = await db.query("select 1 as ok").then(() => true).catch(() => false);
      const counts = await db.query(
        `select
           (select count(*)::int from ika_listings) as listings,
           (select count(*)::int from ika_users) as users,
           (select count(*)::int from stored_files) as files`
      );
      return {
        database: dbOk ? "ok" : "error",
        listings: counts[0]?.listings ?? 0,
        users: counts[0]?.users ?? 0,
        files: counts[0]?.files ?? 0,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      };
    },
    /** Vue des agences / annonceurs vérifiés. */
    async agenciesOverview(userId) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const rows = await db.query(
        `select p.user_id, p.full_name, p.agency_name, p.agency_verified_at, p.account_status,
                (select count(*)::int from ika_listings l where l.owner_id = p.user_id and l.status = 'PUBLISHED') as published
         from ika_profiles p
         where p.agency_name is not null or p.agency_verified_at is not null
         order by p.agency_verified_at desc nulls last, p.full_name
         limit 100`
      );
      return rows.map(r => ({
        userId: r.user_id,
        name: r.full_name,
        agency: r.agency_name,
        verifiedAt: r.agency_verified_at?.toISOString?.() ?? null,
        status: r.account_status,
        published: r.published,
      }));
    },
    /** Export CSV des annonces (résumé). */
    async listingsReportCsv(userId) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const rows = await db.query(
        `select id, title, neighborhood, transaction_type, category, price, status, created_at
         from ika_listings order by created_at desc limit 500`
      );
      const lines = ["id,title,neighborhood,transaction,category,price,status,created_at"];
      for (const r of rows) {
        const title = String(r.title || "").replace(/"/g, '""');
        lines.push(`"${r.id}","${title}","${r.neighborhood || ""}","${r.transaction_type || ""}","${r.category || ""}",${r.price || 0},"${r.status}","${r.created_at?.toISOString?.() || ""}"`);
      }
      return lines.join("\n");
    },
    /** Liste des contacts et visites récents (CRM basique) pour le personnel. */
    async crmOverview(userId, { limit = 50 } = {}) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const contacts = await db.query(
        `select c.id, c.listing_id, c.kind, c.created_at, l.title, l.neighborhood
         from ika_contact_events c
         left join ika_listings l on l.id = c.listing_id
         order by c.created_at desc limit $1`,
        [Math.min(Number(limit) || 50, 200)]
      );
      const visits = await db.query(
        `select v.id, v.listing_id, v.status, v.proposed_at, v.created_at, l.title
         from ika_visit_requests v
         left join ika_listings l on l.id = v.listing_id
         order by v.created_at desc limit $1`,
        [Math.min(Number(limit) || 50, 200)]
      );
      return {
        contacts: contacts.map(r => ({ ...r, created_at: r.created_at?.toISOString?.() ?? r.created_at })),
        visits: visits.map(r => ({ ...r, created_at: r.created_at?.toISOString?.() ?? r.created_at, proposed_at: r.proposed_at?.toISOString?.() ?? r.proposed_at })),
      };
    },
    /** Export CSV simple de l'overview propriétaire. */
    async ownerExportCsv(userId) {
      const data = await this.ownerOverview(userId);
      const lines = ["section,indicateur,valeur"];
      for (const [section, obj] of Object.entries(data)) {
        if (section === "generatedAt") continue;
        for (const [k, v] of Object.entries(obj)) lines.push(`${section},${k},${v}`);
      }
      lines.push(`meta,generatedAt,${data.generatedAt}`);
      return lines.join("\n");
    },
    /** Vue synthétique pour le Owner Control Center (données réelles uniquement). */
    async ownerOverview(userId) {
      await accounts.requireStaff(userId, "SUPERADMIN");
      const q = async (sql) => (await db.query(sql))[0]?.n ?? 0;
      const listings = {
        total: await q("select count(*)::int as n from ika_listings"),
        published: await q("select count(*)::int as n from ika_listings where status = 'PUBLISHED'"),
        pending: await q("select count(*)::int as n from ika_listings where status = 'PENDING'"),
        rejected: await q("select count(*)::int as n from ika_listings where status = 'REJECTED'"),
        archived: await q("select count(*)::int as n from ika_listings where status = 'ARCHIVED'"),
        sale: await q("select count(*)::int as n from ika_listings where transaction_type = 'Vente' and status = 'PUBLISHED'"),
        rent: await q("select count(*)::int as n from ika_listings where transaction_type = 'Location' and status = 'PUBLISHED'"),
      };
      const users = {
        total: await q("select count(*)::int as n from ika_users"),
        active: await q("select count(*)::int as n from ika_profiles where account_status = 'ACTIVE'"),
        restricted: await q("select count(*)::int as n from ika_profiles where account_status = 'RESTRICTED'"),
        staff: await q("select count(*)::int as n from ika_profiles where staff_role <> 'USER'"),
        superadmins: await q("select count(*)::int as n from ika_profiles where staff_role = 'SUPERADMIN' and account_status = 'ACTIVE'"),
      };
      const activity = {
        contacts7d: await q("select count(*)::int as n from ika_contact_events where created_at > now() - interval '7 days'"),
        visitsPending: await q("select count(*)::int as n from ika_visit_requests where status = 'PENDING'"),
        reportsOpen: await q("select count(*)::int as n from ika_reports where status = 'OPEN'"),
      };
      const finance = {
        paymentsPaid: await q("select count(*)::int as n from ika_payments where status = 'PAID'"),
        paymentsPending: await q("select count(*)::int as n from ika_payments where status = 'PENDING'"),
        amountPaid: (await db.query("select coalesce(sum(amount_xof),0)::bigint as n from ika_payments where status = 'PAID'"))[0]?.n ?? 0,
      };
      return { listings, users, activity, finance, generatedAt: new Date().toISOString() };
    },
  };
}

function planDaysFrom(from, to) {
  const out = [];
  for (let t = new Date(`${from}T00:00:00Z`).getTime(); t <= new Date(`${to}T00:00:00Z`).getTime(); t += DAY_MS) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}
