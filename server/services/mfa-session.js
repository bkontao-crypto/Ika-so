// MFA et sessions : une session ouverte par mot de passe, Google ou ticket d'application reste « en attente »
// tant que le code MFA n'a pas été saisi, pour les comptes qui ont activé la MFA.
// Un seul point de contrôle (server/app.js) : aucun chemin de connexion ne peut le contourner.
import { sha256 } from "../lib/security.js";

export function createMfaSessions({ db }) {
  return {
    /** État de la session : la MFA est-elle activée sur le compte, et la session a-t-elle été vérifiée ? */
    async state(token) {
      const rows = await db.query(
        `select s.mfa_verified_at, (m.confirmed_at is not null) as enabled
         from ika_sessions s left join ika_mfa_secrets m on m.user_id = s.user_id
         where s.token_hash = $1 and s.expires_at > now()`,
        [sha256(token)],
      );
      return { enabled: Boolean(rows[0]?.enabled), verified: Boolean(rows[0]?.mfa_verified_at) };
    },

    async markVerified(token) {
      await db.query("update ika_sessions set mfa_verified_at = now() where token_hash = $1", [sha256(token)]);
    },
  };
}
