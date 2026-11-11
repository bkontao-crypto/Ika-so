// Mon profil public : photo de couverture, photo de profil et présentation (tout est facultatif). Champs selon le rôle.
import { api, compressPhoto, fail, h, mount, toast } from "/js/dom.js";
import { S, app } from "/js/core/state.js";
import { needLogin } from "/js/core/router.js";
import { field } from "/js/components/ui.js";

export async function profileEditPage() {
  if (needLogin()) return;
  const m = await api("/me/public-profile");
  const can = (k) => m.allowed.includes(k);
  const pr = m.profile;
  const reload = () => profileEditPage();
  const run = async (fn, ok) => { try { await fn(); if (ok) toast(ok); await reload(); } catch (error) { fail(error); } };

  const photo = (kind, label, url) => {
    const input = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp", class: "sr-only", "aria-label": label,
      onChange: (e) => { const f = e.target.files?.[0]; if (f) {
        if (f.size > 8_000_000) { fail(new Error("Image trop volumineuse (max 8 Mo).")); return; }
        run(async () => api("/me/public-profile/image", { method: "POST", body: { kind, fileData: await compressPhoto(f) } }), "Photo enregistrée.");
      } } });
    return h("div", { class: "stack" }, h("h3", null, label),
      url ? h("img", { class: kind === "cover" ? "pcover" : "pavatar", src: url, alt: "" }) : h("p", { class: "muted small" }, "Aucune photo (facultatif)."),
      h("div", { class: "row" }, h("button", { class: "btn btn-small", type: "button", onClick: () => input.click() }, url ? "Changer" : "Ajouter"), input,
        url ? h("button", { class: "btn btn-quiet btn-small", type: "button", onClick: () => run(() => api("/me/public-profile/image/delete", { method: "POST", body: { kind } }), "Photo retirée.") }, "Retirer") : null));
  };

  const bio = h("textarea", { class: "input", rows: "5", maxlength: String(m.limits.bio), value: pr.bio, placeholder: "Qui êtes-vous ? Votre expérience, vos spécialités. Pas de numéro de téléphone ici." });
  const zones = h("input", { class: "input", value: pr.zones.join(", "), placeholder: "Ex. : Bamako, Kati, Koulikoro" });
  const year = h("input", { class: "input", type: "number", min: "1900", value: String(pr.foundedYear ?? "") });
  const address = h("input", { class: "input", maxlength: String(m.limits.address), value: pr.address });
  const hours = h("input", { class: "input", maxlength: String(m.limits.hours), value: pr.hours, placeholder: "Ex. : Lun - Sam : 08h00 - 18h00" });
  const showPhone = h("input", { type: "checkbox", checked: pr.showPhone, disabled: !m.hasPhone });
  const showWa = h("input", { type: "checkbox", checked: pr.showWhatsapp, disabled: !m.hasPhone });

  const save = (e) => {
    e.preventDefault();
    const body = { bio: bio.value, showPhone: showPhone.checked, showWhatsapp: showWa.checked };
    if (can("zones")) body.zones = zones.value.split(",").map((z) => z.trim()).filter(Boolean);
    if (can("foundedYear")) body.foundedYear = year.value;
    if (can("address")) body.address = address.value;
    if (can("hours")) body.hours = hours.value;
    run(() => api("/me/public-profile", { method: "PUT", body }), "Profil enregistré.");
  };

  mount(app,
    h("a", { href: `#/annonceur/${encodeURIComponent(S.user.id)}`, class: "btn btn-quiet btn-small" }, "Retour à mon profil"),
    h("h1", { class: "title" }, "Mon profil public"),
    h("p", { class: "muted" }, `Ce que voient les acheteurs. Tout est facultatif. Type de compte : ${m.role}.`),
    pr.imagesHidden ? h("p", { class: "banner" }, "Vos photos ont été masquées par la modération. Envoyez-en de nouvelles.") : null,
    h("section", { class: "card pad stack" }, photo("cover", "Photo de couverture", pr.coverUrl), photo("avatar", "Photo de profil ou logo", pr.avatarUrl)),
    h("form", { class: "card pad stack", onSubmit: save },
      field("Présentation", bio),
      can("foundedYear") ? field("Année de création (déclarée)", year) : null,
      can("zones") ? field("Zones d'intervention (séparées par des virgules)", zones) : null,
      can("address") ? field("Adresse", address) : null,
      can("hours") ? field("Horaires d'ouverture", hours) : null,
      can("address") && !m.agencyVerified ? h("p", { class: "small muted" }, "L'adresse et les horaires ne sont affichés qu'une fois votre agence vérifiée par l'équipe.") : null,
      h("label", { class: "row" }, showPhone, "Afficher le bouton « Appeler » sur mon profil"),
      h("label", { class: "row" }, showWa, "Afficher le bouton « WhatsApp » sur mon profil"),
      m.hasPhone ? h("p", { class: "small muted" }, "Votre numéro n'est jamais écrit sur la page : il n'est donné qu'au clic, à une personne connectée.") : h("p", { class: "small muted" }, "Ajoutez d'abord un numéro à votre compte pour activer ces boutons."),
      h("button", { class: "btn btn-primary", type: "submit" }, "Enregistrer")));
}
