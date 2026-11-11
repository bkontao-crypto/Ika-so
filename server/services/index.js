import { createAccounts } from "./accounts.js";
import { createAnalytics } from "./analytics.js";
import { createStats } from "./stats.js";
import { createOwnerCenter } from "./owner-center.js";
import { createAdvertiserProfiles } from "./advertiser-profile.js";
import { createAdvertiserCenter } from "./advertiser-center.js";
import { createAdvertiserApplications } from "./advertiser-applications.js";
import { createEngagement } from "./engagement.js";
import { createGeo } from "./geo.js";
import { createImports } from "./imports.js";
import { createListings } from "./listings.js";
import { selectProvider } from "../payments/providers.js";
import { createModeration } from "./moderation.js";
import { createPayments } from "./payments.js";
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
  const engagement = createEngagement(ctx, accounts);
  const imports = createImports(ctx, accounts, listings);
  const moderation = createModeration(ctx, accounts, engagement);
  const seo = createSeo(ctx, listings);
  const rights = createRights(ctx, accounts);
  const notifier = givenNotifier ?? createNotifier({ db, config });
  const advertiserProfiles = createAdvertiserProfiles(ctx, accounts);
  const reviews = createReviews(ctx, accounts, advertiserProfiles, (userId, note) => engagement.notify(userId, note));
  const geo = createGeo(ctx, accounts);
  const analytics = createAnalytics({ db, config, logger });
  const payments = createPayments(ctx, accounts, ctx.paymentProvider !== undefined ? ctx.paymentProvider : selectProvider(config), (fields) => analytics.emit("payment_completed", fields));
  // Sauvegarde réelle (pg_dump) : injectable dans les tests ; absente sans DATABASE_URL (le journal indique alors « non configurée »).
  const backup = givenBackup !== undefined ? givenBackup : (config?.databaseUrl ? createBackupRunner({ databaseUrl: config.databaseUrl, dir: config.backup?.dir, keep: config.backup?.keep }) : null);
  const stats = createStats({ db, accounts, analytics, backup, sendEmail, onSettingsChanged: () => seo.invalidateSite() });
  const homepageSettings = createHomepageSettings({ db, accounts });
  const partners = createPartners({ db, accounts });
  const places = createPlaces({ db, accounts });
  const ownerCenter = createOwnerCenter({ db, accounts, logger });
  const advertiserCenter = createAdvertiserCenter({ db, accounts });
  const advertiserApplications = createAdvertiserApplications({ db, accounts, notify: (userId, note) => engagement.notify(userId, note) });
  return { accounts, listings, moderation, trust, engagement, imports, seo, payments, rights, reviews, notifier, geo, advertiserProfiles, analytics, stats, homepageSettings, partners, places, ownerCenter, advertiserCenter, advertiserApplications };
}

export { createTwilioSender } from "../lib/sms.js";
