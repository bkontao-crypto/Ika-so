import { AppError, badRequest, conflict, forbidden, tooMany, unauthorized } from "../lib/errors.js";
import {
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
  OWNER_ROLES,
  hasStaffRank,
  isSmsVerified,
  normalizePhone,
  otpRequestAllowed,
} from "../lib/rules.js";
import {
  DUMMY_HASH,
  hashPassword,
  newId,
  newToken,
  sameHash,
  sha256,
  verifyPassword,
} from "../lib/security.js";
import { smsConfigured } from "../config.js";
import { assertNotBlacklisted } from "../lib/blacklist.js";
import { iso } from "./cards.js";
import { LEGAL_VERSION } from "../lib/legal.js";

const SESSION_DAYS = 30;
const RESET_MINUTES = 30;
const RESET_PER_HOUR = 3;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

export function createAccounts(ctx) {
  const { db, config } = ctx;

  async function ensureProfile(userId) {
    const existing = await db.query("select * from ika_profiles where user_id = $1", [userId]);
    if (existing[0]) return existing[0];
    const users = await db.query("select email, name from ika_users where id = $1", [userId]);
    if (!users[0]) throw unauthorized();
    // Premier administrateur : une seule ligne ika_bootstrap peut exister, donc un seul gagnant,
    // même si deux inscriptions arrivent en même temps.
    let claimed = false;
    const allowed =
      config.bootstrapAdmin &&
      (!config.bootstrapAdminEmail || users[0].email === config.bootstrapAdminEmail);
    if (allowed) {
      const claim = await db.query(
        "insert into ika_bootstrap (id) values (1) on conflict do nothing returning id",
      );
      claimed = Boolean(claim[0]);
    }
    const created = await db.query(
      `insert into ika_profiles (user_id, full_name, staff_role) values ($1, $2, $3)
       on conflict (user_id) do nothing returning *`,
      [userId, users[0].name.slice(0, 120), claimed ? "SUPERADMIN" : "USER"],
    );
    if (created[0]) return created[0];
    const again = await db.query("select * from ika_profiles where user_id = $1", [userId]);
    return again[0];
  }

  function assertCanPublish(profile) {
    if (profile.account_status === "BANNED") {
      throw forbidden("Ce compte est bloqué. Les actions sont refusées.");
    }
    if (profile.account_status === "RESTRICTED") {
      throw forbidden("Publication et commentaires bloqués sur ce compte.");
    }
  }

  async function assertCanPublishListing(userId) {
    const profile = await ensureProfile(userId);
    assertCanPublish(profile);
    if (profile.staff_role !== "USER") return profile;
    const apps = await db.query(
      "select 1 from ika_advertiser_applications where user_id = $1 and status = 'APPROVED' limit 1",
      [userId]
    );
    if (!apps.length) throw forbidden("Vous devez d'abord être approuvé comme annonceur pour publier. Rendez-vous dans Mon profil > Devenir annonceur.");
    return profile;
  }

  /** Tout compte banni est refusé sur toute action. */
  async function requireActive(userId) {
    const profile = await ensureProfile(userId);
    if (profile.account_status === "BANNED") {
      throw forbidden("Ce compte est bloqué. Les actions sont refusées.");
    }
    return profile;
  }

  async function requireStaff(userId, minimum = "MODERATOR") {
    const profile = await ensureProfile(userId);
    if (!hasStaffRank(profile.staff_role, minimum)) {
      throw forbidden(minimum === "MODERATOR" ? "Réservé à la modération." : "Réservé aux administrateurs.");
    }
    if (profile.account_status === "BANNED") throw forbidden("Compte bloqué.");
    // Un personnel sanctionné (RESTRICTED) perd ses droits de modération tant que la restriction dure.
    if (profile.account_status === "RESTRICTED") throw forbidden("Compte restreint : droits de modération suspendus.");
    return profile;
  }

  /** `q` : db ou une transaction. Passer la transaction de l'action pour que l'action et sa trace réussissent ou échouent ensemble. */
  async function audit(actorId, action, listingId, note, q = db) {
    await q.query(
      "insert into ika_audit (id, actor_id, action, listing_id, note) values ($1, $2, $3, $4, $5)",
      [newId("aud"), actorId, action, listingId, String(note ?? "").slice(0, 500)],
    );
  }

  async function createSession(userId) {
    const token = newToken();
    await db.query("delete from ika_sessions where expires_at < now()");
    await db.query(
      `insert into ika_sessions (token_hash, user_id, expires_at)
       values ($1, $2, now() + ($3 || ' days')::interval)`,
      [sha256(token), userId, String(SESSION_DAYS)],
    );
    return token;
  }

  /** Nom affiché : 2 à 80 caractères, sans caractères de contrôle, sans numéro de téléphone. */
  async function updateName(userId, rawName) {
    const profile = await ensureProfile(userId);
    assertCanPublish(profile);
    const name = String(rawName ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
    if (name.length < 2 || name.length > 80) throw badRequest("Le nom doit contenir entre 2 et 80 caractères.");
    if (/(?:\d[\s.\-]?){8,}/.test(name)) throw badRequest("N'écrivez pas de numéro de téléphone dans le nom.");
    await db.query("update ika_profiles set full_name = $2 where user_id = $1", [userId, name]);
    await db.query("update ika_users set name = $2 where id = $1", [userId, name]);
    return { fullName: name };
  }

  return {
    ensureProfile,
    updateName,
    assertCanPublish,
    assertCanPublishListing,
    requireActive,
    requireStaff,
    audit,

    async register({ name, email, password, acceptTerms }) {
      if (acceptTerms !== true) throw badRequest("Vous devez accepter les conditions d'utilisation et la politique de confidentialité.");
      const cleanName = String(name ?? "").trim().slice(0, 120);
      const cleanEmail = String(email ?? "").trim().toLowerCase();
      const pass = String(password ?? "");
      if (cleanName.length < 2) throw badRequest("Indiquez votre nom.");
      if (cleanEmail.length > 254 || !EMAIL.test(cleanEmail)) throw badRequest("Adresse e-mail invalide.");
      if (pass.length < 8 || pass.length > 200) {
        throw badRequest("Le mot de passe doit contenir au moins 8 caractères.");
      }
      await assertNotBlacklisted(db, "EMAIL", cleanEmail);
      const id = newId("u");
      const rows = await db.query(
        `insert into ika_users (id, email, name, password_hash, terms_version, terms_accepted_at) values ($1, $2, $3, $4, $5, now())
         on conflict (email) do nothing returning id`,
        [id, cleanEmail, cleanName, await hashPassword(pass), LEGAL_VERSION],
      );
      if (!rows[0]) throw conflict("Un compte existe déjà avec cet e-mail.");
      await ensureProfile(id);
      return { token: await createSession(id), user: { id, email: cleanEmail, name: cleanName } };
    },

    async login({ email, password }) {
      const cleanEmail = String(email ?? "").trim().toLowerCase();
      const rows = await db.query(
        "select id, email, name, password_hash from ika_users where email = $1",
        [cleanEmail],
      );
      const user = rows[0];
      // Même durée de calcul, que l'e-mail existe ou non.
      const ok = await verifyPassword(String(password ?? ""), user ? user.password_hash : DUMMY_HASH);
      if (!user || !ok) throw unauthorized("E-mail ou mot de passe incorrect.");
      const profile = await ensureProfile(user.id);
      if (profile.account_status === "BANNED") {
        throw forbidden(`Ce compte est bloqué.${profile.status_reason ? ` Motif : ${profile.status_reason}` : ""}`);
      }
      return {
        token: await createSession(user.id),
        user: { id: user.id, email: user.email, name: user.name },
      };
    },

    /**
     * Mot de passe oublié. Réponse identique que le compte existe ou non (rien ne révèle les comptes).
     * Le lien part par e-mail si l'e-mail est configuré, sinon par SMS si le numéro du compte est vérifié par SMS.
     */
    async requestPasswordReset({ email }) {
      const cleanEmail = String(email ?? "").trim().toLowerCase();
      if (!EMAIL.test(cleanEmail) || cleanEmail.length > 254) throw badRequest("Adresse e-mail invalide.");
      const rows = await db.query("select id from ika_users where email = $1 and deleted_at is null", [cleanEmail]);
      const user = rows[0];
      if (!user) return { sent: true };
      const profile = await ensureProfile(user.id);
      if (profile.account_status === "BANNED") return { sent: true };
      const recent = await db.query("select count(*)::int as n from ika_password_resets where user_id = $1 and created_at > now() - interval '1 hour'", [user.id]);
      if (recent[0].n >= RESET_PER_HOUR) return { sent: true };
      const token = newToken();
      await db.query(
        "insert into ika_password_resets (token_hash, user_id, expires_at) values ($1, $2, now() + ($3 || ' minutes')::interval)",
        [sha256(token), user.id, String(RESET_MINUTES)],
      );
      const link = `${config.publicUrl || ""}/#/mot-de-passe-oublie?token=${token}`;
      try {
        if (ctx.sendEmail) {
          await ctx.sendEmail({
            to: cleanEmail,
            subject: "Réinitialisation de votre mot de passe Ika So",
            text: `Bonjour,\n\nVous avez demandé à changer votre mot de passe Ika So. Ouvrez ce lien (valable ${RESET_MINUTES} minutes, une seule fois) :\n${link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.\n\n—\nIka So`,
          });
        } else if (ctx.sendSms && profile.phone && profile.phone_verified_at && isSmsVerified(profile.phone_channel)) {
          await ctx.sendSms(profile.phone, `Ika So : changez votre mot de passe (valable ${RESET_MINUTES} min) : ${link}`);
        }
      } catch { /* la réponse reste identique : un échec d'envoi ne doit rien révéler */ }
      return { sent: true };
    },

    /** Choisit un nouveau mot de passe avec le jeton reçu. Le jeton est à usage unique ; toutes les sessions ouvertes sont fermées. */
    async resetPassword({ token, password }) {
      const pass = String(password ?? "");
      if (pass.length < 8 || pass.length > 200) throw badRequest("Le mot de passe doit contenir au moins 8 caractères.");
      const hash = sha256(String(token ?? "").slice(0, 200));
      const newHash = await hashPassword(pass);
      return db.transaction(async (tx) => {
        const rows = await tx.query(
          "update ika_password_resets set used_at = now() where token_hash = $1 and used_at is null and expires_at > now() returning user_id",
          [hash],
        );
        if (!rows[0]) throw badRequest("Ce lien n'est plus valable. Refaites une demande de mot de passe oublié.");
        const userId = rows[0].user_id;
        await tx.query("update ika_users set password_hash = $2 where id = $1", [userId, newHash]);
        await tx.query("delete from ika_sessions where user_id = $1", [userId]);
        await tx.query("delete from ika_password_resets where user_id = $1 and used_at is null", [userId]);
        return { ok: true };
      });
    },

    /** Secours quand ni l'e-mail ni le SMS ne sont disponibles : un administrateur génère un lien à transmettre à la personne. Journalisé. */
    async staffResetLink(staffId, targetUserId) {
      await requireStaff(staffId, "ADMIN");
      const rows = await db.query("select id from ika_users where id = $1 and deleted_at is null", [String(targetUserId ?? "").slice(0, 80)]);
      if (!rows[0]) throw badRequest("Compte introuvable.");
      const token = newToken();
      await db.query("insert into ika_password_resets (token_hash, user_id, expires_at) values ($1, $2, now() + ($3 || ' minutes')::interval)", [sha256(token), rows[0].id, String(RESET_MINUTES)]);
      await audit(staffId, "STAFF_PASSWORD_RESET_LINK", null, rows[0].id);
      return { link: `${config.publicUrl || ""}/#/mot-de-passe-oublie?token=${token}`, validMinutes: RESET_MINUTES };
    },

    async logout(token) {
      if (token) await db.query("delete from ika_sessions where token_hash = $1", [sha256(token)]);
    },

    /** Utilisateur de la session, ou null. */
    async sessionUser(token) {
      if (!token || typeof token !== "string" || token.length > 200) return null;
      const rows = await db.query(
        `select u.id, u.email, u.name from ika_sessions s join ika_users u on u.id = s.user_id
         where s.token_hash = $1 and s.expires_at > now()`,
        [sha256(token)],
      );
      return rows[0] ?? null;
    },

    async me(userId) {
      const profile = await ensureProfile(userId);
      const favs = await db.query("select listing_id from ika_favorites where user_id = $1", [userId]);
      let pendingCount = 0;
      if (hasStaffRank(profile.staff_role, "MODERATOR")) {
        const n = await db.query("select count(*)::int as n from ika_listings where status = 'PENDING'");
        pendingCount = Number(n[0]?.n ?? 0);
      }
      return {
        staffRole: profile.staff_role,
        accountStatus: profile.account_status,
        statusReason: profile.status_reason ?? "",
        phone: profile.phone,
        phoneVerified: Boolean(profile.phone_verified_at),
        verifiedBySms: isSmsVerified(profile.phone_channel),
        displayRole: profile.display_role,
        agencyVerified: Boolean(profile.agency_verified_at),
        fullName: profile.full_name,
        favoriteIds: favs.map((f) => f.listing_id),
        pendingCount,
      };
    },

    async requestOtp(userId, { phone: rawPhone, displayRole }) {
      const profile = await ensureProfile(userId);
      assertCanPublish(profile);
      const phone = normalizePhone(String(rawPhone ?? ""));
      if (!phone) throw badRequest("Numéro malien invalide. Exemple : 76 12 34 56.");
      await assertNotBlacklisted(db, "PHONE", phone);
      const viaSms = smsConfigured(config);
      if (!viaSms && !config.allowDemoOtp && config.production) {
        throw new AppError(503, "La vérification par SMS n'est pas encore disponible. Réessayez plus tard.");
      }
      const role = OWNER_ROLES.includes(displayRole) ? displayRole : profile.display_role;
      // Un compte = un numéro vérifié.
      const taken = await db.query(
        `select user_id from ika_profiles
         where phone = $1 and phone_verified_at is not null and user_id <> $2 limit 1`,
        [phone, userId],
      );
      if (taken[0]) throw conflict("Ce numéro est déjà associé à un autre compte.");
      // Limitation en base : redemander un code ne remet pas les essais à zéro.
      const recent = await db.query(
        `select count(*)::int as n, max(created_at) as last from ika_otp
         where (user_id = $1 or phone = $2) and created_at > now() - interval '1 hour'`,
        [userId, phone],
      );
      const lastMs = recent[0]?.last ? Date.parse(iso(recent[0].last)) : null;
      const allowed = otpRequestAllowed(
        Number(recent[0]?.n ?? 0),
        Number.isFinite(lastMs) ? lastMs : null,
        Date.now(),
      );
      if (!allowed.ok) throw tooMany(allowed.message);

      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 10 ** OTP_LENGTH).padStart(
        OTP_LENGTH,
        "0",
      );
      const id = newId("otp");
      await db.query(
        "update ika_otp set consumed_at = now() where user_id = $1 and consumed_at is null",
        [userId],
      );
      await db.query(
        `insert into ika_otp (id, user_id, phone, code_hash, channel, expires_at)
         values ($1, $2, $3, $4, $5, now() + interval '10 minutes')`,
        [id, userId, phone, sha256(`${id}:${code}`), viaSms ? "SMS" : "DEMO"],
      );
      await db.query("update ika_profiles set display_role = $1 where user_id = $2", [role, userId]);
      if (viaSms) {
        try {
          await ctx.sendSms(phone, `Ika So : votre code est ${code}. Il expire dans 10 minutes.`);
        } catch (error) {
          await db.query("update ika_otp set consumed_at = now() where id = $1", [id]);
          throw error;
        }
      }
      return {
        demo: !viaSms,
        phone,
        hint: viaSms ? "" : code,
        message: viaSms
          ? "Code envoyé par SMS."
          : "Mode démonstration : aucun SMS réel n'est envoyé et ce numéro ne recevra pas le badge « vérifié ». Code :",
      };
    },

    async verifyOtp(userId, rawCode) {
      const profile = await ensureProfile(userId);
      assertCanPublish(profile);
      const code = String(rawCode ?? "").replace(/\D/g, "").slice(0, OTP_LENGTH);
      const rows = await db.query(
        `select id, code_hash, attempts, phone, channel from ika_otp
         where user_id = $1 and consumed_at is null and expires_at > now()
         order by created_at desc limit 1`,
        [userId],
      );
      const row = rows[0];
      if (!row) throw badRequest("Demandez un nouveau code.");
      if (Number(row.attempts) >= OTP_MAX_ATTEMPTS) throw badRequest("Trop d'essais. Demandez un nouveau code.");
      if (code.length !== OTP_LENGTH || !sameHash(sha256(`${row.id}:${code}`), row.code_hash)) {
        await db.query("update ika_otp set attempts = attempts + 1 where id = $1", [row.id]);
        throw badRequest("Code incorrect.");
      }
      const consumed = await db.query(
        "update ika_otp set consumed_at = now() where id = $1 and consumed_at is null returning id",
        [row.id],
      );
      if (!consumed[0]) throw badRequest("Demandez un nouveau code.");
      try {
        await db.query(
          `update ika_profiles set phone_verified_at = now(), phone = $1, phone_channel = $2
           where user_id = $3`,
          [row.phone, row.channel, userId],
        );
      } catch (error) {
        if (error?.code === "23505") throw conflict("Ce numéro est déjà associé à un autre compte.");
        throw error;
      }
      return { ok: true, phone: row.phone, verifiedBySms: isSmsVerified(row.channel) };
    },
  };
}
