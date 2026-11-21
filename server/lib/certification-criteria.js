// Critères de certification du centre de contrôle Premium : règle configurable (réglage officiel « account_rules », jamais codée en dur)
// évaluée sur des faits réels du compte. Module pur (sans base). Le choix des critères exigés se change dans « Conditions & exceptions » ;
// seul un NOUVEAU critère demande du code (une ligne ci-dessous).
import { badRequest } from "./errors.js";

/** Critères que le code sait vérifier sur des données réelles. */
export const CRITERIA = Object.freeze({
  PHONE_VERIFIED: "Numéro de téléphone confirmé par code",
  AGENCY_RCCM: "Agence vérifiée (registre de commerce contrôlé par l'équipe)",
  TITRE_FONCIER: "Titre foncier contrôlé sur une annonce en ligne",
});
const ORDER = Object.keys(CRITERIA);
const MAX_GROUPS = 5;

/** Règle appliquée si aucune version n'est en base : le comportement en vigueur au 20/11/2026 (numéro confirmé). */
export const DEFAULT_GROUPS = Object.freeze([Object.freeze(["PHONE_VERIFIED"])]);

/** Valide et met en forme canonique : critères connus, sans doublon, ordre stable. Lève une erreur 400 sinon. */
export function normalizeGroups(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > MAX_GROUPS) throw badRequest(`Indiquez entre 1 et ${MAX_GROUPS} conditions.`);
  const groups = input.map((g) => {
    if (!Array.isArray(g) || g.length < 1) throw badRequest("Chaque condition doit proposer au moins un critère.");
    const codes = [...new Set(g.map((c) => String(c)))];
    for (const c of codes) if (!Object.hasOwn(CRITERIA, c)) throw badRequest("Critère inconnu.");
    return codes.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  });
  const seen = new Set();
  return groups
    .sort((a, b) => a.join().localeCompare(b.join()))
    .filter((g) => { const k = g.join(); if (seen.has(k)) return false; seen.add(k); return true; });
}

export const sameGroups = (a, b) => JSON.stringify(normalizeGroups(a)) === JSON.stringify(normalizeGroups(b));

/** facts : { PHONE_VERIFIED, AGENCY_RCCM, TITRE_FONCIER } (booléens). Un critère inconnu ou absent compte comme non rempli. */
export function evaluateGroups(groups, facts) {
  const detail = groups.map((g) => {
    const criteria = g.map((code) => ({ code, label: CRITERIA[code] ?? code, met: facts?.[code] === true }));
    return { met: criteria.some((c) => c.met), criteria };
  });
  return { satisfied: detail.length > 0 && detail.every((d) => d.met), groups: detail };
}

export function describeGroups(groups) {
  const label = (c) => CRITERIA[c] ?? c;
  const parts = groups.map((g) => g.map(label).join(" OU "));
  return groups.length === 1 ? parts[0] : groups.map((g, i) => (g.length > 1 ? `(${parts[i]})` : parts[i])).join(" ET ");
}

/** Ligne de profil (phone_verified_at, agency_verified_at, title_checked) → faits évalués. */
export const factsFromRow = (row) => ({
  PHONE_VERIFIED: Boolean(row?.phone_verified_at),
  AGENCY_RCCM: Boolean(row?.agency_verified_at),
  TITRE_FONCIER: Number(row?.title_checked) > 0,
});
