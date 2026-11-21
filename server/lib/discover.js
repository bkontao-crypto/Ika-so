// « Découvrir » : publications de la communauté (actualité, information, demande), distinctes des annonces professionnelles.
export const KINDS = Object.freeze({ ACTUALITE: "Actualité", RECHERCHE: "Je cherche", INFORMATION: "Information" });
export const CATEGORIES = Object.freeze(["Terrain", "Maison", "Appartement", "Studio", "Local commercial", "Bureau"]);
export const REPORT_REASONS = Object.freeze(["Annonce déguisée ou publicité", "Arnaque ou demande d'argent", "Contenu choquant ou insultant", "Numéro de téléphone ou contact direct", "Autre"]);
export const TEXT_MIN = 5;
export const TEXT_MAX = 2000;

/**
 * Détecte un numéro de téléphone saisi dans le texte (les échanges passent par la messagerie du site) :
 * indicatif +223 / 00223 ; 8 chiffres groupés par deux avec le même séparateur (76 00 00 00) ; 8 chiffres collés commençant par 5, 6, 7 ou 9.
 * Un prix groupé par trois (« 25 000 000 ») n'est pas pris pour un numéro.
 */
export function containsPhone(text) {
  const t = String(text ?? "");
  return /(?:\+|00)\s*223/.test(t)
    || /(?<!\d)\d{2}([\s.\-])\d{2}\1\d{2}\1\d{2}(?!\d)/.test(t)
    || /(?<!\d)[5679]\d{7}(?!\d)/.test(t);
}
