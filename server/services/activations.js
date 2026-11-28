// Centre des activations (Super Administrateur) : une seule page pour les interrupteurs EXISTANTS.
// Aucune règle nouvelle : chaque bascule passe par l'écriture du service concerné. La lecture n'écrit rien.
import { badRequest, conflict, notFound } from "../lib/errors.js";
import { POLICY_KEY, normalizePolicy } from "../lib/payment-policy.js";
import { CONSENT_SERVICES_KEY, normalizeConsentServices } from "../lib/consent-services.js";
import { emailConfigured, smsConfigured } from "../config.js";

const ACTION = "ACTIVATION_CHANGE";
const CUSTOMIZE = "#/customize";
const RULES = "#/rules";
const iso = (d) => (d instanceof Date ? d.toISOString() : d ?? null);

export const WITHOUT_SWITCH = Object.freeze(["Inscription (et sa fenêtre d’acceptation globale)", "Publication d’annonces", "Messagerie", "Commentaires", "Avis", "Favoris", "Visites",
  "Abonnements aux annonceurs", "Réclamations", "Partenaires", "Import d’annonces", "Demandes de mise à la une", "Sauvegarde automatique et contrôle des incidents"]);
export const WITHOUT_EFFECT = Object.freeze(["Modules « carte » et « WhatsApp » du réglage d’apparence : non reliés au site", "Langues et catégories : non lues par le site public"]);

export function createActivations({ db, config, accounts, superadminSettings, ruleExceptions, ownerCenter, starBadge, analytics, consentServices, moderationAudit }) {
  const whatsappReady = () => { const w = config?.whatsapp ?? {}; return Boolean(w.token && w.phoneNumberId && w.templatePremium); };
  const providerSet = () => Boolean(config?.payments?.provider);

  /* ---------- Écritures : toujours par le service d'origine, en conservant les autres champs ---------- */
  const setModule = (key) => async (actorId, on) => {
    const main = (await superadminSettings.get("main")) ?? {};
    await superadminSettings.set(actorId, "main", { ...main, modules: { ...(main.modules ?? {}), [key]: on } });
  };
  const setRule = (key) => (actorId, on) => ruleExceptions.saveOfficial(actorId, { [key]: on });

  const moduleOn = (main, key) => main?.modules?.[key] !== false;
  // Chaque interrupteur : lecture (read), écriture (write), éventuel motif qui empêche d'allumer (blocked).
  const SWITCHES = [
    { key: "crm", group: "Modules", label: "CRM", scope: "server", read: (s) => moduleOn(s.main, "crm"), write: setModule("crm"),
      off: "Les leads et les fonctions WhatsApp du CRM sont refusés. Les données sont conservées." },
    { key: "premium", group: "Modules", label: "Premium", scope: "server", read: (s) => moduleOn(s.main, "premium"), write: setModule("premium"),
      off: "Nouvelles demandes, achats et centre de contrôle fermés. La durée des abonnements en cours continue de courir." },
    { key: "discover", group: "Communauté et annonces", label: "Découvrir", scope: "server", read: (s) => s.rules.discoverEnabled, write: setRule("discoverEnabled"), screen: RULES,
      off: "La liste est vide et les publications sont refusées." },
    { key: "videoLinks", group: "Communauté et annonces", label: "Liens vidéo dans Découvrir", scope: "server", read: (s) => s.rules.discoverVideoLinks, write: setRule("discoverVideoLinks"), screen: RULES,
      off: "L’ajout de nouveaux liens vidéo est refusé." },
    { key: "alerts", group: "Communauté et annonces", label: "Alertes programmées", scope: "server", read: (s) => s.rules.alertsEnabled, write: setRule("alertsEnabled"), screen: RULES,
      off: "La création d’alertes et la détection de nouvelles correspondances s’arrêtent." },
    { key: "advertiserApplication", group: "Communauté et annonces", label: "Demande « Devenir annonceur » obligatoire", scope: "server", read: (s) => s.rules.advertiserApplicationRequired, write: setRule("advertiserApplicationRequired"), screen: RULES,
      off: "Attention : c’est un contrôle. Désactivé, tout compte peut publier sans cette demande." },
    { key: "onlinePayment", group: "Paiements et badges", label: "Paiement en ligne", scope: "server", screen: "#/payments", read: (s) => s.payment.onlineEnabled,
      write: async (actorId, on) => superadminSettings.set(actorId, POLICY_KEY, normalizePolicy({ ...normalizePolicy(await superadminSettings.get(POLICY_KEY)), onlineEnabled: on })),
      blocked: () => (providerSet() ? null : "Aucun fournisseur de paiement n’est configuré sur le serveur."),
      off: "Aucun paiement en ligne ne peut être démarré ; les demandes sont traitées à la main. Les paiements déjà lancés restent confirmés." },
    { key: "starBadge", group: "Paiements et badges", label: "Badge Étoile", scope: "server", screen: "#/trust", read: (s) => s.star.enabled,
      write: async (actorId, on) => starBadge.saveSettings(actorId, { ...(await starBadge.settings()), enabled: on }),
      off: "Les nouvelles démarches de badge sont fermées." },
    { key: "whatsappDecision", group: "Paiements et badges", label: "WhatsApp à la décision Premium", scope: "server", screen: RULES, read: (s) => s.rules.whatsappDecisionEnabled, write: setRule("whatsappDecisionEnabled"),
      blocked: () => (whatsappReady() ? null : "Jeton, numéro et modèle WhatsApp ne sont pas tous installés."),
      off: "La décision Premium n’est pas envoyée par WhatsApp." },
    { key: "analytics", group: "Mesure et sécurité", label: "Collecte d’audience", scope: "server", read: (s) => s.analytics.environment && s.analytics.setting,
      write: (actorId, on) => analytics.setSetting(on),
      blocked: (s) => (s.analytics.environment ? null : "Coupée par la variable ANALYTICS_ENABLED chez l’hébergeur."),
      off: "Plus aucun nouvel événement n’est écrit. Les événements existants restent. Avec plusieurs serveurs, compter jusqu’à une minute." },
    { key: "securityLog", group: "Mesure et sécurité", label: "Journal de connexions", scope: "server", read: (s) => s.securityLog.enabled, write: (actorId, on) => ownerCenter.setSecurityLog(actorId, on),
      off: "Connexions et échecs de connexion ne sont plus journalisés." },
    { key: "preferences", group: "Services chez le visiteur", label: "Mémorisation « Préférences »", scope: "browser", screen: CUSTOMIZE, read: (s) => s.consent.preferences.enabled,
      write: async (actorId, on) => {
        const current = normalizeConsentServices(await superadminSettings.get(CONSENT_SERVICES_KEY));
        await superadminSettings.set(actorId, CONSENT_SERVICES_KEY, { ...current, preferences: { enabled: on } });
        consentServices?.invalidate();
      },
      off: "Le service n’est plus proposé au visiteur." },
  ];

  async function snapshot(actorId) {
    const [main, rules, payment, star, analyticsState, securityLog, consent] = await Promise.all([
      superadminSettings.get("main"), ruleExceptions.official(), superadminSettings.get(POLICY_KEY), starBadge.settings(), analytics.status(),
      ownerCenter.securityLogStatus(actorId), superadminSettings.get(CONSENT_SERVICES_KEY)]);
    return { main, rules, payment: normalizePolicy(payment), star, analytics: analyticsState, securityLog, consent: normalizeConsentServices(consent) };
  }

  /** Éléments consultables seulement : leur réglage reste sur l'écran qui en porte les garde-fous. Jamais de valeur secrète. */
  async function readOnly(s) {
    const [offers] = await db.query("select count(*)::int as total, count(*) filter (where active)::int as active from ika_offers");
    const [boosts] = await db.query("select count(*)::int as total, count(*) filter (where active)::int as active from ika_boost_plans");
    const [mfaSetting] = await db.query("select value from ika_settings where key = 'mfa_required'");
    const pixels = Object.values(s.consent.marketing).filter((v) => v.enabled).length;
    const provider = (label, ok) => ({ label, state: ok ? "configured" : "missing" });
    return {
      elsewhere: [
        { label: "Offres Premium et mise à la une", value: `${offers.active} active(s) sur ${offers.total}`, screen: "#/payments" },
        { label: "Formules de boost", value: `${boosts.active} active(s) sur ${boosts.total}`, screen: "#/alerts" },
        { label: "Pixels marketing (Meta, Google, TikTok)", value: `${pixels} actif(s) — envoient des données à un tiers`, screen: CUSTOMIZE },
        { label: "Double authentification obligatoire", value: mfaSetting?.value === "true" ? "Activée" : "Désactivée", screen: "#/mfa" },
      ],
      providers: [
        provider("Connexion avec Google", config?.google?.enabled), provider("SMS", smsConfigured(config)), provider("E-mail", emailConfigured(config)),
        provider("WhatsApp (décision Premium)", whatsappReady()), provider("Fournisseur de paiement", providerSet()), provider("Carte Mapbox", config?.mapbox?.token),
      ],
    };
  }

  async function history() {
    const rows = await db.query(
      `select a.details, a.target_id, a.created_at, p.full_name from ika_moderation_audit a left join ika_profiles p on p.user_id = a.actor_id
        where a.action = $1 order by a.created_at desc limit 30`, [ACTION]);
    return rows.map((r) => ({ key: r.target_id, label: SWITCHES.find((x) => x.key === r.target_id)?.label ?? r.target_id, enabled: r.details?.to === true, by: r.full_name ?? "Compte supprimé", at: iso(r.created_at) }));
  }

  async function overview(actorId) {
    await accounts.requireStaff(actorId, "SUPERADMIN");
    const s = await snapshot(actorId);
    const switches = SWITCHES.map((x) => {
      const reason = x.blocked?.(s) ?? null;
      return { key: x.key, group: x.group, label: x.label, scope: x.scope, enabled: x.read(s) === true, blocked: reason, whenOff: x.off, screen: x.screen ?? null };
    });
    return { switches, ...(await readOnly(s)), withoutSwitch: WITHOUT_SWITCH, withoutEffect: WITHOUT_EFFECT, history: await history() };
  }

  return {
    overview,
    async set(actorId, key, enabled) {
      await accounts.requireStaff(actorId, "SUPERADMIN");
      const target = SWITCHES.find((x) => x.key === key);
      if (!target) throw notFound("Interrupteur inconnu.");
      if (typeof enabled !== "boolean") throw badRequest("Indiquez enabled : true ou false.");
      const s = await snapshot(actorId);
      const before = target.read(s) === true;
      if (before === enabled) return { key, enabled, changed: false };
      // Couper reste toujours possible ; seul l'allumage peut être empêché par une configuration manquante.
      const reason = target.blocked?.(s) ?? null;
      if (enabled && reason) throw conflict(reason);
      await target.write(actorId, enabled);
      await moderationAudit.log(actorId, { action: ACTION, targetType: "activation", targetId: key, details: { from: before, to: enabled } });
      return { key, enabled, changed: true };
    },
  };
}
