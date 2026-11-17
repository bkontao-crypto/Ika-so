// Brouillon d'annonce : une copie locale PAR COMPTE. Un brouillon n'est jamais lu pour un autre compte.
// Le serveur garde aussi une copie (/me/draft) pour suivre le compte d'un appareil à l'autre.

/** Ancien format (sans compte) : n'est plus jamais lu pour un compte. */
export const LEGACY_DRAFT_KEY = "ika-so-draft";

export const draftKey = (userId) => `ika-so-draft:${userId}`;

function localStore() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

/**
 * Traite l'ancien brouillon sans compte.
 * - À la déconnexion (userId connu) : il est rangé dans le brouillon de ce compte, s'il n'en a pas déjà un.
 * - À l'ouverture de la publication (userId null) : il est retiré. Un compte connecté a sa copie sur le serveur.
 * Dans les deux cas, il n'est plus jamais lu pour un autre compte.
 */
export function moveLegacyDraft(userId = null, storage = localStore()) {
  try {
    const legacy = storage?.getItem(LEGACY_DRAFT_KEY);
    if (legacy == null) return;
    if (userId && storage.getItem(draftKey(userId)) == null) storage.setItem(draftKey(userId), legacy);
    storage.removeItem(LEGACY_DRAFT_KEY);
  } catch { /* stockage indisponible : rien à faire */ }
}
