/** Erreur prévue : son message est montré à l'utilisateur, son statut devient le code HTTP. */
export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}

export const badRequest = (message) => new AppError(400, message);
export const unauthorized = (message = "Connectez-vous pour continuer.") => new AppError(401, message);
export const forbidden = (message = "Action non autorisée.") => new AppError(403, message);
export const notFound = (message = "Introuvable.") => new AppError(404, message);
export const conflict = (message) => new AppError(409, message);
export const tooMany = (message = "Trop de demandes. Réessayez dans quelques minutes.") =>
  new AppError(429, message);

/**
 * Les règles métier de rules.js lèvent des Error simples (messages en français).
 * On les convertit en 400 ; toute autre erreur reste une erreur serveur.
 */
export function asBadRequest(fn) {
  try {
    return fn();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw badRequest(error instanceof Error ? error.message : "Demande invalide.");
  }
}
