import { h } from "/js/dom.js";

export const field = (label, input, attrs = {}) => h("label", { class: `field ${attrs.class ?? ""}` }, label, input);
// Champ mot de passe avec bouton afficher/masquer (le texte reste dans le champ, aucune donnée ajoutée).
export const passwordField = (label, input) => {
  const toggle = h("button", { class: "pw-toggle", type: "button", "aria-pressed": "false", "aria-label": "Afficher le mot de passe", title: "Afficher le mot de passe",
    onClick: (e) => {
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      e.currentTarget.setAttribute("aria-pressed", String(show));
      e.currentTarget.setAttribute("aria-label", show ? "Masquer le mot de passe" : "Afficher le mot de passe");
      e.currentTarget.title = show ? "Masquer le mot de passe" : "Afficher le mot de passe";
      e.currentTarget.textContent = show ? "Masquer" : "Afficher";
    } }, "Afficher");
  return h("label", { class: "field" }, label, h("span", { class: "pw-wrap" }, input, toggle));
};
export const select = (options, value, onChange, { blank } = {}) =>
  h("select", { class: "input", onChange: (e) => onChange(e.target.value) },
    blank ? h("option", { value: "" }, blank) : null,
    options.map((o) => h("option", { value: o, selected: o === value }, o)));
