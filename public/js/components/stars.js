import { h } from "/js/dom.js";
import { icon } from "/js/icons.js";

/** Cinq étoiles (pleines jusqu'à la note arrondie). Le texte caché donne la valeur aux lecteurs d'écran. */
export function stars(value, { label } = {}) {
  const full = Math.round(Number(value) || 0);
  const text = label ?? `${String(value).replace(".", ",")} sur 5`;
  return h("span", { class: "stars", role: "img", "aria-label": text },
    [1, 2, 3, 4, 5].map((i) => h("span", { class: i <= full ? "star on" : "star", "aria-hidden": "true" }, icon("star"))));
}
