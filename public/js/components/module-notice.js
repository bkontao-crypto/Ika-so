// Message affiché à la place d'une saisie quand le module est coupé (bootstrap-settings.js le montre ; caché sinon).
import { h } from "../dom.js";

const TEXT = {
  comments: "Les nouveaux commentaires sont désactivés pour le moment.",
  reviews: "Les nouveaux avis sont désactivés pour le moment.",
  messaging: "L'envoi de messages est désactivé pour le moment.",
};

export const moduleNotice = (key) => h("p", { class: "muted small module-notice", "data-module-closed": key, hidden: true, role: "status" }, TEXT[key]);
