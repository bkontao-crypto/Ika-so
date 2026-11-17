// Brouillon d'annonce : une copie locale PAR COMPTE. Un brouillon n'est jamais lu pour un autre compte.
// Le serveur garde aussi une copie (/me/draft) pour suivre le compte d'un appareil à l'autre.
//
// Ancien brouillon sans compte (clé ika-so-draft) : JAMAIS supprimé ni rattaché automatiquement.
// Il n'est jamais chargé dans le formulaire. Seul un clic explicite d'un utilisateur connecté peut le
// récupérer (copie vers son brouillon, sans écrasement) ou le supprimer (après confirmation).

export const LEGACY_DRAFT_KEY = "ika-so-draft";

export const draftKey = (userId) => `ika-so-draft:${userId}`;

function localStore() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

/** Présence et date de l'ancien brouillon, sans rien modifier. null s'il n'existe pas. */
export function legacyDraftInfo(storage = localStore()) {
  try {
    const raw = storage?.getItem(LEGACY_DRAFT_KEY);
    if (raw == null) return null;
    let savedAt = null;
    try { savedAt = JSON.parse(raw)?.savedAt ?? null; } catch { /* illisible : date inconnue */ }
    return { savedAt };
  } catch {
    return null;
  }
}

/** Récupération explicite. Refusée si le compte a déjà un brouillon (jamais d'écrasement). L'ancien n'est retiré qu'après copie vérifiée. */
export function claimLegacyDraft(userId, storage = localStore()) {
  try {
    const raw = storage?.getItem(LEGACY_DRAFT_KEY);
    if (raw == null || !userId) return false;
    if (storage.getItem(draftKey(userId)) != null) return false;
    storage.setItem(draftKey(userId), raw);
    if (storage.getItem(draftKey(userId)) !== raw) return false;
    storage.removeItem(LEGACY_DRAFT_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Suppression explicite, uniquement après confirmation de l'utilisateur. */
export function discardLegacyDraft(storage = localStore()) {
  try { storage?.removeItem(LEGACY_DRAFT_KEY); } catch { /* ignoré */ }
}
