/**
 * Alertes hors du site (e-mail, SMS). DÉSACTIVÉ par défaut à deux niveaux :
 *  1. côté serveur : un fournisseur doit être configuré (EMAIL_PROVIDER / SMS_PROVIDER) ;
 *  2. côté personne : elle doit l'avoir activé elle-même (ika_notify_prefs), avec la date du consentement.
 * Règles de confidentialité : jamais le texte d'un message privé ni un numéro de téléphone dans un e-mail ou un SMS ;
 * seulement « vous avez un nouveau message » et un lien. Un e-mail rappelle comment se désinscrire.
 * Limites : 1 e-mail par heure et par type d'alerte et par personne ; 5 SMS par jour et par personne, réservés aux messages et visites.
 */
const EMAIL_KINDS = new Set(["MESSAGE", "VISIT_REQUEST", "VISIT_ANSWER", "SEARCH_MATCH", "SEARCH_DIGEST", "LISTING_APPROVED", "LISTING_REJECTED", "ADVERTISER_APPLICATION", "TEAM_REQUEST"]);
const SMS_KINDS = new Set(["MESSAGE", "VISIT_REQUEST", "VISIT_ANSWER"]);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const SMS_PER_DAY = 5;

const SUBJECT = {
  MESSAGE: "Nouveau message sur Ika So", VISIT_REQUEST: "Nouvelle demande de visite sur Ika So", VISIT_ANSWER: "Réponse à votre demande de visite",
  SEARCH_MATCH: "Une annonce correspond à votre recherche", SEARCH_DIGEST: "Votre résumé d'annonces Ika So",
  LISTING_APPROVED: "Votre annonce est en ligne", LISTING_REJECTED: "Votre annonce a été refusée",
  ADVERTISER_APPLICATION: "Nouvelle demande annonceur à examiner", TEAM_REQUEST: "Invitation à rejoindre une équipe sur Ika So",
};

export function createNotifier({ db, config, sendEmail = null, sendSms = null, logger = null, now = () => Date.now() }) {
  const sentEmail = new Map(); // `${userId}:${kind}` -> dernière heure d'envoi
  const sentSms = new Map();   // userId -> [heures d'envoi]
  const base = config.publicUrl || "";

  /** Fonction branchée sur `ctx.notifiers` : (userId, { kind, title, body, link }). Ne lève jamais. */
  async function deliver(userId, note) {
    try {
      if (!sendEmail && !sendSms) return { skipped: "aucun canal" };
      const rows = await db.query(
        `select u.email, p.phone, p.phone_verified_at, p.phone_channel, n.email_enabled, n.sms_enabled
         from ika_users u left join ika_profiles p on p.user_id = u.id left join ika_notify_prefs n on n.user_id = u.id
         where u.id = $1 and u.deleted_at is null`, [userId]);
      const u = rows[0];
      if (!u) return { skipped: "inconnu" };
      const out = {};
      const link = note.link?.startsWith("#") ? `${base}/${note.link}` : base || "";
      if (sendEmail && u.email_enabled && EMAIL_KINDS.has(note.kind)) {
        const key = `${userId}:${note.kind}`;
        if (now() - (sentEmail.get(key) ?? 0) >= HOUR) {
          sentEmail.set(key, now());
          await sendEmail({
            to: u.email, subject: SUBJECT[note.kind] ?? "Ika So",
            text: `Bonjour,\n\n${note.kind === "MESSAGE" ? "Vous avez un nouveau message sur Ika So." : note.title}\n\nOuvrez Ika So pour le lire : ${link}\n\n—\nVous recevez cet e-mail parce que vous avez activé les alertes par e-mail. Pour ne plus en recevoir, décochez l'option dans « Mon profil » > « Alertes hors du site ».`,
          });
          out.email = true;
        }
      }
      if (sendSms && u.sms_enabled && SMS_KINDS.has(note.kind) && u.phone && u.phone_verified_at && u.phone_channel === "SMS") {
        const recent = (sentSms.get(userId) ?? []).filter((t) => now() - t < DAY);
        if (recent.length < SMS_PER_DAY) {
          sentSms.set(userId, [...recent, now()]);
          await sendSms(u.phone, note.kind === "MESSAGE" ? "Ika So : vous avez un nouveau message. Ouvrez l'application pour le lire." : "Ika So : vous avez une nouvelle notification. Ouvrez l'application.");
          out.sms = true;
        }
      }
      return out;
    } catch (error) {
      logger?.warn("alerte_hors_site_echec", { error: String(error?.message ?? error).slice(0, 120) });
      return { error: true };
    }
  }

  async function getPrefs(userId) {
    const r = (await db.query("select email_enabled, sms_enabled, consent_at from ika_notify_prefs where user_id = $1", [userId]))[0];
    return { emailAvailable: Boolean(sendEmail), smsAvailable: Boolean(sendSms), email: Boolean(r?.email_enabled), sms: Boolean(r?.sms_enabled), consentAt: r?.consent_at ?? null };
  }

  /** La personne choisit. Activer un canal qui n'est pas disponible côté serveur est refusé (pas de faux consentement). */
  async function setPrefs(userId, { email, sms }) {
    if ((email === true && !sendEmail) || (sms === true && !sendSms)) {
      const e = new Error("Ce canal n'est pas encore disponible."); e.status = 409; throw e;
    }
    await db.query(
      `insert into ika_notify_prefs (user_id, email_enabled, sms_enabled, consent_at, updated_at) values ($1, $2, $3, case when $2 or $3 then now() end, now())
       on conflict (user_id) do update set email_enabled = $2, sms_enabled = $3,
         consent_at = case when $2 or $3 then coalesce(case when ika_notify_prefs.email_enabled or ika_notify_prefs.sms_enabled then ika_notify_prefs.consent_at end, now()) else null end, updated_at = now()`,
      [userId, email === true, sms === true]);
    return getPrefs(userId);
  }
  return { deliver, getPrefs, setPrefs };
}
