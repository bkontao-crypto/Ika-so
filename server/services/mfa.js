// Double authentification (MFA) : activation, vérification, désactivation, codes de secours.
// Étape 2a : service autonome, pas encore branché à la connexion ni aux routes (étape 2b).
// `key` : clé de chiffrement des secrets (Buffer de 32 octets, voir parseKey). Sans elle, l'activation est refusée (503) : rien n'est stocké en clair.
import { AppError, badRequest, conflict, forbidden, tooMany, unauthorized } from "../lib/errors.js";
import { randomInt } from "node:crypto";
import { newId, sha256 } from "../lib/security.js";
import { brand } from "../lib/brand.js";
import {
  BACKUP_CODE_COUNT,
  decryptSecret,
  encryptSecret,
  generateBackupCodes,
  generateSecret,
  hashBackupCode,
  normalizeBackupCode,
  otpauthUri,
  verifyTotp,
} from "../lib/totp.js";

const MAX_FAILURES = 5; // essais ratés tolérés…
const GRACE_DAYS = 14; // Admin et Modérateurs : délai après l'activation de l'obligation (le Superadmin est concerné dès l'activation)
const STAFF = new Set(["MODERATOR", "ADMIN", "SUPERADMIN"]);
const METHODS = ["APP", "EMAIL", "SMS"];
const OTP_MINUTES = 10; // validité d'un code reçu par e-mail ou SMS
const OTP_MIN_GAP_SECONDS = 45; // délai minimal entre deux envois
const OTP_PER_HOUR = 5;
const LOCK_MINUTES = 15; // …avant un blocage de cette durée (comptés depuis la dernière réussite)

export function createMfa(ctx) {
  const { db, key = null, sendEmail = null, sendSms = null } = ctx;

  function requireKey() {
    if (!key) throw new AppError(503, "La double authentification n'est pas encore configurée sur ce serveur.");
  }

  async function audit(userId, action, note, q = db) {
    await q.query("insert into ika_audit (id, actor_id, action, listing_id, note) values ($1, $2, $3, null, $4)", [newId("aud"), userId, action, note]);
  }

  async function assertNotLocked(userId) {
    const rows = await db.query(
      `select count(*)::int as n from ika_mfa_attempts
       where user_id = $1 and ok = false and created_at > now() - ($2 || ' minutes')::interval
         and created_at > coalesce((select max(created_at) from ika_mfa_attempts where user_id = $1 and ok = true), '-infinity'::timestamptz)`,
      [userId, String(LOCK_MINUTES)],
    );
    if (Number(rows[0]?.n ?? 0) >= MAX_FAILURES) throw tooMany(`Trop d'essais. Réessayez dans ${LOCK_MINUTES} minutes.`);
  }

  const record = (userId, ok) => db.query("insert into ika_mfa_attempts (user_id, ok) values ($1, $2)", [userId, ok]);

  /** Accepte un code de l'appli ou un code de secours, et le « consomme ». Retourne "TOTP", "BACKUP" ou null. */
  async function consumeCode(userId, rawCode, { requireConfirmed }) {
    const row = (await db.query("select secret_enc, confirmed_at, last_step, method from ika_mfa_secrets where user_id = $1", [userId]))[0];
    if (!row || (requireConfirmed && !row.confirmed_at)) return null;
    const text = String(rawCode ?? "").trim().slice(0, 40);
    if (row.method !== "APP") {
      // Code reçu par e-mail ou SMS : 6 chiffres, valable 10 minutes, un seul usage (consommé atomiquement).
      if (/^\d{6}$/.test(text)) {
        const used = await db.query("update ika_mfa_otps set used_at = now() where user_id = $1 and code_hash = $2 and used_at is null and expires_at > now() returning id", [userId, hashOtp(userId, text)]);
        if (used[0]) return "OTP";
      }
    } else {
    const step = verifyTotp(decryptSecret(row.secret_enc, key), text, { lastStep: row.last_step });
    if (step !== null) {
      // Atomique : si deux demandes arrivent avec le même code, une seule passe.
      const done = await db.query("update ika_mfa_secrets set last_step = $2 where user_id = $1 and (last_step is null or last_step < $2) returning user_id", [userId, step]);
      return done[0] ? "TOTP" : null;
    }
    }
    if (row.confirmed_at && normalizeBackupCode(text).length === 10) {
      const used = await db.query("update ika_mfa_backup_codes set used_at = now() where user_id = $1 and code_hash = $2 and used_at is null returning id", [userId, hashBackupCode(text)]);
      if (used[0]) return "BACKUP";
    }
    return null;
  }

  const hashOtp = (userId, code) => sha256(`${userId}:${code}`);

  /** Méthodes proposées aujourd'hui : l'application toujours (si la clé existe), l'e-mail et le SMS seulement si un fournisseur est configuré. */
  const available = () => ({ app: Boolean(key), email: Boolean(key && sendEmail), sms: Boolean(key && sendSms) });

  const maskEmail = (e) => { const [u, d = ""] = String(e).split("@"); return `${u.slice(0, 1)}${"•".repeat(Math.max(2, Math.min(5, u.length - 1)))}@${d}`; };
  const maskPhone = (p) => { const d = String(p).replace(/\D/g, ""); return `+${d.slice(0, 3)} •• •• ${d.slice(-2)}`; };

  /** Où envoyer le code : e-mail du compte, ou numéro de téléphone DÉJÀ vérifié (jamais un numéro non contrôlé). */
  async function destination(userId, method) {
    if (method === "EMAIL") {
      const u = (await db.query("select email from ika_users where id = $1", [userId]))[0];
      if (!u?.email) throw badRequest("Aucune adresse e-mail sur ce compte.");
      return { to: u.email, masked: maskEmail(u.email) };
    }
    const p = (await db.query("select phone, phone_verified_at from ika_profiles where user_id = $1", [userId]))[0];
    if (!p?.phone || !p.phone_verified_at) throw badRequest("Vérifiez d'abord votre numéro de téléphone dans votre profil pour recevoir les codes par SMS.");
    return { to: p.phone, masked: maskPhone(p.phone) };
  }

  /** Envoie un code à usage unique (méthodes e-mail et SMS). Au plus un envoi toutes les 45 s et 5 par heure. */
  async function sendCode(userId) {
    const row = (await db.query("select method from ika_mfa_secrets where user_id = $1", [userId]))[0];
    if (!row || row.method === "APP") throw badRequest("Cette méthode n'utilise pas de code envoyé.");
    const sender = row.method === "EMAIL" ? sendEmail : sendSms;
    if (!sender) throw new AppError(503, "L'envoi de codes n'est pas configuré sur ce serveur.");
    const recent = (await db.query(
      `select count(*) filter (where created_at > now() - ($2 || ' seconds')::interval)::int as gap, count(*)::int as hour
       from ika_mfa_otps where user_id = $1 and created_at > now() - interval '1 hour'`,
      [userId, String(OTP_MIN_GAP_SECONDS)],
    ))[0];
    if (Number(recent.gap) > 0) throw tooMany(`Patientez ${OTP_MIN_GAP_SECONDS} secondes avant de demander un nouveau code.`);
    if (Number(recent.hour) >= OTP_PER_HOUR) throw tooMany("Trop de codes demandés. Réessayez dans une heure, ou utilisez un code de secours.");
    const dest = await destination(userId, row.method);
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const id = newId("otp");
    await db.transaction(async (tx) => {
      await tx.query("update ika_mfa_otps set used_at = now() where user_id = $1 and used_at is null", [userId]); // l'ancien code n'est plus valable
      await tx.query("insert into ika_mfa_otps (id, user_id, code_hash, expires_at) values ($1, $2, $3, now() + ($4 || ' minutes')::interval)", [id, userId, hashOtp(userId, code), String(OTP_MINUTES)]);
    });
    try {
      if (row.method === "EMAIL") await sender({ to: dest.to, subject: brand() + " : votre code de vérification", text: `Votre code de vérification ${brand()} : ${code}\n\nIl est valable ${OTP_MINUTES} minutes et ne sert qu'une fois. Ne le communiquez à personne, même à l'équipe ${brand()}.` });
      else await sender(dest.to, `${brand()} : votre code ${code} (valable ${OTP_MINUTES} min). Ne le partagez avec personne.`);
    } catch {
      await db.query("delete from ika_mfa_otps where id = $1", [id]);
      throw new AppError(502, "L'envoi du code a échoué. Réessayez dans un instant, ou utilisez un code de secours.");
    }
    return { method: row.method, sentTo: dest.masked, expiresInMinutes: OTP_MINUTES };
  }

  async function backupLeft(userId) {
    return Number((await db.query("select count(*)::int as n from ika_mfa_backup_codes where user_id = $1 and used_at is null", [userId]))[0]?.n ?? 0);
  }

  async function replaceBackupCodes(tx, userId) {
    const codes = generateBackupCodes(BACKUP_CODE_COUNT);
    await tx.query("delete from ika_mfa_backup_codes where user_id = $1", [userId]);
    for (const code of codes) {
      await tx.query("insert into ika_mfa_backup_codes (id, user_id, code_hash) values ($1, $2, $3)", [newId("mbc"), userId, hashBackupCode(code)]);
    }
    return codes;
  }

  /** Vérifie un code pour une action sensible ou une connexion. Lève 401 si faux, 429 si trop d'essais. */
  async function verify(userId, code) {
    requireKey();
    await assertNotLocked(userId);
    const method = await consumeCode(userId, code, { requireConfirmed: true });
    await record(userId, Boolean(method));
    if (!method) throw unauthorized("Code incorrect.");
    return { ok: true, method, backupCodesLeft: await backupLeft(userId) };
  }

  /** Réglage « MFA obligatoire » (ika_settings) et date de son activation. */
  async function requirement() {
    const rows = await db.query("select key, value from ika_settings where key in ('mfa_required', 'mfa_required_since')");
    const get = (k) => rows.find((r) => r.key === k)?.value;
    const since = get("mfa_required_since") ? new Date(get("mfa_required_since")) : null;
    const required = get("mfa_required") === "true";
    return { required, since: required ? since : null, graceEndsAt: required && since ? new Date(since.getTime() + GRACE_DAYS * 86_400_000) : null };
  }

  const isEnabled = async (userId) => Boolean((await db.query("select 1 from ika_mfa_secrets where user_id = $1 and confirmed_at is not null", [userId]))[0]);

  return {
    verify,
    requirement,

    /** Les deux emplacements Superadmin (principal, secondaire) : titulaire, statut du compte, MFA. Lecture seule ; la route la réserve au Superadmin. */
    async superadminSlots() {
      const rows = await db.query(
        `select p.superadmin_slot as slot, p.user_id, p.account_status, u.name, u.email,
                exists (select 1 from ika_mfa_secrets s where s.user_id = p.user_id and s.confirmed_at is not null) as mfa
         from ika_profiles p join ika_users u on u.id = p.user_id
         where p.staff_role = 'SUPERADMIN'`,
      );
      const slots = ["PRINCIPAL", "SECONDARY"].map((slot) => {
        const r = rows.find((x) => x.slot === slot);
        return r ? { slot, userId: r.user_id, name: r.name, email: r.email, status: r.account_status, mfa: Boolean(r.mfa) } : { slot, userId: null, name: null, email: null, status: null, mfa: false };
      });
      return { slots, withoutSlot: rows.filter((x) => !x.slot).length };
    },

    /** Porte du personnel : appelée par requireStaff / requirePermission. Sans clé de chiffrement, personne ne peut s'inscrire : on ne bloque jamais. */
    async staffGate(profile) {
      if (!key || !STAFF.has(profile.staff_role)) return;
      const r = await requirement();
      if (!r.required) return;
      if (profile.staff_role !== "SUPERADMIN" && (!r.graceEndsAt || Date.now() < r.graceEndsAt.getTime())) return;
      if (await isEnabled(profile.user_id)) return;
      throw forbidden("La double authentification est obligatoire pour votre rôle. Activez-la dans Mon profil, section Double authentification.");
    },

    /** Superadmin seulement (contrôlé par la route). Exige que l'auteur ait déjà activé sa propre MFA, pour ne pas se verrouiller. */
    async setRequired(actorId, on) {
      requireKey();
      if (on && !(await isEnabled(actorId))) throw badRequest("Activez d'abord votre propre double authentification.");
      await db.transaction(async (tx) => {
        const was = (await tx.query("select value from ika_settings where key = 'mfa_required'"))[0]?.value === "true";
        await tx.query("insert into ika_settings (key, value) values ('mfa_required', $1) on conflict (key) do update set value = excluded.value", [on ? "true" : "false"]);
        if (on && !was) await tx.query("insert into ika_settings (key, value) values ('mfa_required_since', $1) on conflict (key) do update set value = excluded.value", [new Date().toISOString()]);
        if (!on) await tx.query("delete from ika_settings where key = 'mfa_required_since'");
        if (on !== was) await audit(actorId, on ? "MFA_REQUIRED_ON" : "MFA_REQUIRED_OFF", on ? "MFA rendue obligatoire pour le personnel" : "Obligation de MFA levée", tx);
      });
      return requirement();
    },

    async status(userId) {
      const row = (await db.query("select confirmed_at, method from ika_mfa_secrets where user_id = $1", [userId]))[0];
      const phone = (await db.query("select phone_verified_at from ika_profiles where user_id = $1", [userId]))[0];
      return {
        enabled: Boolean(row?.confirmed_at), pending: Boolean(row && !row.confirmed_at), backupCodesLeft: row?.confirmed_at ? await backupLeft(userId) : 0,
        method: row?.method ?? null, available: available(), phoneVerified: Boolean(phone?.phone_verified_at),
      };
    },

    available,
    sendCode,

    /** Méthode de la vérification en attente (page de connexion) : pour afficher la bonne consigne. Jamais de secret. */
    async pendingInfo(userId) {
      const row = (await db.query("select method from ika_mfa_secrets where user_id = $1 and confirmed_at is not null", [userId]))[0];
      if (!row) return { method: null, sentTo: null };
      if (row.method === "APP") return { method: "APP", sentTo: null };
      const dest = await destination(userId, row.method).catch(() => null);
      return { method: row.method, sentTo: dest?.masked ?? null };
    },

    /** Début d'activation : nouveau secret à scanner. Inactif tant qu'un premier code valide n'a pas été saisi. */
    async begin(userId, method = "APP") {
      requireKey();
      if (!METHODS.includes(method)) throw badRequest("Méthode inconnue : choisissez APP, EMAIL ou SMS.");
      const user = (await db.query("select email from ika_users where id = $1", [userId]))[0];
      if (!user) throw unauthorized("Connexion requise.");
      if (method === "EMAIL" && !sendEmail) throw badRequest("Le code par e-mail n'est pas disponible sur ce serveur.");
      if (method === "SMS" && !sendSms) throw badRequest("Le code par SMS n'est pas disponible sur ce serveur.");
      if (method !== "APP") await destination(userId, method); // refuse tout de suite un numéro non vérifié
      const secret = generateSecret(); // pour les méthodes e-mail et SMS : valeur de remplissage, jamais communiquée ni acceptée
      const rows = await db.query(
        `insert into ika_mfa_secrets (user_id, secret_enc, method) values ($1, $2, $3)
         on conflict (user_id) do update set secret_enc = excluded.secret_enc, method = excluded.method, last_step = null, created_at = now()
         where ika_mfa_secrets.confirmed_at is null returning user_id`,
        [userId, encryptSecret(secret, key), method],
      );
      if (!rows[0]) throw conflict("La double authentification est déjà activée.");
      if (method === "APP") return { method, secret, otpauthUri: otpauthUri(secret, user.email) };
      return sendCode(userId);
    },

    /** Fin d'activation : un code valide prouve que l'appli est bien configurée. Retourne les codes de secours (montrés une seule fois). */
    async confirm(userId, code) {
      requireKey();
      await assertNotLocked(userId);
      const pending = (await db.query("select confirmed_at from ika_mfa_secrets where user_id = $1", [userId]))[0];
      if (!pending || pending.confirmed_at) throw badRequest("Aucune activation en cours.");
      const method = await consumeCode(userId, code, { requireConfirmed: false });
      await record(userId, Boolean(method));
      if (!method) throw badRequest("Code incorrect.");
      const codes = await db.transaction(async (tx) => {
        await tx.query("update ika_mfa_secrets set confirmed_at = now() where user_id = $1", [userId]);
        const fresh = await replaceBackupCodes(tx, userId);
        await audit(userId, "MFA_ENABLED", "Double authentification activée", tx);
        return fresh;
      });
      return { backupCodes: codes };
    },

    /** Nouveaux codes de secours (les anciens cessent de fonctionner). Exige un code valide. */
    async regenerateBackupCodes(userId, code) {
      await verify(userId, code);
      const codes = await db.transaction(async (tx) => {
        const fresh = await replaceBackupCodes(tx, userId);
        await audit(userId, "MFA_BACKUP_REGENERATED", "Codes de secours renouvelés", tx);
        return fresh;
      });
      return { backupCodes: codes };
    },

    /** Désactivation. Exige un code valide. Refusée pour le personnel quand la MFA est obligatoire. */
    async disable(userId, code) {
      const role = (await db.query("select staff_role from ika_profiles where user_id = $1", [userId]))[0]?.staff_role;
      if (STAFF.has(role) && (await requirement()).required) throw forbidden("La double authentification est obligatoire pour votre rôle : elle ne peut pas être désactivée.");
      await verify(userId, code);
      await db.transaction(async (tx) => {
        await tx.query("delete from ika_mfa_backup_codes where user_id = $1", [userId]);
        await tx.query("delete from ika_mfa_secrets where user_id = $1", [userId]);
        await audit(userId, "MFA_DISABLED", "Double authentification désactivée", tx);
      });
      return { ok: true };
    },
  };
}
