// Owner Control Center : « Double authentification ». Réglage « MFA obligatoire » et emplacements Superadmin.
// Réservé au Superadmin : le serveur refuse les autres comptes (403) ; ici on n'affiche que ce qu'il renvoie.
import { api, h, ico, panel, pill, statusPill, table, skeletons, errorBox, dateTime, confirmDialog, act } from "./ui.js";

const SLOT_LABEL = { PRINCIPAL: "Superadmin principal", SECONDARY: "Superadmin secondaire" };

export function mfaView() {
  const view = h("div", { class: "view" });
  const title = h("h1", null, "Double authentification");

  async function load() {
    view.replaceChildren(title, skeletons(2, 120));
    try {
      const [requirement, slots, mine] = await Promise.all([api("/mfa/required"), api("/mfa/superadmins"), api("/mfa/status")]);
      paint(requirement, slots, mine);
    } catch (e) {
      view.replaceChildren(title, errorBox(e.message || "Chargement impossible.", load));
    }
  }

  function paint(requirement, slots, mine) {
    const on = requirement.required === true;
    const blocked = !on && !mine.enabled; // le serveur refuse d'activer l'obligation sans MFA personnelle
    const toggle = h("button", {
      class: `btn ${on ? "" : "primary"}`, type: "button", disabled: blocked,
      onClick: async () => {
        const ok = await confirmDialog(
          on ? "Lever l'obligation de double authentification ?" : "Rendre la double authentification obligatoire ?",
          on ? "Le personnel pourra de nouveau se passer de la double authentification."
            : "Les Superadmin sans double authentification seront bloqués dès maintenant. Les Admin et Modérateurs auront 14 jours.",
          on ? "Lever l'obligation" : "Rendre obligatoire");
        if (!ok) return;
        await act(() => api("/mfa/required", { method: "PUT", body: { required: !on } }), on ? "Obligation levée." : "Double authentification obligatoire.", load);
      },
    }, ico(on ? "x" : "lock"), on ? "Lever l'obligation" : "Rendre obligatoire");

    const required = panel("MFA obligatoire pour le personnel",
      "Superadmin : dès l'activation. Admin et Modérateurs : après 14 jours.",
      h("div", { class: "stack" },
        h("p", null, on ? pill("ok", "Obligatoire") : pill("neutral", "Non obligatoire")),
        on ? h("p", { class: "muted small" }, `Activée le ${dateTime(requirement.since)}. Fin du délai pour les Admin et Modérateurs : ${dateTime(requirement.graceEndsAt)}.`) : null,
        blocked ? h("p", { class: "note warn" }, "Activez d'abord votre propre double authentification (Mon profil, section Sécurité) : sans elle, vous seriez verrouillé.") : null,
        h("div", null, toggle)));

    const rows = slots.slots.map((s) => ({ ...s, label: SLOT_LABEL[s.slot] ?? s.slot }));
    const cols = [
      { label: "Emplacement", key: "label" },
      { label: "Titulaire", render: (r) => (r.userId ? h("div", null, h("b", null, r.name), h("div", { class: "muted small" }, r.email)) : "Libre") },
      { label: "Compte", render: (r) => (r.userId ? statusPill(r.status) : "—") },
      { label: "Double authentification", render: (r) => (r.userId ? (r.mfa ? pill("ok", "Activée") : pill("warn", "Non activée")) : "—") },
    ];
    const slotsPanel = panel("Emplacements Superadmin",
      "Deux emplacements exactement : un principal et un secondaire. Aucune attribution automatique.",
      h("div", { class: "stack" },
        table(cols, rows),
        slots.withoutSlot > 0 ? h("p", { class: "note warn" }, `${slots.withoutSlot} compte(s) Superadmin sans emplacement : situation à régulariser.`) : null));

    view.replaceChildren(title, required, slotsPanel);
  }

  load();
  return view;
}
