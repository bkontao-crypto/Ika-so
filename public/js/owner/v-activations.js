// Centre des activations (Super Administrateur) : état des interrupteurs, bascule avec confirmation, historique.
import { act, api, confirmDialog, dateTime, h, panel, pill, table } from "./ui.js";
import { mini, minis, page } from "./v-modules.js";

const SCOPE = { server: "Contrôlé par le serveur", browser: "Chez le visiteur" };

function switchRow(x, reload) {
  const next = !x.enabled;
  const locked = next && Boolean(x.blocked); // couper reste toujours possible
  const button = h("button", { class: `btn sm${next ? " primary" : ""}`, type: "button", disabled: locked, "aria-label": `${next ? "Activer" : "Désactiver"} : ${x.label}`, "data-key": x.key,
    onClick: async () => {
      const ok = await confirmDialog(`${next ? "Activer" : "Désactiver"} « ${x.label} » ?`,
        next ? "Le changement s’applique au site et sera inscrit dans l’historique." : `${x.whenOff} Le changement sera inscrit dans l’historique.`, next ? "Activer" : "Désactiver");
      if (ok) act(() => api(`/staff/owner/activations/${encodeURIComponent(x.key)}`, { method: "PUT", body: { enabled: next } }), `${x.label} : ${next ? "activé" : "désactivé"}.`, reload);
    } }, next ? "Activer" : "Désactiver");
  return h("div", { class: "av-row" },
    h("div", { class: "grow" },
      h("div", { class: "row" }, h("b", null, x.label), x.enabled ? pill("ok", "Activé") : pill("neutral", "Désactivé")),
      h("p", { class: "muted small" }, `Si désactivé : ${x.whenOff}`),
      x.blocked ? h("p", { class: "note warn" }, x.blocked) : null,
      h("p", { class: "muted small" }, SCOPE[x.scope], x.screen ? [" · ", h("a", { href: x.screen }, "Réglages détaillés")] : null)),
    button);
}

export const activationsView = (ctx) => page(ctx, {
  eyebrow: "PARAMÈTRES DU SITE", title: "Centre des activations",
  desc: "Les interrupteurs existants, au même endroit. « Activé » signifie que la fonction est autorisée, pas qu’elle a été prouvée en conditions réelles.",
  load: () => api("/staff/owner/activations"),
  build(d, reload) {
    const groups = [...new Set(d.switches.map((x) => x.group))];
    const on = d.switches.filter((x) => x.enabled).length;
    return h("div", { class: "stack" },
      minis(mini("Activés", String(on)), mini("Désactivés", String(d.switches.length - on)), mini("Allumage impossible", String(d.switches.filter((x) => !x.enabled && x.blocked).length), "configuration manquante")),
      ...groups.map((g) => panel(g, null, h("div", { class: "av-list" }, d.switches.filter((x) => x.group === g).map((x) => switchRow(x, reload))))),
      panel("À régler sur leur écran", "Consultation seulement : ces réglages gardent leurs propres contrôles.",
        table([{ label: "Fonction", key: "label" }, { label: "État", key: "value" }, { label: "", render: (r) => h("a", { class: "btn sm", href: r.screen }, "Ouvrir") }], d.elsewhere)),
      panel("Fournisseurs configurés sur le serveur", "Présence des réglages seulement : aucune clé n’est affichée et aucun envoi n’est testé ici.",
        table([{ label: "Service", key: "label" }, { label: "Configuration", render: (r) => (r.state === "configured" ? pill("ok", "Présente") : pill("neutral", "Absente")) }], d.providers)),
      panel("Historique des changements", "Les 30 derniers changements faits depuis ce centre. Ceux faits sur les autres écrans n’apparaissent pas ici.",
        table([{ label: "Date", render: (r) => dateTime(r.at) }, { label: "Fonction", key: "label" }, { label: "Nouvel état", render: (r) => (r.enabled ? pill("ok", "Activé") : pill("neutral", "Désactivé")) }, { label: "Par", key: "by" }],
          d.history, { emptyText: "Aucun changement depuis ce centre." })),
      panel("Sans interrupteur aujourd’hui", "Liste établie par le recensement ; elle n’est pas garantie complète.",
        h("div", { class: "stack" }, h("p", { class: "small" }, d.withoutSwitch.join(" · ")), h("p", { class: "note warn" }, `Réglages sans effet complet : ${d.withoutEffect.join(" ; ")}.`))));
  },
});
