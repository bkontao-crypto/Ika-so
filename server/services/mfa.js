// MFA par application d'authentification (TOTP) + codes de secours à usage unique.
// Socle seulement : ce service n'est pas encore branché sur la connexion ni sur les routes.
import { randomBytes } from "node:crypto";
import { AppError, badRequest, conflict, tooMany } from "../lib/errors.js";
import { newId, sha256 } from "../lib/security.js";
import { base32Decode, base32Encode, verifyTotp } from "../lib/totp.js";
import { open, parseKey, seal } from "../lib/secret-box.js";

const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;
const RECOVERY_COUNT = 8;
const ISSUER = "Ika So";

function newRecoveryCode() {
  const raw = randomBytes(5).toString("hex");
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

/** Forme canonique d'un code de secours saisi (casse et tiret libres), ou null. */
function canonicalRecovery(input) {
  const hex = String(input ?? "").toLowerCase().replace(/[^0-9a-f]/g, "");
  return hex.length === 10 ? `${hex.slice(0, 5)}-${hex.slice(5)}` : null;
}

export function createMfa(ctx, { key } = {}) {
  const { db, config } = ctx;

  function secretKey() {
    if (key) return key;
    const raw = config?.mfaEncryptionKey ?? process.env.MFA_ENCRYPTION_KEY;
    if (!raw) throw new AppError(503, "La double authentification n'est pas encore configurée sur le serveur.");
    return parseKey(raw);
  }

  async function load(userId) {
    const rows = await db.query(
      "select secret_enc, enabled_at, last_step, failed_attempts, locked_until from ika_mfa where user_id = $1",
      [userId],
    );
    return rows[0] ?? null;
  }

  function assertNotLocked(row) {
    if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
      throw tooMany("Trop d'essais. Réessayez dans quelques minutes.");
    }
  }

  async function registerFailure(userId) {
    await db.query(
      `update ika_mfa set failed_attempts = failed_attempts + 1,
         locked_until = case when failed_attempts + 1 >= $2 then now() + ($3 || ' minutes')::interval else locked_until end
       where user_id = $1`,
      [userId, MAX_FAILURES, String(LOCK_MINUTES)],
    );
  }

  return {
    async status(userId) {
      const row = await load(userId);
      const left = row?.enabled_at
        ? await db.query("select count(*)::int as n from ika_mfa_recovery_codes where user_id = $1 and used_at is null", [userId])
        : [];
      return { enabled: Boolean(row?.enabled_at), recoveryCodesLeft: Number(left[0]?.n ?? 0) };
    },

    /** Première étape : génère un secret (non actif tant que le code n'est pas confirmé). */
    async beginEnrollment(userId, accountLabel) {
      const k = secretKey();
      const row = await load(userId);
      if (row?.enabled_at) throw conflict("La double authentification est déjà activée.");
      const secret = base32Encode(randomBytes(20));
      await db.query(
        `insert into ika_mfa (user_id, secret_enc) values ($1, $2)
         on conflict (user_id) do update set secret_enc = $2, last_step = 0, failed_attempts = 0, locked_until = null, created_at = now()
         where ika_mfa.enabled_at is null`,
        [userId, seal(k, secret)],
      );
      const label = encodeURIComponent(`${ISSUER}:${String(accountLabel ?? userId).slice(0, 120)}`);
      return {
        secret,
        otpauthUri: `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(ISSUER)}&algorithm=SHA1&digits=6&period=30`,
      };
    },

    /** Deuxième étape : un code valide active la MFA et renvoie les codes de secours (affichés une seule fois). */
    async confirmEnrollment(userId, code) {
      const k = secretKey();
      const row = await load(userId);
      if (!row) throw badRequest("Démarrez d'abord l'activation.");
      if (row.enabled_at) throw conflict("La double authentification est déjà activée.");
      assertNotLocked(row);
      const step = verifyTotp(base32Decode(open(k, row.secret_enc)), code);
      if (step === null) {
        await registerFailure(userId);
        throw badRequest("Code incorrect.");
      }
      const codes = Array.from({ length: RECOVERY_COUNT }, newRecoveryCode);
      await db.transaction(async (tx) => {
        const done = await tx.query(
          "update ika_mfa set enabled_at = now(), last_step = $2, failed_attempts = 0, locked_until = null where user_id = $1 and enabled_at is null returning user_id",
          [userId, step],
        );
        if (!done[0]) throw conflict("La double authentification est déjà activée.");
        await tx.query("delete from ika_mfa_recovery_codes where user_id = $1", [userId]);
        for (const c of codes) {
          await tx.query("insert into ika_mfa_recovery_codes (id, user_id, code_hash) values ($1, $2, $3)", [newId("mfr"), userId, sha256(c)]);
        }
      });
      return { recoveryCodes: codes };
    },

    /** Vérifie un code à 6 chiffres (usage unique par pas de temps) ou un code de secours (usage unique). */
    async verifyChallenge(userId, rawCode) {
      const row = await load(userId);
      if (!row?.enabled_at) throw badRequest("La double authentification n'est pas activée.");
      assertNotLocked(row);
      const text = String(rawCode ?? "").trim();
      const digits = text.replace(/\s+/g, "");
      if (/^\d{6}$/.test(digits)) {
        const step = verifyTotp(base32Decode(open(secretKey(), row.secret_enc)), digits, { lastStep: Number(row.last_step) });
        if (step !== null) {
          const claim = await db.query(
            "update ika_mfa set last_step = $2, failed_attempts = 0, locked_until = null where user_id = $1 and last_step < $2 returning user_id",
            [userId, step],
          );
          if (claim[0]) return { ok: true, method: "TOTP" };
        }
      } else {
        const canonical = canonicalRecovery(text);
        if (canonical) {
          const used = await db.query(
            "update ika_mfa_recovery_codes set used_at = now() where user_id = $1 and code_hash = $2 and used_at is null returning id",
            [userId, sha256(canonical)],
          );
          if (used[0]) {
            await db.query("update ika_mfa set failed_attempts = 0, locked_until = null where user_id = $1", [userId]);
            return { ok: true, method: "RECOVERY" };
          }
        }
      }
      await registerFailure(userId);
      throw badRequest("Code incorrect.");
    },
  };
}
