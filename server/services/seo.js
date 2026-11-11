import { notFound } from "../lib/errors.js";
import { ZONES } from "../lib/places.js";
import { LISTING_COLUMNS, toCard } from "./cards.js";

const LIVE = "status = 'PUBLISHED' and visibility <> 'HIDDEN' and (expires_at is null or expires_at > now())";
const MIN_COMPARABLES = 3; // en dessous, un « repère de prix » serait trompeur : on ne l'affiche pas

export function createSeo(ctx, listings) {
  const { db } = ctx;

  async function benchmarks(zoneName) {
    const rows = await db.query(
      `select category, transaction_type, count(*)::int as n,
              percentile_cont(0.5) within group (order by price)::float8 as median_price,
              (percentile_cont(0.5) within group (order by price::float8 / surface_m2) filter (where surface_m2 > 0))::float8 as median_m2,
              min(price)::float8 as low, max(price)::float8 as high
       from ika_listings where ${LIVE} and ($1::text is null or neighborhood = $1)
       group by category, transaction_type having count(*) >= ${MIN_COMPARABLES}
       order by category, transaction_type`,
      [zoneName ?? null],
    );
    return rows.map((r) => ({
      category: r.category, transactionType: r.transaction_type, count: r.n,
      medianPrice: Math.round(r.median_price), medianPerM2: r.category === "Terrain" && r.median_m2 ? Math.round(r.median_m2) : null,
      low: Math.round(r.low), high: Math.round(r.high),
    }));
  }

  // Réglages saisis dans l'Owner Control et lus par le site public (SEO, logo, textes légaux, redirections).
  // Cache court (30 s) : une page publique ne fait pas 6 requêtes de plus à chaque affichage ; invalidé à l'enregistrement.
  const SITE_KEYS = ["seo_title", "seo_description", "seo_keywords", "platform_logo", "legal_cgu", "legal_privacy", "legal_mentions"];
  const SAFE_LOGO = /^(\/(?!\/)[^\s"'<>\\]*|https:\/\/[^\s"'<>\\]+)$/;
  const EMPTY_SITE = Object.freeze({ title: "", description: "", keywords: "", logoUrl: "", cgu: "", privacy: "", mentions: "", redirects: new Map() });
  let siteCache = { at: 0, value: null };
  async function siteSettings() {
    if (siteCache.value && Date.now() - siteCache.at < 30_000) return siteCache.value;
    try {
      const rows = await db.query("select key, value from ika_settings where key = any($1)", [SITE_KEYS]);
      const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      const reds = await db.query("select from_path, to_path from ika_redirects where active = true");
      const logo = String(map.platform_logo ?? "").trim();
      const value = {
        title: String(map.seo_title ?? "").trim(), description: String(map.seo_description ?? "").trim(), keywords: String(map.seo_keywords ?? "").trim(),
        logoUrl: SAFE_LOGO.test(logo) ? logo : "", // relu à l'affichage : une valeur ancienne ou altérée n'entre jamais dans la page
        cgu: String(map.legal_cgu ?? "").trim(), privacy: String(map.legal_privacy ?? "").trim(), mentions: String(map.legal_mentions ?? "").trim(),
        redirects: new Map(reds.map((r) => [r.from_path, r.to_path])),
      };
      siteCache = { at: Date.now(), value };
      return value;
    } catch {
      // Le site public ne doit jamais tomber parce que les réglages sont illisibles : dernière version connue, sinon valeurs par défaut.
      return siteCache.value ?? EMPTY_SITE;
    }
  }

  return {
    benchmarks,
    siteSettings,
    invalidateSite() { siteCache = { at: 0, value: siteCache.value }; },

    async zones() {
      const rows = await db.query(`select neighborhood, count(*)::int as n from ika_listings where ${LIVE} group by neighborhood`);
      const counts = new Map(rows.map((r) => [r.neighborhood, r.n]));
      return ZONES.map((z) => ({ name: z.name, count: counts.get(z.name) ?? 0 }));
    },

    async zonePage(zoneName) {
      const rows = await db.query(
        `select ${LISTING_COLUMNS} from ika_listings where ${LIVE} and neighborhood = $1
         order by (featured_until is not null and featured_until > now()) desc, published_at desc nulls last limit 48`,
        [zoneName],
      );
      return { listings: rows.map((r) => toCard(r)), benchmarks: await benchmarks(zoneName) };
    },

    async listingPage(id) {
      const card = await listings.getPublic(id);
      const similar = await listings.similarPublic(id).catch(() => []);
      const rows = await db.query("select updated_at, published_at from ika_listings where id = $1", [card.id]);
      return { card, similar, updatedAt: rows[0]?.updated_at ?? rows[0]?.published_at };
    },

    async agencies() {
      const rows = await db.query(
        `select p.user_id, p.agency_name, p.agency_verified_at,
                (select count(*)::int from ika_reviews r where r.advertiser_id = p.user_id and r.status = 'VISIBLE') as review_count,
                (select coalesce(round(avg(r.rating)::numeric, 1), 0)::float from ika_reviews r where r.advertiser_id = p.user_id and r.status = 'VISIBLE') as review_avg,
                (select count(*)::int from ika_listings l where l.owner_id = p.user_id and l.status = 'PUBLISHED' and l.visibility <> 'HIDDEN' and (l.expires_at is null or l.expires_at > now())) as listings
         from ika_profiles p where p.agency_verified_at is not null and p.account_status = 'ACTIVE' order by p.agency_name`,
      );
      return rows.map((r) => ({ id: r.user_id, name: r.agency_name, listings: r.listings, reviews: { count: r.review_count, average: r.review_avg } }));
    },

    async agency(userId) {
      const rows = await db.query(
        "select p.user_id, p.agency_name, (select count(*)::int from ika_reviews r where r.advertiser_id = p.user_id and r.status = 'VISIBLE') as review_count, (select coalesce(round(avg(r.rating)::numeric, 1), 0)::float from ika_reviews r where r.advertiser_id = p.user_id and r.status = 'VISIBLE') as review_avg from ika_profiles p where p.user_id = $1 and p.agency_verified_at is not null and p.account_status = 'ACTIVE'",
        [String(userId).slice(0, 80)],
      );
      if (!rows[0]) throw notFound("Agence introuvable.");
      const l = await db.query(`select ${LISTING_COLUMNS} from ika_listings where ${LIVE} and owner_id = $1 order by published_at desc nulls last limit 48`, [rows[0].user_id]);
      return { id: rows[0].user_id, name: rows[0].agency_name, listings: l.map((r) => toCard(r)), reviews: { count: rows[0].review_count, average: rows[0].review_avg } };
    },

    async sitemapEntries() {
      const l = await db.query(`select id, title, coalesce(updated_at, published_at) as at from ika_listings where ${LIVE} order by published_at desc nulls last limit 5000`);
      const a = await db.query("select user_id from ika_profiles where agency_verified_at is not null and account_status = 'ACTIVE'");
      const z = await this.zones();
      return { listings: l.map((r) => ({ id: r.id, title: r.title, at: r.at })), agencies: a.map((r) => r.user_id), zones: z.filter((x) => x.count > 0).map((x) => x.name) };
    },
  };
}
