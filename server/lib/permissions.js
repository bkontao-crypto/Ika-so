// Permissions nommées, refus par défaut. Module pur (sans base) : reflète l'amorçage de la migration 025,
// plus 3 codes ajoutés ensuite (contenu.gerer, offres.tarifs, owner.stats) qui NE SONT PAS ENCORE en base :
// une migration additive (ika_permissions + ika_role_permissions) est requise avant tout octroi individuel (clé étrangère).
// Branché progressivement via accounts.requirePermission (BUG-004) ; requireStaff reste en place pour le reste.
const MOD = ["moderation.review", "moderation.restrict", "trust.proof_review"];
const ADMIN_ONLY = ["trust.agency_badge", "trust.badge_remove", "trust.blacklist", "account.ban", "payments.manage", "audit.read", "analytics.read", "contenu.gerer"];
const SUPER_ONLY = ["premium.decide", "staff.role_change", "superadmin.slot_manage", "permissions.grant", "offres.tarifs", "owner.stats"];

export const ROLE_PERMISSIONS = Object.freeze({
  MODERATOR: Object.freeze([...MOD]),
  ADMIN: Object.freeze([...MOD, ...ADMIN_ONLY]),
  SUPERADMIN: Object.freeze([...MOD, ...ADMIN_ONLY, ...SUPER_ONLY]),
});
/** Jamais accordables à titre individuel. */
export const NON_DELEGABLE = Object.freeze(["staff.role_change", "superadmin.slot_manage", "permissions.grant", "owner.stats"]);
export const ALL_PERMISSIONS = ROLE_PERMISSIONS.SUPERADMIN;

/** `grants` : codes accordés individuellement et non expirés. Permission inconnue ou rôle inconnu : refus. */
export function can(role, permission, grants = []) {
  if (!ALL_PERMISSIONS.includes(permission)) return false;
  if (!Object.hasOwn(ROLE_PERMISSIONS, role)) return false;
  if (ROLE_PERMISSIONS[role].includes(permission)) return true;
  return grants.includes(permission) && !NON_DELEGABLE.includes(permission);
}

/** Règles d'octroi : seul un SUPERADMIN accorde ; jamais à soi-même ; jamais une permission non délégable ; cible = personnel. */
export function assertCanGrant({ actorId, actorRole, targetId, targetRole, permission, reason }) {
  if (!can(actorRole, "permissions.grant")) throw new Error("Réservé au super administrateur.");
  if (actorId === targetId) throw new Error("Nul ne peut s'accorder une permission.");
  if (!ALL_PERMISSIONS.includes(permission)) throw new Error("Permission inconnue.");
  if (NON_DELEGABLE.includes(permission)) throw new Error("Permission non délégable.");
  if (!["MODERATOR", "ADMIN"].includes(targetRole)) throw new Error("La cible doit être un administrateur ou un modérateur.");
  if (!String(reason ?? "").trim()) throw new Error("Motif obligatoire.");
}
