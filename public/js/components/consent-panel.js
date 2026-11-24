// Panneau « Gérer mes choix » (lot A). Ouvert depuis le pied de page et depuis Mon profil > Paramètres. Sans choix valide, aucune catégorie optionnelle n'est acceptée ; « Continuer » à l'inscription les accepte toutes, chacune se retire ici.
import { h, toast } from "/js/dom.js";
import { CONSENT_CATEGORIES, clearMapboxStorage, hasConsent, readConsent, saveConsent } from "/js/core/consent.js";

export function openConsentPanel() {
  if (document.getElementById("consent-dialog")) return;
  const previous = document.activeElement;
  const before = hasConsent("cartes");
  const picked = new Set(readConsent()?.accepted ?? []);

  const close = () => {
    document.removeEventListener("keydown", onKey);
    overlay.remove();
    previous?.focus?.();
  };
  const onKey = (event) => { if (event.key === "Escape") close(); };
  const save = (ids) => {
    saveConsent(ids);
    if (!hasConsent("cartes")) clearMapboxStorage(); // identifiant et télémétrie Mapbox retirés dès le retrait
    close();
    // Le fond de carte est choisi au chargement de la page : on recharge pour appliquer le choix tout de suite (retrait compris).
    if (hasConsent("cartes") !== before) { location.reload(); return; }
    toast("Vos choix sont enregistrés.");
  };

  const rows = CONSENT_CATEGORIES.map((c) => {
    const box = h("input", { type: "checkbox", checked: picked.has(c.id), onChange: (e) => (e.target.checked ? picked.add(c.id) : picked.delete(c.id)) });
    return h("div", { class: "consent-row" },
      h("label", { class: "consent-head" }, box, h("strong", null, c.label)),
      h("p", { class: "small muted" }, c.description, c.active ? null : " Aucun service ne l'utilise pour le moment."));
  });

  const overlay = h("div", { class: "consent-overlay", id: "consent-dialog" },
    h("div", { class: "consent-panel", role: "dialog", "aria-modal": "true", "aria-labelledby": "consent-title" },
      h("h2", { id: "consent-title" }, "Gérer mes choix"),
      h("p", { class: "small" }, "Les éléments nécessaires au fonctionnement du site (connexion, sécurité) sont toujours actifs. Les autres services ne sont activés qu'avec votre accord."),
      rows,
      h("p", { class: "small muted" }, "Votre choix est conservé six mois sur cet appareil. Vous pouvez le modifier à tout moment depuis le pied de page."),
      h("div", { class: "consent-actions" },
        h("button", { class: "btn", type: "button", onClick: () => save([]) }, "Tout refuser"),
        h("button", { class: "btn btn-primary", type: "button", onClick: () => save([...picked]) }, "Enregistrer mes choix"))));

  overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
  document.addEventListener("keydown", onKey);
  document.body.append(overlay);
  overlay.querySelector("input:not([disabled])")?.focus();
}
