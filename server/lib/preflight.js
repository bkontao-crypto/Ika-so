// Contrôle de la configuration avant une mise en ligne. Fonction pure : testable sans serveur ni base.
// « bloquant » = ne pas ouvrir au public ; « attention » = possible mais à décider en connaissance de cause.

import { emailConfigured, smsConfigured } from "../config.js";

const isLocalHost = (host) => ["localhost", "127.0.0.1", "::1", ""].includes(host);

export function checkEnvironment(config, env = {}) {
  const out = [];
  const add = (level, code, message) => out.push({ level, code, message });
  const get = (k) => String(env[k] ?? "").trim();

  if (!config.production) {
    add("attention", "MODE_LOCAL", "NODE_ENV n'est pas « production » : ce contrôle vise la mise en ligne.");
    return out;
  }

  // Base de données
  if (!config.databaseUrl) add("bloquant", "DATABASE_URL", "DATABASE_URL est absent.");
  else {
    let url = null;
    try { url = new URL(config.databaseUrl); } catch { add("bloquant", "DATABASE_URL_FORME", "DATABASE_URL n'est pas une adresse valide."); }
    if (url && !isLocalHost(url.hostname) && !/sslmode=(require|verify-full|verify-ca)/.test(url.search)) {
      add("bloquant", "DATABASE_SSL", "La base est distante : ajoutez ?sslmode=require à DATABASE_URL (connexion chiffrée).");
    }
    if (url && isLocalHost(url.hostname)) {
      add("attention", "BASE_LOCALE", "NODE_ENV=production avec une base sur cette machine : normal seulement si PostgreSQL tourne sur le même serveur. Sur un poste de travail, utilisez NODE_ENV=development (sinon : cookie « Secure », SMS réels obligatoires, aucun administrateur automatique).");
    }
  }

  // Adresse publique
  if (!config.publicUrl) add("attention", "PUBLIC_URL", "PUBLIC_URL absent : plan du site et liens canoniques utiliseront l'adresse de la requête.");
  else if (!config.publicUrl.startsWith("https://")) add("bloquant", "PUBLIC_URL_HTTPS", "PUBLIC_URL doit commencer par https://.");

  // Proxy : sans lui, tous les visiteurs partagent les mêmes compteurs anti-abus.
  if (!config.trustProxyConfigured) add("bloquant", "TRUST_PROXY", "TRUST_PROXY absent : posez le nombre de proxys (1 sur Render), sinon le frein anti-abus est faussé.");
  else if (config.trustProxy === true) add("attention", "TRUST_PROXY_TOTAL", "TRUST_PROXY=true : un visiteur peut forger son adresse. Préférez un nombre (1).");

  // Démonstration interdite
  if (get("ALLOW_DEMO_OTP") === "true") add("bloquant", "DEMO_OTP", "ALLOW_DEMO_OTP=true affiche les codes SMS à l'écran : à retirer.");

  // SMS
  const sms = config.sms;
  if (sms.provider && !["twilio", "infobip"].includes(sms.provider)) add("bloquant", "SMS_INCONNU", `SMS_PROVIDER=${sms.provider} n'existe pas (twilio ou infobip).`);
  else if (!smsConfigured(config)) {
    if (sms.provider) add("bloquant", "SMS_INCOMPLET", `SMS_PROVIDER=${sms.provider} sans toutes ses clés : l'envoi des codes échouera.`);
    else add("attention", "SMS", "SMS non configuré : aucun numéro ne peut être vérifié, donc personne ne peut publier. Normal avant d'avoir choisi un fournisseur.");
  }
  if (sms.provider === "infobip" && sms.infobipBaseUrl && !sms.infobipBaseUrl.startsWith("https://")) add("bloquant", "INFOBIP_HTTPS", "INFOBIP_BASE_URL doit commencer par https://.");

  // E-mail (alertes facultatives)
  const mail = config.email ?? {};
  if (mail.provider && !["brevo", "resend"].includes(mail.provider)) add("bloquant", "EMAIL_INCONNU", `EMAIL_PROVIDER=${mail.provider} n'existe pas (brevo ou resend).`);
  else if (mail.provider && !emailConfigured(config)) add("bloquant", "EMAIL_INCOMPLET", "EMAIL_PROVIDER est posé sans clé API ou sans EMAIL_FROM.");
  else if (!mail.provider) add("attention", "EMAIL", "E-mail non configuré : aucune alerte par e-mail (choix actuel : tout reste dans l'application).");

  // Premier administrateur
  if (config.bootstrapAdmin) {
    if (!config.bootstrapAdminEmail) add("bloquant", "BOOTSTRAP", "BOOTSTRAP_ADMIN=true sans BOOTSTRAP_ADMIN_EMAIL : n'importe qui deviendrait administrateur.");
    else add("attention", "BOOTSTRAP_OUVERT", "BOOTSTRAP_ADMIN est actif : créez le compte propriétaire puis retirez la variable.");
  }

  // Paiements
  const pay = config.payments ?? {};
  if (pay.provider === "fake") add("bloquant", "PAIEMENT_FAKE", "PAYMENT_PROVIDER=fake est un faux fournisseur : à retirer.");
  else if (pay.provider === "cinetpay" || pay.provider === "paydunya") {
    const keys = pay.provider === "cinetpay" ? [pay.cinetpay?.apiKey, pay.cinetpay?.siteId] : [pay.paydunya?.masterKey, pay.paydunya?.privateKey, pay.paydunya?.token];
    if (!keys.every(Boolean)) add("bloquant", "PAIEMENT_CLES", `PAYMENT_PROVIDER=${pay.provider} sans toutes ses clés : les paiements resteront fermés.`);
    if (!String(config.publicUrl ?? "").startsWith("https://")) add("bloquant", "PAIEMENT_URL", "Un agrégateur réel exige PUBLIC_URL en https:// (adresse de notification et de retour).");
    if (pay.provider === "paydunya" && pay.paydunya?.mode !== "live") add("attention", "PAYDUNYA_TEST", "PAYDUNYA_MODE n'est pas « live » : les paiements passent par le bac à sable (aucun argent réel).");
  } else if (pay.provider && !pay.webhookSecret) add("bloquant", "PAIEMENT_SECRET", "PAYMENT_PROVIDER est posé sans PAYMENT_WEBHOOK_SECRET.");
  else if (!pay.provider) add("attention", "PAIEMENT", "Paiements fermés (aucun fournisseur) : normal tant que l'agrégateur n'est pas choisi.");
  if (pay.webhookSecret && pay.webhookSecret.length < 24) add("attention", "PAIEMENT_SECRET_COURT", "PAYMENT_WEBHOOK_SECRET fait moins de 24 caractères.");

  // Fond de carte Mapbox : rien à signaler tant que MAPBOX_TOKEN est vide.
  if (config.mapbox?.rejected) add("bloquant", "MAPBOX_JETON", "MAPBOX_TOKEN n'est pas un jeton public « pk. » valide : il est ignoré (un jeton secret « sk. » ne doit JAMAIS être posé ici).");
  else if (config.mapbox?.token) add("attention", "MAPBOX_RESTRICTION", "Mapbox actif : restreignez le jeton à l'adresse du site dans votre compte Mapbox et confirmez par écrit la licence et les coûts.");

  // Suivi d'erreurs
  const hook = get("ERROR_WEBHOOK_URL");
  if (hook && !hook.startsWith("https://")) add("bloquant", "ERREUR_WEBHOOK", "ERROR_WEBHOOK_URL doit être en https:// (il reçoit des journaux d'erreur).");
  if (!hook) add("attention", "SUIVI_ERREURS", "Aucun service de suivi d'erreurs : seuls les journaux de l'hébergeur les conservent (choix actuel du propriétaire).");

  return out;
}

export function formatReport(findings) {
  if (!findings.length) return "Configuration prête : rien à signaler.";
  return findings.map((f) => `${f.level === "bloquant" ? "BLOQUANT " : "attention "} ${f.code} — ${f.message}`).join("\n");
}
