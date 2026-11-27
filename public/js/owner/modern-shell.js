// Habillage commun de l'Owner Center : puces d'icônes sur les cartes, icônes d'onglets, décor du bandeau de page.
// Chargé comme script séparé (owner.html) : n'altère aucun module existant, observe le DOM et complète ce qui apparaît.
import { h, ico } from "./ui.js";

const PANEL_ICONS = [
  [/pr[ée]sentation|texte|r[ée]dact/i, "file"], [/lien|colonne/i, "route"], [/activit|trafic|fr[ée]quent|graph|statist|entonnoir/i, "pulse"],
  [/sant[ée]|syst[èe]me|serveur|sauvegarde/i, "database"], [/alerte|signal|r[ée]clam|incident/i, "flag"], [/paiement|financ|abonnement|premium|tarif|formule/i, "wallet"],
  [/utilisateur|compte|agence|membre|client|personnel|d[ée]l[ée]gation/i, "users"], [/annonce|mod[ée]ration|op[ée]ration|demande/i, "list"],
  [/s[ée]curit|authentif|connexion|audit|permission|confiance/i, "shield"], [/mail|message|contact|newsletter|whatsapp/i, "mail"],
  [/r[ée]f[ée]rencement|recherche|google/i, "search"], [/couleur|apparence|logo|aper[çc]u|th[èe]me/i, "eye"], [/marketing|campagne/i, "megaphone"],
  [/r[ée]gion|quartier|pays|carte/i, "pin"], [/param[èe]tre|r[èe]gle|condition|r[ée]glage|configuration|identit/i, "gear"], [/langue|traduction|redirection|cat[ée]gorie/i, "swap"],
];
const TAB_ICONS = { identity: "users", appearance: "grid", services: "shield", homepage: "home", header: "menu", layout: "list", footer: "file", seo: "search", logo: "sparkles", legal: "scroll", security: "lock" };

function heroArt() {
  const bar = (cls) => h("i", { class: cls });
  return h("div", { class: "hero-art", "aria-hidden": "true" },
    h("div", { class: "ha-win" },
      h("div", { class: "ha-top" }, bar(""), bar(""), bar("")),
      h("div", { class: "ha-body" }, h("div", { class: "ha-img" }), h("div", { class: "ha-lines" }, bar("l1"), bar("l2"), bar("l3"), h("b", { class: "ha-btn" })))),
    h("div", { class: "ha-chip" }, ico("sparkles")));
}

function decorate(scope) {
  scope.querySelectorAll(".card.panel > .panelhead:not([data-m])").forEach((head) => {
    head.dataset.m = "1";
    const title = head.querySelector("h2")?.textContent ?? "";
    const name = (PANEL_ICONS.find(([re]) => re.test(title)) ?? [null, "grid"])[1];
    head.prepend(h("span", { class: "ph-ico", "aria-hidden": "true" }, ico(name)));
  });
  scope.querySelectorAll(".ps-tab:not([data-m])").forEach((b) => {
    b.dataset.m = "1";
    const name = TAB_ICONS[b.dataset.tab];
    if (name) b.prepend(ico(name));
  });
  scope.querySelectorAll(".welcome:not([data-m])").forEach((w) => { w.dataset.m = "1"; w.append(heroArt()); });
}

function start() {
  const root = document.getElementById("root");
  if (!root) return;
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; try { decorate(root); } catch { /* décor facultatif */ } });
  }).observe(root, { childList: true, subtree: true });
  decorate(root);
}
start();
