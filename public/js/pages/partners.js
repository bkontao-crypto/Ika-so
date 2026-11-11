// Onglet « Partenaires » : visibilité, sponsoring et espaces professionnels.
// Chaque carte mène à une fonction réelle du projet (mise à la une payante, annuaire des agences, espace agence).
import { h, mount, api } from "/js/dom.js";
import { app, S } from "/js/core/state.js";

const CARDS = [
  { image: "/media/villa-badala.jpg", label: "Mise à la une", title: "Annonces sponsorisées",
    text: "Placez une annonce publiée en tête des résultats et dans la rubrique « Annonces sponsorisées » de la page d'accueil, pour 7 ou 30 jours.",
    href: "#/mes-annonces", cta: "Mettre une annonce à la une" },
  { image: "/media/appart-hamdallaye.jpg", label: "Agences vérifiées", title: "Annuaire des agences",
    text: "Les agences dont l'identité a été contrôlée sont signalées sur leurs annonces et listées dans l'annuaire public.",
    href: "/agences", cta: "Consulter l'annuaire" },
  { image: "/media/villa-badala.jpg", label: "Premium certifié", title: "Centre de contrôle Premium",
    text: "Statistiques détaillées, carte de vos annonces, alertes et échéances réservées aux annonceurs Premium certifiés.",
    href: "#/premium?from=partenaires", cta: "Voir les avantages Premium" },
  { image: "/media/terrain-aci.jpg", label: "Espace professionnel", title: "Espace agence",
    text: "Importez vos annonces par fichier CSV, suivez leur modération et gérez votre vitrine d'annonceur depuis un seul espace.",
    href: "#/agence", cta: "Accéder à l'espace agence" },
];

const isAdmin = () => ["ADMIN", "SUPERADMIN"].includes(S.meta?.staffRole);
const initials = (name) => String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const readDataUrl = (file) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(new Error("Lecture du logo impossible.")); r.readAsDataURL(file); });

function partnerCard(p, { manage, reload, edit }) {
  const logo = p.logoUrl
    ? h("img", { class: "partner-logo", src: p.logoUrl, alt: `Logo de ${p.name}`, loading: "lazy", width: 56, height: 56 })
    : h("span", { class: "partner-logo partner-initials", "aria-hidden": "true" }, initials(p.name));
  const hidden = p.status === "HIDDEN";
  const run = async (fn) => { try { await fn(); await reload(); } catch (e) { window.alert(e.message || "Action impossible."); } };
  return h("article", { class: `partner-card${hidden ? " is-hidden" : ""}` },
    h("div", { class: "partner-head" }, logo, h("div", null, h("h3", null, p.name), h("span", { class: "pill" }, p.category), hidden ? h("span", { class: "pill pill-dark" }, "Masqué") : null)),
    p.description ? h("p", { class: "partner-text" }, p.description) : null,
    p.websiteUrl ? h("a", { class: "sponsor-link", href: p.websiteUrl, target: "_blank", rel: "noopener noreferrer nofollow sponsored" }, "Visiter le site", h("span", null, "↗")) : null,
    manage ? h("div", { class: "partner-actions" },
      h("button", { class: "btn btn-outline btn-small", type: "button", onClick: () => edit(p) }, "Modifier"),
      h("button", { class: "btn btn-outline btn-small", type: "button", onClick: () => run(() => api(`/staff/partners/${encodeURIComponent(p.id)}/status`, { method: "POST", body: { status: hidden ? "ACTIVE" : "HIDDEN" } })) }, hidden ? "Réafficher" : "Masquer"),
      h("button", { class: "btn btn-outline btn-small partner-danger", type: "button", onClick: () => { if (window.confirm(`Retirer définitivement « ${p.name} » ?`)) run(() => api(`/staff/partners/${encodeURIComponent(p.id)}/delete`, { method: "POST", body: {} })); } }, "Retirer")) : null);
}

/** Formulaire d'ajout / de modification (administrateurs). */
function partnerForm({ categories, partner, onDone, onCancel }) {
  const v = partner ?? {};
  let logoUrl = v.logoUrl ?? "";
  const status = h("p", { class: "small muted", role: "status" }, "Logo facultatif : JPEG, PNG ou WebP, 2 Mo maximum.");
  const name = h("input", { class: "input", name: "name", required: true, maxlength: 80, value: v.name ?? "", placeholder: "Nom du partenaire" });
  const category = h("select", { class: "input", name: "category", required: true }, categories.map((c) => h("option", { value: c, selected: c === (v.category ?? categories[0]) }, c)));
  const website = h("input", { class: "input", name: "websiteUrl", type: "text", inputmode: "url", maxlength: 300, value: v.websiteUrl ?? "", placeholder: "https://www.exemple.ml (facultatif)" });
  const description = h("textarea", { class: "input", name: "description", rows: 3, maxlength: 300, placeholder: "Ce que fait ce partenaire, en une ou deux phrases (300 caractères)" }, v.description ?? "");
  const file = h("input", { class: "input", type: "file", accept: "image/jpeg,image/png,image/webp", "aria-label": "Logo du partenaire" });
  file.addEventListener("change", async () => {
    const f = file.files?.[0]; if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size > 2 * 1024 * 1024) { status.textContent = "Format non accepté ou fichier supérieur à 2 Mo."; file.value = ""; return; }
    try { status.textContent = "Envoi du logo…"; logoUrl = (await api("/staff/partner-logo", { method: "POST", body: { dataUrl: await readDataUrl(f) } })).logoUrl; status.textContent = "Logo prêt : il sera enregistré avec le partenaire."; }
    catch (e) { status.textContent = e.message || "Envoi impossible."; }
  });
  const error = h("p", { class: "partner-error", role: "alert" });
  const form = h("form", { class: "partner-form card pad", novalidate: true },
    h("h3", null, partner ? `Modifier « ${v.name} »` : "Ajouter un partenaire"),
    h("label", { class: "field" }, "Nom", name), h("label", { class: "field" }, "Catégorie", category),
    h("label", { class: "field" }, "Site web", website), h("label", { class: "field" }, "Description", description),
    h("label", { class: "field" }, "Logo", file), status, error,
    h("div", { class: "partner-actions" },
      h("button", { class: "btn btn-primary", type: "submit" }, partner ? "Enregistrer" : "Ajouter le partenaire"),
      h("button", { class: "btn btn-outline", type: "button", onClick: onCancel }, "Annuler")));
  form.addEventListener("submit", async (event) => {
    event.preventDefault(); error.textContent = "";
    const body = { name: name.value, category: category.value, websiteUrl: website.value, description: description.value, logoUrl };
    try { await api(partner ? `/staff/partners/${encodeURIComponent(v.id)}` : "/staff/partners", { method: partner ? "PUT" : "POST", body }); await onDone(); }
    catch (e) { error.textContent = e.message || "Enregistrement impossible."; }
  });
  return form;
}

async function partnersSection() {
  const host = h("section", { class: "section partners-directory container", id: "partenaires-liste" });
  const manage = isAdmin();
  let formHost = null;
  async function load() {
    let data = { partners: [], categories: [] };
    try { data = await api(manage ? "/staff/partners" : "/partners"); } catch { /* page toujours affichée, liste vide */ }
    const closeForm = () => { formHost = null; draw(); };
    const reload = async () => { formHost = null; await load(); };
    const edit = (partner) => { formHost = partnerForm({ categories: data.categories, partner, onDone: reload, onCancel: closeForm }); draw(); formHost.scrollIntoView?.({ block: "center" }); };
    function draw() {
      mount(host,
        h("div", { class: "section-head" }, h("div", null, h("span", { class: "section-kicker" }, "Ils nous font confiance"), h("h2", { class: "section-title" }, "Nos partenaires"),
          h("p", { class: "section-desc" }, "Professionnels de l'immobilier présentés par l'équipe Ika So. Ika So ne garantit pas leurs services : vérifiez toujours avant de payer.")),
          manage ? h("button", { class: "btn btn-primary", type: "button", onClick: () => edit(null) }, "Ajouter un partenaire") : null),
        formHost,
        data.partners.length
          ? h("div", { class: "partner-grid" }, data.partners.map((p) => partnerCard(p, { manage, reload, edit })))
          : h("p", { class: "card pad muted partner-empty" }, manage ? "Aucun partenaire pour le moment. Utilisez « Ajouter un partenaire »." : "Les premiers partenaires seront présentés ici prochainement."));
    }
    draw();
  }
  await load();
  return host;
}

export async function partnersPage() {
  const directory = await partnersSection();
  mount(app, h("section", { class: "section sponsor-section container", id: "sponsors" },
    h("div", { class: "section-head" },
      h("div", null, h("span", { class: "section-kicker" }, "Visibilité & partenariats"), h("h1", { class: "section-title" }, "Nos espaces partenaires"),
        h("p", { class: "section-desc" }, "Des emplacements dédiés aux annonceurs et professionnels qui accompagnent les projets immobiliers.")),
      h("a", { class: "text-link", href: "#/paiements" }, "Mes paiements et offres →")),
    h("div", { class: "sponsor-banner" },
      h("div", null, h("span", { class: "section-kicker" }, "Espace de visibilité"), h("h2", null, "Votre annonce au premier plan."),
        h("p", null, "Présentez vos biens et vos services aux visiteurs qui recherchent un logement, un terrain ou un local. La mise à la une est une offre payante, activée depuis votre compte."),
        h("div", { class: "hero-actions" }, h("a", { class: "btn btn-primary", href: "#/mes-annonces" }, "Mettre une annonce à la une ", h("span", null, "→")))),
      h("div", { class: "sponsor-banner-art", role: "img", "aria-label": "Immeuble moderne illustrant les espaces de visibilité" })),
    h("div", { class: "sponsor-grid" }, CARDS.map((c) => h("article", { class: "sponsor-card" },
      h("div", { class: "sponsor-visual", style: { "background-image": `url("${c.image}")` } }, h("span", null, c.label)),
      h("div", { class: "sponsor-copy", }, h("h3", null, c.title), h("p", null, c.text),
        h("a", { class: "sponsor-link", href: c.href }, c.cta, h("span", null, "→")))))),
    h("p", { class: "sponsor-note" }, "Les annonces sponsorisées affichées sur l'accueil sont les annonces réellement mises à la une par leurs annonceurs.")),
    directory);
}
