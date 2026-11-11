/** Profil public enrichi (couverture, photo, présentation, contact, signalement) — sans toucher aux avis ni aux annonces. */
import { badRequest, conflict, notFound } from "../lib/errors.js";
import { PROFILE_LIMITS, PROFILE_REPORT_REASONS, allowedFields, publicProfileView, sanitizeProfileInput, whatsappLink } from "../lib/advertiser-profile.js";
import { storeDataUrl } from "../lib/file-storage.js";
import { newId } from "../lib/security.js";

const KINDS = { cover: "cover_url", avatar: "avatar_url" };
const COLUMNS = { bio: "bio", city: "city", foundedYear: "founded_year", zones: "zones", address: "address", hours: "opening_hours", showPhone: "show_phone", showWhatsapp: "show_whatsapp" };

export function createAdvertiserProfiles(ctx, accounts) {
  const { db } = ctx;

  async function row(userId) {
    return (await db.query("select * from ika_advertiser_profiles where user_id = $1", [userId]))[0] ?? null;
  }
  async function target(advertiserId) {
    const rows = await db.query(
      `select u.id, p.phone, p.display_role from ika_users u join ika_profiles p on p.user_id = u.id
       where u.id = $1 and u.deleted_at is null and p.account_status <> 'BANNED'`, [String(advertiserId ?? "").slice(0, 80)]);
    if (!rows[0]) throw notFound("Profil introuvable.");
    return rows[0];
  }

  return {
    /** Bloc public. Ne renvoie jamais le numéro : il n'est donné qu'au clic, à une personne connectée. */
    async publicBlock(advertiserId, { agencyVerified, signedIn }) {
      const [profile, base] = await Promise.all([row(advertiserId), db.query("select phone from ika_profiles where user_id = $1", [advertiserId])]);
      return publicProfileView(profile, { agencyVerified, signedIn, phone: base[0]?.phone });
    },

    /** Ce que le titulaire peut modifier, selon son rôle. */
    async mine(userId) {
      const profile = await accounts.ensureProfile(userId);
      const r = await row(userId);
      return {
        role: profile.display_role,
        agencyVerified: Boolean(profile.agency_verified_at),
        allowed: [...allowedFields(profile.display_role)],
        limits: PROFILE_LIMITS,
        profile: {
          bio: r?.bio ?? "", city: r?.city ?? "", foundedYear: r?.founded_year ?? "", zones: r?.zones ?? [], address: r?.address ?? "", hours: r?.opening_hours ?? "",
          showPhone: Boolean(r?.show_phone), showWhatsapp: Boolean(r?.show_whatsapp),
          coverUrl: r?.cover_url ?? null, avatarUrl: r?.avatar_url ?? null, imagesHidden: Boolean(r?.images_hidden),
        },
        hasPhone: Boolean(profile.phone),
      };
    },

    async update(userId, input) {
      const profile = await accounts.requireActive(userId);
      accounts.assertCanPublish(profile);
      const values = sanitizeProfileInput(input, profile.display_role);
      const keys = Object.keys(values);
      if (keys.length) {
        if ((values.showPhone || values.showWhatsapp) && !profile.phone) throw badRequest("Ajoutez d'abord un numéro de téléphone à votre compte.");
        const cols = keys.map((k) => COLUMNS[k]);
        const params = keys.map((k) => values[k]);
        await db.query(
          `insert into ika_advertiser_profiles (user_id, ${cols.join(", ")}) values ($1, ${cols.map((_, i) => `$${i + 2}`).join(", ")})
           on conflict (user_id) do update set ${cols.map((c, i) => `${c} = $${i + 2}`).join(", ")}, updated_at = now()`,
          [userId, ...params],
        );
      }
      return this.mine(userId);
    },

    async setImage(userId, kind, dataUrl) {
      accounts.assertCanPublish(await accounts.requireActive(userId));
      const column = KINDS[kind];
      if (!column) throw badRequest("Type de photo inconnu.");
      const file = await storeDataUrl(db, dataUrl, { imagesOnly: true }).catch((e) => { throw badRequest(e.message); });
      const url = `/api/media/${file.id}`;
      await db.query(
        `insert into ika_advertiser_profiles (user_id, ${column}) values ($1, $2)
         on conflict (user_id) do update set ${column} = $2, images_hidden = false, updated_at = now()`,
        [userId, url],
      );
      return { url };
    },

    async removeImage(userId, kind) {
      await accounts.requireActive(userId);
      const column = KINDS[kind];
      if (!column) throw badRequest("Type de photo inconnu.");
      await db.query(`update ika_advertiser_profiles set ${column} = null, updated_at = now() where user_id = $1`, [userId]);
      return { ok: true };
    },

    /** Clic Appeler / WhatsApp : connexion exigée, numéro donné seulement si l'annonceur l'a autorisé. */
    async recordContact(userId, advertiserId, kind) {
      await accounts.requireActive(userId);
      const t = await target(advertiserId);
      if (t.id === userId) throw badRequest("C'est votre propre profil.");
      const r = await row(t.id);
      const whatsapp = kind === "WHATSAPP";
      if (!(whatsapp ? r?.show_whatsapp && whatsappLink(t.phone) : r?.show_phone && t.phone)) throw notFound("Ce moyen de contact n'est pas proposé par cet annonceur.");
      await db.query("insert into ika_profile_contact_events (id, advertiser_id, user_id, kind) values ($1, $2, $3, $4)", [newId("pc"), t.id, userId, whatsapp ? "WHATSAPP" : "CALL"]);
      return { phone: t.phone };
    },

    /** Signalement d'un annonceur en cas de litige : même file que les signalements issus des conversations. */
    async report(userId, advertiserId, { reason, details }) {
      await accounts.requireActive(userId);
      if (!PROFILE_REPORT_REASONS.includes(reason)) throw badRequest("Motif de signalement invalide.");
      const t = await target(advertiserId);
      if (t.id === userId) throw badRequest("Vous ne pouvez pas vous signaler vous-même.");
      const rows = await db.query(
        `insert into ika_user_reports (id, reporter_id, reported_id, thread_id, reason, details, excerpt)
         values ($1, $2, $3, null, $4, $5, '[]'::jsonb) on conflict do nothing returning id`,
        [newId("ur"), userId, t.id, reason, String(details ?? "").trim().slice(0, 1000)],
      );
      if (!rows[0]) throw conflict("Vous avez déjà signalé cet annonceur. La modération examine votre signalement.");
      return { ok: true };
    },

    /** Modération : masquer (ou rétablir) la couverture et la photo d'un profil. Motif obligatoire, tracé dans la même transaction. */
    async setImagesHidden(staffId, targetId, hidden, rawReason) {
      await accounts.requireStaff(staffId);
      const reason = String(rawReason ?? "").trim().slice(0, 300);
      if (reason.length < 3) throw badRequest("Indiquez le motif.");
      const id = String(targetId ?? "").slice(0, 80);
      await db.transaction(async (tx) => {
        const rows = await tx.query("update ika_advertiser_profiles set images_hidden = $2, updated_at = now() where user_id = $1 returning user_id", [id, hidden === true]);
        if (!rows[0]) throw notFound("Ce profil n'a pas de photo à masquer.");
        await accounts.audit(staffId, hidden === true ? "HIDE_PROFILE_IMAGES" : "SHOW_PROFILE_IMAGES", null, `${id} ${reason}`, tx);
      });
      return { ok: true, hidden: hidden === true };
    },

    /** Antécédents constatés : uniquement des faits comptés par Ika So. Les signalements en cours ne sont jamais affichés. */
    async history(advertiserId) {
      const rows = await db.query(
        `select count(*) filter (where l.published_at is not null)::int as published,
                count(*) filter (where l.status = 'REJECTED')::int as rejected,
                count(*) filter (where l.status in ('SOLD', 'RENTED'))::int as closed,
                min(l.published_at) as first_published
         from ika_listings l where l.owner_id = $1`, [advertiserId]);
      const r = rows[0] ?? {};
      return { published: r.published ?? 0, rejected: r.rejected ?? 0, closed: r.closed ?? 0, firstPublishedAt: r.first_published ? new Date(r.first_published).toISOString() : null };
    },
  };
}
