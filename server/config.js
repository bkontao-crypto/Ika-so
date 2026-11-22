// Configuration lue depuis l'environnement. Aucun secret dans le code ni dans le dépôt.

/**
 * TRUST_PROXY : nombre de proxys de confiance devant l'application (1 sur Render, Railway, Fly…).
 * Express lit alors l'adresse client à la bonne position dans X-Forwarded-For, sans croire
 * un en-tête que le visiteur aurait forgé lui-même. « true » (confiance totale) reste accepté pour
 * compatibilité mais déconseillé : un client peut alors choisir lui-même son adresse.
 * Renvoie false (aucun proxy), un entier ≥ 1, ou true.
 */
export function parseTrustProxy(raw) {
  const value = String(raw ?? "").trim().toLowerCase();
  if (!value || value === "false" || value === "0") return false;
  if (value === "true") return true;
  if (/^[1-9][0-9]?$/.test(value)) return Number(value);
  throw new Error(`TRUST_PROXY invalide (« ${raw} ») : utilisez un nombre de proxys (ex. 1 sur Render), true ou false.`);
}

/** Lit la configuration. `env` est injectable pour les tests. */
/** Jeton Mapbox public (« pk. », trois segments, caractères de jeton). Tout le reste est écarté : { token: "", rejected: true }. */
export function parseMapboxToken(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return { token: "", rejected: false };
  return /^pk\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/.test(value) ? { token: value, rejected: false } : { token: "", rejected: true };
}

export function getConfig(env = process.env) {
  const get = (key, fallback = "") => {
    const value = env[key];
    return value && value.trim() ? value.trim() : fallback;
  };
  const production = get("NODE_ENV", "development") === "production";
  return {
    production,
    port: Number(get("PORT", "8080")),
    databaseUrl: get("DATABASE_URL"),
    // Derrière un proxy d'hébergeur : TRUST_PROXY=<nombre de sauts> (1 sur Render) pour lire la vraie adresse
    // (limitation de débit seulement, jamais stockée). Voir parseTrustProxy.
    trustProxy: parseTrustProxy(get("TRUST_PROXY")),
    trustProxyConfigured: Boolean(get("TRUST_PROXY")),
    // NODE_ENV tel que posé (vide si absent) : le serveur refuse de démarrer dans un mode ambigu.
    nodeEnv: get("NODE_ENV"),
    // Adresse publique du site (sans « / » final), utilisée dans le plan du site et les liens canoniques.
    publicUrl: get("PUBLIC_URL").replace(/\/+$/, ""),
    // Fond de carte Mapbox (étape 4 bis). MAPBOX_TOKEN = jeton PUBLIC « pk. » uniquement (il est envoyé au navigateur) ;
    // un jeton secret « sk. »/« tk. » est refusé et jamais exposé. Vide = carte locale seule, CSP inchangée.
    mapbox: parseMapboxToken(get("MAPBOX_TOKEN")),
    // Sauvegardes automatiques (pg_dump) : BACKUP_DIR = dossier HORS public, idéalement sur un disque persistant ; BACKUP_KEEP = nombre de fichiers gardés.
    backup: { dir: get("BACKUP_DIR", "backups"), keep: Math.max(1, Number(get("BACKUP_KEEP", "14")) || 14), dirConfigured: Boolean(get("BACKUP_DIR")) },
    // Collecte d'événements d'usage : ACTIVE par défaut (décision du propriétaire, 20 novembre 2026). Interrupteurs d'arrêt : ANALYTICS_ENABLED=false (environnement)
    // ou réglage analytics_enabled = 'false' (base). Un événement n'est rattaché à un compte que si la personne l'a accepté (inscription ou paramètres).
    analytics: { enabled: get("ANALYTICS_ENABLED") !== "false" },
    sms: {
      provider: get("SMS_PROVIDER"),
      accountSid: get("TWILIO_ACCOUNT_SID"),
      authToken: get("TWILIO_AUTH_TOKEN"),
      from: get("TWILIO_FROM"),
      // Le portail Infobip affiche l'adresse sans « https:// » : on l'ajoute si elle manque.
      infobipBaseUrl: (() => { const u = get("INFOBIP_BASE_URL").replace(/\/+$/, ""); return u && !/^https?:\/\//i.test(u) ? `https://${u}` : u; })(),
      infobipApiKey: get("INFOBIP_API_KEY"),
      infobipFrom: get("INFOBIP_FROM"),
    },
    // Connexion avec Google (OAuth 2.0, code d'autorisation côté serveur). Vide = bouton absent.
    // Adresse de retour à déclarer chez Google : PUBLIC_URL + /api/auth/google/callback
    google: (() => {
      const clientId = get("GOOGLE_CLIENT_ID");
      const clientSecret = get("GOOGLE_CLIENT_SECRET");
      const publicUrl = get("PUBLIC_URL").replace(/\/+$/, "");
      return { clientId, clientSecret, enabled: Boolean(clientId && clientSecret && publicUrl.startsWith("https://")), redirectUri: publicUrl ? `${publicUrl}/api/auth/google/callback` : "" };
    })(),
    // WhatsApp Business (Meta Cloud API) : secrets lus dans l'environnement, jamais dans le code. Vide = désactivé.
    whatsapp: {
      token: get("WHATSAPP_TOKEN"),
      phoneNumberId: get("WHATSAPP_PHONE_NUMBER_ID"),
      verifyToken: get("WHATSAPP_VERIFY_TOKEN"),
      appSecret: get("WHATSAPP_APP_SECRET"),
      apiVersion: get("WHATSAPP_API_VERSION", "v21.0"),
      // Modèle de message approuvé par Meta pour la décision Premium (sans variable) ; vide = envoi impossible.
      templatePremium: get("WHATSAPP_TEMPLATE_PREMIUM"),
      templateLanguage: get("WHATSAPP_TEMPLATE_LANGUAGE", "fr"),
    },
    // E-mail (alertes facultatives, désactivées par défaut) : « brevo » ou « resend ». Vide = aucun e-mail envoyé.
    email: {
      provider: get("EMAIL_PROVIDER"),
      from: get("EMAIL_FROM"),
      fromName: get("EMAIL_FROM_NAME") || "Ika So",
      brevoApiKey: get("BREVO_API_KEY"),
      resendApiKey: get("RESEND_API_KEY"),
    },
    // Paiements : tant que PAYMENT_PROVIDER est vide, ils sont désactivés. « fake » = démonstration, jamais en production.
    payments: {
      provider: get("PAYMENT_PROVIDER"), webhookSecret: get("PAYMENT_WEBHOOK_SECRET"),
      // Agrégateurs mobile money : « cinetpay » ou « paydunya ». Aucun n'est actif tant que PAYMENT_PROVIDER est vide.
      channels: get("PAYMENT_CHANNELS") || "MOBILE_MONEY",
      cinetpay: { apiKey: get("CINETPAY_API_KEY"), siteId: get("CINETPAY_SITE_ID") },
      paydunya: { masterKey: get("PAYDUNYA_MASTER_KEY"), privateKey: get("PAYDUNYA_PRIVATE_KEY"), token: get("PAYDUNYA_TOKEN"), mode: get("PAYDUNYA_MODE") === "live" ? "live" : "test" },
    },
    // Démonstration : affiche le code à l'écran. Jamais de badge « vérifié » dans ce mode.
    allowDemoOtp: !production || get("ALLOW_DEMO_OTP") === "true",
    // Premier inscrit = super administrateur. Actif hors production seulement, sauf BOOTSTRAP_ADMIN=true.
    // En production, BOOTSTRAP_ADMIN_EMAIL limite ce droit à une seule adresse (recommandé).
    bootstrapAdmin:
      get("BOOTSTRAP_ADMIN") === "true" || (!production && get("BOOTSTRAP_ADMIN") !== "false"),
    bootstrapAdminEmail: get("BOOTSTRAP_ADMIN_EMAIL").toLowerCase(),
  };
}

/** Vrai quand l'envoi SMS réel est entièrement configuré. Sans lui, aucun numéro n'est « vérifié ». */
export function smsConfigured(config) {
  const sms = config.sms;
  if (sms.provider === "twilio") return Boolean(sms.accountSid && sms.authToken && sms.from);
  if (sms.provider === "infobip") return Boolean(sms.infobipBaseUrl && sms.infobipApiKey && sms.infobipFrom);
  return false;
}

/** Vrai quand un fournisseur d'e-mail est entièrement configuré. */
export function emailConfigured(config) {
  const e = config.email;
  if (!e?.from) return false;
  if (e.provider === "brevo") return Boolean(e.brevoApiKey);
  if (e.provider === "resend") return Boolean(e.resendApiKey);
  return false;
}
