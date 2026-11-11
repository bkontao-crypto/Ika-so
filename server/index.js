// Point d'entrée : npm start
import { createApp } from "./app.js";
import { createWebhookSink } from "./lib/error-sink.js";
import { createLogger } from "./lib/logger.js";
import { getConfig, smsConfigured } from "./config.js";
import { createDb } from "./db.js";
import { migrate } from "./migrate.js";
import { createServices } from "./services/index.js";
import { createSmsSender } from "./lib/sms.js";
import { createEmailSender } from "./lib/email.js";
import { createNotifier } from "./lib/notifier.js";

const config = getConfig();
if (!config.databaseUrl) {
  console.error("DATABASE_URL est obligatoire (voir .env.example).");
  process.exit(1);
}
if (config.production && config.bootstrapAdmin && !config.bootstrapAdminEmail) {
  console.error("En production, BOOTSTRAP_ADMIN=true exige BOOTSTRAP_ADMIN_EMAIL (sinon n'importe qui peut devenir administrateur).");
  process.exit(1);
}

// Mode ambigu : sans NODE_ENV, config.production vaut false et le premier inscrit deviendrait SUPERADMIN.
if (!config.production && !["development", "test"].includes(config.nodeEnv)) {
  console.error("NODE_ENV doit valoir « production » (hébergement) ou « development » (poste local). Sans lui, le premier inscrit deviendrait administrateur.");
  process.exit(1);
}

const db = createDb(config.databaseUrl);
await migrate(db); // idempotent ; sous verrou si plusieurs instances démarrent ensemble

const logger = createLogger({ level: process.env.LOG_LEVEL ?? "info", sinks: [createWebhookSink(process.env.ERROR_WEBHOOK_URL)].filter(Boolean) });
const sendSms = createSmsSender(config);
const sendEmail = createEmailSender(config);
// Alertes hors du site : seulement si un canal est configuré ET si la personne les a activées (désactivées par défaut).
const notifier = createNotifier({ db, config, sendEmail, sendSms: smsConfigured(config) ? sendSms : null, logger });
const services = createServices({ db, config, sendSms, notifiers: [notifier.deliver], notifier, logger, sendEmail });
// Quartiers et pays : lus en base au démarrage, puis relus chaque minute (plusieurs instances voient ainsi les changements du Superadmin).
if (!(await services.places.reload())) logger.warn("quartiers_pays_non_lus", { effet: "les 10 quartiers d'origine servent ; lancez « npm run migrate » (migration 058)" });
setInterval(() => { services.places.reload().catch(() => undefined); }, 60_000).unref();
if (config.production && !config.trustProxyConfigured) {
  logger.warn("trust_proxy_absent", { effet: "tous les visiteurs partagent les mêmes compteurs anti-abus ; posez TRUST_PROXY=1 derrière Render" });
}
if (config.trustProxy === true) {
  logger.warn("trust_proxy_total", { effet: "un visiteur peut forger son adresse ; préférez un nombre de sauts (TRUST_PROXY=1)" });
}
if (config.bootstrapAdmin) {
  const claimed = await db.query("select 1 from ika_bootstrap where id = 1");
  if (!claimed.length) logger.warn("bootstrap_admin_ouvert", { effet: "le premier compte créé avec l'adresse prévue devient SUPERADMIN : créez-le maintenant, puis retirez BOOTSTRAP_ADMIN" });
}
if (config.production && !config.backup.dirConfigured) {
  logger.warn("backup_dir_absent", { effet: "les sauvegardes vont dans ./backups : sur un disque éphémère elles disparaissent au redéploiement ; posez BACKUP_DIR sur un disque persistant et copiez-les hors du serveur (scripts/backup.sh)" });
}
const app = createApp({ services, config, logger, health: () => db.query("select 1") });
// Sauvegardes automatiques et alertes : démarrées ici (processus serveur), pas dans createApp, pour ne pas lancer de minuteries dans les tests.
services.stats.startScheduler();

const server = app.listen(config.port, "0.0.0.0", () => {
  logger.info("demarrage", { port: config.port, production: config.production, sms: Boolean(config.sms.provider) });
  if (!config.sms.provider) logger.warn("sms_non_configure", { effet: "aucun numéro ne sera vérifié par SMS" });
});

// Résumés quotidiens des alertes : toutes les 15 minutes, on envoie ceux qui sont dus (au plus un par compte et par jour).
// Un verrou en base évite l'envoi en double si plusieurs instances tournent ; en cas d'échec, la file reste intacte.
const digestTimer = setInterval(() => {
  services.engagement.flushDigests().then((r) => { if (r.sent) logger.info("resumes_envoyes", { nombre: r.sent }); })
    .catch((error) => logger.error("resumes_echec", { error: String(error?.message ?? error) }));
}, 15 * 60_000);
digestTimer.unref();

// Rappel avant la suppression des pièces des demandes annonceur (30 jours avant l'échéance, un seul rappel par échéance).
// Notification seulement : la suppression des pièces reste la commande manuelle `node scripts/retention.mjs`.
const docsReminderTimer = setInterval(() => {
  services.advertiserApplications.notifyExpiringDocuments().then((n) => { if (n) logger.info("rappels_pieces_envoyes", { nombre: n }); })
    .catch((error) => logger.error("rappels_pieces_echec", { error: String(error?.message ?? error) }));
}, 6 * 60 * 60_000);
docsReminderTimer.unref();

// Paiements restés en attente : marqués « expirés » après 24 h (une confirmation tardive du fournisseur reste honorée).
if (services.payments.enabled()) {
  const expiryTimer = setInterval(() => {
    services.payments.expirePending().then((n) => { if (n) logger.info("paiements_expires", { nombre: n }); })
      .catch((error) => logger.error("paiements_expiration_echec", { error: String(error?.message ?? error) }));
  }, 60 * 60_000);
  expiryTimer.unref();
}

// Une erreur non prévue est journalisée avant l'arrêt ; l'hébergeur relance le processus.
process.on("unhandledRejection", (reason) => logger.error("rejet_non_gere", { error: String(reason?.message ?? reason) }));
process.on("uncaughtException", (error) => {
  logger.error("exception_non_geree", { error: String(error?.message ?? error), stack: String(error?.stack ?? "").split("\n").slice(0, 6).join(" | ") });
  process.exit(1);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(async () => {
      await db.close();
      process.exit(0);
    });
  });
}
