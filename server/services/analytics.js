/**
 * Émission des événements analytiques. Interrupteur éteint par défaut : il faut ANALYTICS_ENABLED=true (environnement)
 * ET le réglage analytics_enabled = 'true' (base). Éteint : aucune écriture, aucune requête supplémentaire (l'environnement est lu en mémoire).
 * La collecte ne doit jamais casser une action : tout échec est avalé et compté. Voir ARCHITECTURE_ANALYTICS.md.
 */
import { buildEvent, shouldTrack } from "../lib/analytics-events.js";
import { newId } from "../lib/security.js";

const SETTING_TTL_MS = 60_000;
/** Version du texte du consentement affiché à l'écran (à changer quand le juriste valide le texte final). */
export const CONSENT_TEXT_VERSION = "stats-2026-11-06-provisoire";
const CONSENT_CACHE_MAX = 5000;

export function createAnalytics({ db, config, logger = null, clock = () => new Date() }) {
  const stats = { recorded: 0, skipped: 0, failed: 0 };
  const consent = new Map(); // userId -> { at, accepted } ; borné
  let cache = null; // { at, pending } : la requête en cours est partagée, pas de rafale vers la base

  function settingOn() {
    const t = clock().getTime();
    if (!cache || t - cache.at >= SETTING_TTL_MS) {
      const pending = db.query("select value from ika_settings where key = 'analytics_enabled'").then((rows) => rows[0]?.value === "true");
      cache = { at: t, pending };
      pending.catch(() => { if (cache?.pending === pending) cache = null; }); // un échec n'est pas mis en mémoire
    }
    return cache.pending;
  }

  /** Sans consentement enregistré (ou refus), l'action est comptée SANS identifiant de compte. */
  async function consentOf(userId) {
    const t = clock().getTime();
    const hit = consent.get(userId);
    if (hit && t - hit.at < SETTING_TTL_MS) return hit.accepted;
    const rows = await db.query("select accepted from ika_analytics_consent where user_id = $1", [userId]);
    const accepted = rows[0]?.accepted === true;
    if (consent.size >= CONSENT_CACHE_MAX) consent.clear();
    consent.set(userId, { at: t, accepted });
    return accepted;
  }

  async function record(type, fields, req) {
    const headers = req?.headers ?? {};
    if (!shouldTrack(headers)) { stats.skipped += 1; return; }
    if (!(await settingOn())) { stats.skipped += 1; return; }
    const owner = fields.userId ? String(fields.userId) : null;
    const attached = owner && (await consentOf(owner)) ? owner : null;
    const e = buildEvent(type, { ...fields, userId: attached }, { headers, host: headers.host, now: clock(), eventId: newId("ev") });
    await db.query(
      `insert into ika_analytics_events (event_id, event_type, occurred_at, user_id, visitor_id, session_id, country_code, listing_id, advertiser_id, agency_id, page_path, source, device_type, is_bot, metadata)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb) on conflict (event_id) do nothing`,
      [e.event_id, e.event_type, e.occurred_at, e.user_id, e.visitor_id, e.session_id, e.country_code, e.listing_id, e.advertiser_id, e.agency_id, e.page_path, e.source, e.device_type, e.is_bot, JSON.stringify(e.metadata)],
    );
    stats.recorded += 1;
  }

  return {
    /** Meilleur effort : ne lève jamais, n'attend personne. */
    emit(type, fields = {}, req = null) {
      if (!config?.analytics?.enabled) return;
      try {
        record(type, fields, req).catch((error) => { stats.failed += 1; logger?.warn?.("analytics_echec", { type, message: String(error?.message ?? error).slice(0, 200) }); });
      } catch (error) {
        stats.failed += 1;
        logger?.warn?.("analytics_echec", { type, message: String(error?.message ?? error).slice(0, 200) });
      }
    },
    /** Choix du titulaire. Refus : ses actions passées perdent leur identifiant de compte (elles restent comptées, anonymes). */
    async getConsent(userId) {
      const rows = await db.query("select accepted, text_version, decided_at from ika_analytics_consent where user_id = $1", [userId]);
      return { accepted: rows[0] ? rows[0].accepted === true : null, textVersion: CONSENT_TEXT_VERSION, collecting: Boolean(config?.analytics?.enabled) };
    },
    async setConsent(userId, accepted) {
      const yes = accepted === true;
      await db.transaction(async (tx) => {
        await tx.query(
          `insert into ika_analytics_consent (user_id, accepted, text_version) values ($1, $2, $3)
           on conflict (user_id) do update set accepted = $2, text_version = $3, decided_at = now()`,
          [userId, yes, CONSENT_TEXT_VERSION]);
        if (!yes) await tx.query("update ika_analytics_events set user_id = null where user_id = $1", [userId]);
      });
      consent.delete(String(userId));
      return { accepted: yes, textVersion: CONSENT_TEXT_VERSION, collecting: Boolean(config?.analytics?.enabled) };
    },
    /** État des deux interrupteurs (lecture directe du réglage, sans cache) : pour le centre de contrôle. */
    async status() {
      const rows = await db.query("select value from ika_settings where key = 'analytics_enabled'");
      return { environment: Boolean(config?.analytics?.enabled), setting: rows[0]?.value === "true" };
    },
    /** Compteurs de contrôle (jamais de contenu d'événement). */
    stats: () => ({ ...stats, enabledByEnvironment: Boolean(config?.analytics?.enabled) }),
  };
}
