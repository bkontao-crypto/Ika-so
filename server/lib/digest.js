export const ALERT_MODES = ["INSTANT", "DAILY"];
/** Délai minimal entre deux résumés pour un même compte. */
export const DIGEST_MIN_GAP_MS = 23 * 3600 * 1000;

/**
 * Compose le résumé à partir des annonces encore en ligne.
 * `items` : { id, title, neighborhood, label }. Renvoie null s'il n'y a rien à dire.
 */
export function buildDigest(items) {
  if (!items.length) return null;
  if (items.length === 1) {
    const [one] = items;
    return { title: `Nouvelle annonce : ${one.title}`, body: `Correspond à « ${one.label} » · ${one.neighborhood}`, link: `#/annonce/${one.id}` };
  }
  const shown = items.slice(0, 3).map((i) => i.title).join(" ; ");
  const more = items.length > 3 ? ` et ${items.length - 3} autre(s)` : "";
  return { title: `${items.length} nouvelles annonces pour vos recherches`, body: `${shown}${more}`, link: `#/annonce/${items[0].id}` };
}
