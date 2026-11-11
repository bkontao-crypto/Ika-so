// Ajoute une icône devant les libellés (boutons, onglets, champs, titres) à partir de leur texte.
// Les règles texte → icône sont dans icon-rules.js. Aucune règle ne correspond → aucun changement. Chaque élément n'est traité qu'une fois.
import { icon } from "/js/icons.js";
import { iconFor } from "/js/icon-rules.js";

/** Cibles : [sélecteur, façon de lire le texte]. */
const TARGETS = [
  [".btn, .tabs button, button[role=tab]", (el) => el.textContent],
  ["label.field", (el) => (el.firstChild?.nodeType === 3 ? el.firstChild.textContent : "")],
  ["main h1.title, main h2, dialog h2", (el) => (el.querySelector("a") || el.closest(".listing") ? "" : el.textContent)],
  [".pill", (el) => el.textContent],
  [".trust-symbol", () => "confiance"],
  [".topbar-search", () => "recherche"],
  [".fact > span:first-child", (el) => el.textContent],
  [".hero-assurances span", (el) => el.textContent.replace(/^\s*✓\s*/, "")],
];

function decorate(root) {
  for (const [selector, read] of TARGETS) {
    for (const el of root.querySelectorAll(selector)) {
      if (el.dataset.ic || el.querySelector(":scope > .ic")) continue;
      el.dataset.ic = "1";
      const svg = icon(iconFor(read(el)), "ic-lead");
      if (svg) el.prepend(svg);
    }
  }
}

/** À appeler une fois : décore la page, puis toute page ou fenêtre ajoutée ensuite. */
export function startDecorating(root = document.body) {
  let queued = false;
  const run = () => { queued = false; decorate(root); };
  new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(run); } })
    .observe(root, { childList: true, subtree: true });
  decorate(root);
}
