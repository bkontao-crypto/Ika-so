import { createAccounts } from "./accounts.js";
import { createAnalytics } from "./analytics.js";
import { createStats } from "./stats.js";
import { createOwnerCenter } from "./owner-center.js";
import { createOwnerDelegations } from "./owner-delegations.js";
import { createPermissionGrants } from "./permission-grants.js";
import { createAdvertiserProfiles } from "./advertiser-profile.js";
import { createAdvertiserCenter } from "./advertiser-center.js";
import { createAdvertiserApplications } from "./advertiser-applications.js";
import { createFeaturedRequests } from "./featured-requests.js";
import { createEngagement } from "./engagement.js";
import { createGeo } from "./geo.js";
import { createImports } from "./imports.js";
import { createListings } from "./listings.js";
import { createProperties } from "./properties.js";
import { selectProvider } from "../payments/providers.js";
import { createModeration } from "./moderation.js";
import { createModerationAudit } from "./moderation-audit.js";
import { createCrm } from "./crm.js";
import { createWhatsApp } from "./whatsapp.js";
import { createSuperadminSettings } from "./superadmin-settings.js";
import { createPayments } from "./payments.js";
import { createPremiumRequests } from "./premium-requests.js";
import { POLICY_KEY } from "../lib/payment-policy.js";
import { createNotifier } from "../lib/notifier.js";
import { createReviews } from "./reviews.js";
import { createRights } from "./rights.js";
import { createSeo } from "./seo.js";
import { createTrust } from "./trust.js";
import { createHomepageSettings } from "./homepage-settings.js";
import { createPartners } from "./partners.js";
import { createPlaces } from "./places.js";
import { createBackupRunner } from "../lib/backup.js";

/**
 * Assemble les services métier. `db` doit offrir query(texte, paramètres) -> lignes.
 * `sendSms(numéro, texte)` est injectable : Twilio en production, un faux dans les tests.
 */
export function createServices({ db, config, sendSms, paymentProvider, notifiers = [], notifier: givenNotifier = null, logger = null, sendEmail = null, backup: givenBackup } ) {
  const ctx = { db, config, sendSms, sendEmail, paymentProvider, notifiers };
  const accounts = createAccounts(ctx);
  const trust = createTrust(ctx, accounts);
  const listings = createListings(ctx, accounts, trust);
  const properties = createProperties(ctx);
  const engagement = createEngagement(ctx, accounts);
  const imports = createImports(ctx, accounts, listings);
  const moderation = createModeration(ctx, accounts, engagement);
const moderationAudit = createModerationAudit(ctx);
const crm = createCrm(ctx);
const whatsapp = createWhatsApp(ctx);
const superadminSettings = createSuperadminSettings(ctx);
  const seo = createSeo(ctx, listings);
  const rights = createRights(ctx, accounts);
  const notifier = givenNotifier ?? createNotifier({ db, config });
  const advertiserProfiles = createAdvertiserProfiles(ctx, accounts);
  const reviews = createReviews(ctx, accounts, advertiserProfiles, (userId, note) => engagement.notify(userId, note));
  const geo = createGeo(ctx, accounts);
  const analytics = createAnalytics({ db, config, logger });
  const payments = createPayments(ctx, accounts, ctx.paymentProvider !== undefined ? ctx.paymentProvider : selectProvider(config), (fields) => analytics.emit("payment_completed", fields), () => superadminSettings.get(POLICY_KEY));
  const premiumRequests = createPremiumRequests({ db, accounts, notify: (userId, note) => engagement.notify(userId, note), superadminSettings, moderationAudit, payments });
  // Sauvegarde réelle (pg_dump) : injectable dans les tests ; absente sans DATABASE_URL (le journal indique alors « non configurée »).
  const backup = givenBackup !== undefined ? givenBackup : (config?.databaseUrl ? createBackupRunner({ databaseUrl: config.databaseUrl, dir: config.backup?.dir, keep: config.backup?.keep }) : null);
  const stats = createStats({ db, accounts, analytics, backup, sendEmail, onSettingsChanged: () => seo.invalidateSite() });
  const homepageSettings = createHomepageSettings({ db, accounts });
  const partners = createPartners({ db, accounts });
  const places = createPlaces({ db, accounts });
  const ownerCenter = createOwnerCenter({ db, accounts, logger });
  const ownerDelegations = createOwnerDelegations({ db, accounts });
  const permissionGrants = createPermissionGrants({ db, accounts });
  const advertiserCenter = createAdvertiserCenter({ db, accounts });
  const advertiserApplications = createAdvertiserApplications({ db, accounts, notify: (userId, note) => engagement.notify(userId, note) });
  const featuredRequests = createFeaturedRequests({ db, accounts, moderation, notify: (userId, note) => engagement.notify(userId, note) });
  return { featuredRequests, premiumRequests, superadminSettings, db, whatsapp, crm, moderationAudit, accounts, listings, properties, moderation, trust, engagement, imports, seo, payments, rights, reviews, notifier, geo, advertiserProfiles, analytics, stats, homepageSettings, partners, places, ownerCenter, ownerDelegations, permissionGrants, advertiserCenter, advertiserApplications };
}

export { createTwilioSender } from "../lib/sms.js";
