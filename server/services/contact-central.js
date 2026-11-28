// Gestion centralisée des contacts (ordonnance du 27 nov. 2026) : lecture sûre du réglage, catégorie du propriétaire, numéro à exposer.
// Tout est désactivé par défaut. Une erreur de lecture ne produit JAMAIS une activation : on retombe sur le contact du propriétaire.
import { badRequest, conflict } from "../lib/errors.js";
import { CATEGORY_KEYS, CATEGORY_LABELS, CONTACT_CENTRAL_KEY, normalizeConfig, resolveContact, validateConfigInput } from "../lib/contact-central.js";

/**
 * Catégorie qui décide quand un propriétaire en cumule plusieurs (décision du 27 nov. 2026) :
 * Premium, puis Agence, puis Annonceur, puis Standard. Entrée : { premium, agency, advertiser } (booléens).
 */
export function pickCategory({ premium, agency, advertiser } = {}) {
  if (premium === true) return "PREMIUM";
  if (agency === true) return "AGENCY";
  if (advertiser === true) return "ADVERTISER";
  return "STANDARD";
}

export function createContactCentral({ db, superadminSettings, accounts, moderationAudit = null, logger = null }) {
  const warn = (message, error) => { try { logger?.warn?.({ error: error?.message }, message); } catch { /* journal indisponible : sans effet */ } };

  /** Réglage courant, jamais d'exception : toute erreur = tout désactivé. */
  async function config() {
    try { return normalizeConfig(await superadminSettings.get(CONTACT_CENTRAL_KEY)); }
    catch (error) { warn("contact_central : lecture impossible, fonctionnement normal", error); return normalizeConfig(null); }
  }

  /** Catégorie réelle du propriétaire (Premium > Agence > Annonceur > Standard), ou null si indéterminée. */
  async function categoryOf(ownerId) {
    const rows = await db.query(
      `select (p.premium_until is not null and p.premium_until > now()) as premium,
              (p.agency_verified_at is not null) as agency,
              exists (select 1 from ika_advertiser_applications a where a.user_id = p.user_id and a.status = 'APPROVED') as advertiser
         from ika_profiles p where p.user_id = $1`,
      [String(ownerId ?? "").slice(0, 80)],
    );
    return rows[0] ? pickCategory(rows[0]) : null;
  }

  /** Comptes Superadmin/Admin désignés ET encore autorisés (revérifiés à chaque usage). */
  async function activeRecipients(cfg = null) {
    const c = cfg ?? await config();
    if (!c.recipients.length) return [];
    const rows = await db.query(
      `select p.user_id from ika_profiles p join ika_users u on u.id = p.user_id and u.deleted_at is null
        where p.user_id = any($1::text[]) and p.staff_role in ('SUPERADMIN', 'ADMIN') and p.account_status <> 'BANNED'`,
      [c.recipients],
    );
    const ok = new Set(rows.map((r) => r.user_id));
    return c.recipients.filter((id) => ok.has(id));
  }

  /** Mode effectif pour une annonce. Réglage général éteint : aucune autre lecture en base. */
  async function forListing({ listingId, ownerPhone = "" }) {
    const cfg = await config();
    if (!cfg.enabled) return resolveContact({ config: cfg, category: null, ownerPhone });
    let category = null;
    let listing = {};
    try {
      const rows = await db.query("select owner_id, contact_mode, contact_custom_phone, contact_custom_whatsapp from ika_listings where id = $1", [String(listingId ?? "").slice(0, 80)]);
      if (rows[0]) {
        category = await categoryOf(rows[0].owner_id);
        listing = { contactMode: rows[0].contact_mode, customPhone: rows[0].contact_custom_phone, customWhatsapp: rows[0].contact_custom_whatsapp };
      }
    } catch (error) { warn("contact_central : catégorie indéterminée, fonctionnement normal", error); category = null; }
    if (!category) warn("contact_central : catégorie du propriétaire indéterminée pour l'annonce", null);
    return { ...resolveContact({ config: cfg, category, listing, ownerPhone }), category };
  }

  return {
    config, categoryOf, activeRecipients, forListing,

    /**
     * Enveloppe de `listings.recordContact` : le numéro du propriétaire n'est remplacé que si la centralisation est active.
     * `kind` WHATSAPP lit le numéro WhatsApp, sinon le téléphone. Aucun numéro sûr = erreur claire (jamais de lien cassé).
     */
    async wrapContact(base, userId, listingId, kind) {
      const out = await base(userId, listingId, kind);
      const r = await forListing({ listingId, ownerPhone: out?.phone ?? "" });
      if (!r.active) return out;
      const number = kind === "WHATSAPP" ? r.whatsapp : r.phone;
      if (!number) throw conflict("Ce contact n'est pas disponible par téléphone. Utilisez « Écrire » pour joindre l'équipe.");
      return { ...out, phone: number };
    },

    /** Réglage pour l'écran du Owner Center : Superadmin seulement, contrôlé côté serveur. */
    async getSettings(staffId) {
      await accounts.requireStaff(staffId, "SUPERADMIN");
      return { ...(await config()), categoryKeys: CATEGORY_KEYS, categoryLabels: CATEGORY_LABELS };
    },

    async saveSettings(staffId, raw) {
      await accounts.requireStaff(staffId, "SUPERADMIN");
      const before = await config();
      const { value, errors } = validateConfigInput(raw);
      if (value.recipients.length) {
        const valid = new Set(await activeRecipients(value));
        const refused = value.recipients.filter((id) => !valid.has(id));
        if (refused.length) errors.push("Chaque destinataire doit être un compte Superadmin ou Admin actif.");
      }
      if (errors.length) throw badRequest(errors[0]);
      await superadminSettings.set(staffId, CONTACT_CENTRAL_KEY, value);
      await moderationAudit?.log(staffId, { action: "CONTACT_CENTRAL_UPDATE", targetType: "settings", targetId: CONTACT_CENTRAL_KEY, details: { before, after: value } });
      return value;
    },
  };
}
