// Double authentification (MFA) : activation, vérification, désactivation, codes de secours.
// Étape 2a : service autonome, pas encore branché à la connexion ni aux routes (étape 2b).
// `key` : clé de chiffrement des secrets (Buffer de 32 octets, voir parseKey). Sans elle, l'activation est refusée (503) : rien n'est stocké en clair.
import { AppError, badRequest, conflict, forbidden, tooMany, unauthorized } from "../lib/errors.js";
import { newId } from "../lib/security.js";
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
const LOCK_MINUTES = 15; // …avant un blocage de cette durée (comptés depuis la dernière réussite)

export function createMfa(ctx) {
  const { db, key = null } = ctx;

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
    const row = (await db.query("select secret_enc, confirmed_at, last_step from ika_mfa_secrets where user_id = $1", [userId]))[0];
    if (!row || (requireConfirmed && !row.confirmed_at)) return null;
    const text = String(rawCode ?? "").trim().slice(0, 40);
    const step = verifyTotp(decryptSecret(row.secret_enc, key), text, { lastStep: row.last_step });
    if (step !== null) {
      // Atomique : si deux demandes arrivent avec le même code, une seule passe.
      const done = await db.query("update ika_mfa_secrets set last_step = $2 where user_id = $1 and (last_step is null or last_step < $2) returning user_id", [userId, step]);
      return done[0] ? "TOTP" : null;
    }
    if (row.confirmed_at && normalizeBackupCode(text).length === 10) {
      const used = await db.query("update ika_mfa_backup_codes set used_at = now() where user_id = $1 and code_hash = $2 and used_at is null returning id", [userId, hashBackupCode(text)]);
      if (used[0]) return "BACKUP";
    }
    return null;
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
      const row = (await db.query("select confirmed_at from ika_mfa_secrets where user_id = $1", [userId]))[0];
      return { enabled: Boolean(row?.confirmed_at), pending: Boolean(row && !row.confirmed_at), backupCodesLeft: row?.confirmed_at ? await backupLeft(userId) : 0 };
    },

    /** Début d'activation : nouveau secret à scanner. Inactif tant qu'un premier code valide n'a pas été saisi. */
    async begin(userId) {
      requireKey();
      const user = (await db.query("select email from ika_users where id = $1", [userId]))[0];
      if (!user) throw unauthorized("Connexion requise.");
      const secret = generateSecret();
      const rows = await db.query(
        `insert into ika_mfa_secrets (user_id, secret_enc) values ($1, $2)
         on conflict (user_id) do update set secret_enc = excluded.secret_enc, last_step = null, created_at = now()
         where ika_mfa_secrets.confirmed_at is null returning user_id`,
        [userId, encryptSecret(secret, key)],
      );
      if (!rows[0]) throw conflict("La double authentification est déjà activée.");
      return { secret, otpauthUri: otpauthUri(secret, user.email) };
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
