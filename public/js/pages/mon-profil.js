// Mon profil (#/profil) : couverture, photo, à propos, publications, annonces, avis, paramètres.
// Tout est modifiable depuis cette page. Les données viennent des API existantes ; aucune valeur n'est inventée.
import { api, compressPhoto, fail, formatPrice, h, mount, readProofFile, toast } from "/js/dom.js";
import { S, app, refreshSession } from "/js/core/state.js";
import { needLogin } from "/js/core/router.js";
import { field } from "/js/components/ui.js";
import { stars } from "/js/components/stars.js";
import { accountSettings } from "/js/pages/account.js";

const TABS = [["publications", "Publications"], ["annonces", "Mes annonces"], ["avis", "Avis"], ["abonnes", "Abonnés"], ["equipe", "Équipe"], ["parametres", "Paramètres & Confidentialité"]];
const STATUS = { PENDING: ["amber", "⏳ En attente de validation"], REJECTED: ["red", "✕ Refusée"], EXPIRED: ["neutral", "Expirée"], SOLD: ["neutral", "Vendue"], RENTED: ["neutral", "Louée"], DRAFT: ["neutral", "Brouillon"] };
const FILTERS = [["all", "🏠", "Toutes mes annonces"], ["PUBLISHED", "🟢", "En ligne"], ["PENDING", "🟡", "En attente"], ["REJECTED", "🔴", "Refusées"]];
const monthYear = (iso) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) : "");
const dateFr = (iso) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "");
const initials = (name) => (String(name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("") || "?").toUpperCase();
const badge = (kind, text, title) => h("span", { class: `mp-badge mp-badge-${kind}`, title: title ?? null }, text);

let currentTab = "publications";
let listingFilter = "all";
let editingAbout = false;

export async function profilePage() {
  if (needLogin()) return;
  const wanted = new URLSearchParams(location.hash.split("?")[1] ?? "").get("tab");
  if (TABS.some(([id]) => id === wanted)) currentTab = wanted;
  await refreshSession();
  const id = S.user.id;
  const [edit, pub, listings, score, reviews, consent, proofs, followers, following, followSettings, team] = await Promise.all([
    api("/me/public-profile"),
    api(`/advertisers/${encodeURIComponent(id)}`).catch(() => null),
    api("/me/listings").catch(() => []),
    api("/me/score").catch(() => null),
    api(`/advertisers/${encodeURIComponent(id)}/reviews?kind=recent&limit=30`).catch(() => []),
    api("/me/analytics-consent").catch(() => null),
    api("/me/proofs").catch(() => []),
    api("/me/followers").catch(() => ({ total: 0, anonymousCount: 0, items: [] })),
    api("/me/following").catch(() => []),
    api("/me/follow-settings").catch(() => ({ anonymousByDefault: false })),
    api("/me/team-requests").catch(() => ({ members: [], received: [], sent: [] })),
  ]);
  const m = S.meta ?? {};
  const pr = edit.profile;
  const can = (k) => edit.allowed.includes(k);
  const name = m.fullName || S.user.name;
  const visible = listings.filter((l) => l.status !== "ARCHIVED");

  const reload = () => profilePage();
  const run = async (fn, ok) => { try { await fn(); if (ok) toast(ok); await reload(); } catch (error) { fail(error); } };

  /* ---------- Photos ---------- */
  const upload = (kind, label) => h("input", { type: "file", accept: "image/jpeg,image/png,image/webp", class: "sr-only", "aria-label": label,
    onChange: (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      if (f.size > 8_000_000) { fail(new Error("Image trop volumineuse (max 8 Mo).")); return; }
      run(async () => api("/me/public-profile/image", { method: "POST", body: { kind, fileData: await compressPhoto(f) } }), "Photo enregistrée.");
    } });
  const removeImage = (kind) => run(() => api("/me/public-profile/image/delete", { method: "POST", body: { kind } }), "Photo retirée.");
  const coverInput = upload("cover", "Photo de couverture");
  const avatarInput = upload("avatar", "Photo de profil");

  /* ---------- En-tête ---------- */
  const place = pr.city ? ` · ${pr.city}, Mali` : "";
  const header = h("section", { class: "mp-header" },
    h("div", { class: "mp-cover", style: pr.coverUrl ? `background-image:linear-gradient(rgba(7,22,15,.25),rgba(7,22,15,.25)),url('${pr.coverUrl}')` : null },
      h("div", { class: "mp-cover-tools" },
        h("button", { class: "mp-btn mp-btn-glass", type: "button", onClick: () => coverInput.click() }, pr.coverUrl ? "Changer la couverture" : "Ajouter une couverture"),
        pr.coverUrl ? h("button", { class: "mp-btn mp-btn-glass", type: "button", onClick: () => removeImage("cover") }, "Retirer") : null), coverInput),
    h("div", { class: "mp-info" },
      h("div", { class: "mp-avatar" }, h("div", { class: "mp-avatar-in", style: pr.avatarUrl ? `background-image:url('${pr.avatarUrl}')` : null, role: "img", "aria-label": `Photo de ${name}` }, pr.avatarUrl ? null : initials(name))),
      h("div", { class: "mp-actions" },
        h("button", { class: "mp-btn mp-btn-outline", type: "button", onClick: () => avatarInput.click() }, "Modifier la photo"),
        pr.avatarUrl ? h("button", { class: "mp-btn mp-btn-outline", type: "button", onClick: () => removeImage("avatar") }, "Retirer") : null,
        h("button", { class: "mp-btn mp-btn-primary", type: "button", onClick: () => show("parametres") }, "Gérer mon compte"), avatarInput),
      h("div", { class: "mp-details" },
        h("h1", null, name, edit.role ? h("span", { class: "mp-role" }, ` (${edit.role})`) : null),
        h("p", null, `Membre depuis ${monthYear(pub?.memberSince) || "—"}${place}`),
        pr.imagesHidden ? h("p", { class: "mp-alert" }, "Vos photos ont été masquées par la modération. Envoyez-en de nouvelles.") : null,
        h("div", { class: "mp-badges" },
          m.phoneVerified ? badge("green", "✓ Téléphone vérifié") : badge("neutral", "Téléphone non vérifié"),
          edit.agencyVerified ? badge("green", "✓ Agence vérifiée") : null,
          badge("neutral", { ACTIVE: "Compte actif", RESTRICTED: "Compte restreint", BANNED: "Compte bloqué" }[m.accountStatus] ?? "Compte")))),
    h("div", { class: "mp-tabs", role: "tablist" }, TABS.map(([tid, label]) => h("button", { class: "mp-tab", type: "button", role: "tab", "data-ic": "1", "data-tab": tid, "aria-selected": String(tid === currentTab), onClick: () => show(tid) },
      tid === "annonces" ? `${label} (${visible.length})` : tid === "avis" ? `${label} (${pub?.rating?.count ?? 0})` : tid === "abonnes" ? `${label} (${followers.total})` : tid === "equipe" ? `${label} (${team.members.length}${team.received.length ? ` · ${team.received.length} invitation${team.received.length > 1 ? "s" : ""}` : ""})` : label))));

  /* ---------- À propos (modifiable sur place) ---------- */
  const nameInput = h("input", { class: "input", value: name, maxlength: "80", autocomplete: "name" });
  const cityInput = h("input", { class: "input", value: pr.city, maxlength: String(edit.limits.city ?? 60), placeholder: "Ex. : Bamako" });
  const bioInput = h("textarea", { class: "input", rows: "4", maxlength: String(edit.limits.bio), value: pr.bio, placeholder: "Qui êtes-vous ? Pas de numéro de téléphone ici." });
  const zonesInput = h("input", { class: "input", value: pr.zones.join(", "), placeholder: "Ex. : Bamako, Kati" });
  const yearInput = h("input", { class: "input", type: "number", min: "1900", value: String(pr.foundedYear ?? "") });
  const addressInput = h("input", { class: "input", maxlength: String(edit.limits.address), value: pr.address });
  const hoursInput = h("input", { class: "input", maxlength: String(edit.limits.hours), value: pr.hours, placeholder: "Ex. : Lun - Sam : 08h00 - 18h00" });
  const saveAbout = (e) => {
    e.preventDefault();
    run(async () => {
      if (nameInput.value.trim() !== name) await api("/me/identity", { method: "PUT", body: { fullName: nameInput.value } });
      const body = { bio: bioInput.value, city: cityInput.value };
      if (can("zones")) body.zones = zonesInput.value.split(",").map((z) => z.trim()).filter(Boolean);
      if (can("foundedYear")) body.foundedYear = yearInput.value;
      if (can("address")) body.address = addressInput.value;
      if (can("hours")) body.hours = hoursInput.value;
      await api("/me/public-profile", { method: "PUT", body });
      await refreshSession();
      editingAbout = false;
    }, "Profil enregistré.");
  };
  const aboutCard = h("div", { class: "mp-card" },
    h("div", { class: "mp-card-head" }, h("h3", null, "À propos"),
      editingAbout ? null : h("button", { class: "mp-link", type: "button", onClick: () => { editingAbout = true; reload(); } }, "Modifier")),
    editingAbout
      ? h("form", { class: "mp-form", onSubmit: saveAbout },
          field("Nom affiché", nameInput), field("Ville", cityInput), field("Présentation", bioInput),
          can("zones") ? field("Zones d'intervention (séparées par des virgules)", zonesInput) : null,
          can("foundedYear") ? field("Année de création (déclarée)", yearInput) : null,
          can("address") ? field("Adresse", addressInput) : null,
          can("hours") ? field("Horaires d'ouverture", hoursInput) : null,
          h("div", { class: "mp-row" },
            h("button", { class: "mp-btn mp-btn-primary", type: "submit" }, "Enregistrer"),
            h("button", { class: "mp-btn mp-btn-outline", type: "button", onClick: () => { editingAbout = false; reload(); } }, "Annuler")))
      : h("div", null,
          pr.city ? h("div", { class: "mp-intro" }, h("span", null, "📍"), h("span", null, "Vit à ", h("b", null, pr.city))) : h("div", { class: "mp-intro" }, h("span", null, "📍"), h("button", { class: "mp-link", type: "button", onClick: () => { editingAbout = true; reload(); } }, "Ajouter ma ville")),
          h("div", { class: "mp-intro" }, h("span", null, "💼"), h("span", null, h("b", null, edit.role || "Membre"))),
          h("div", { class: "mp-intro" }, h("span", null, "📅"), h("span", null, "A rejoint IKA SO en ", h("b", null, monthYear(pub?.memberSince) || "—"))),
          pr.zones.length ? h("div", { class: "mp-intro" }, h("span", null, "🗺️"), h("span", null, pr.zones.join(", "))) : null,
          pr.bio ? h("p", { class: "mp-bio" }, pr.bio) : null));

  const sc = score?.score;
  const scoreCard = h("div", { class: "mp-card" }, h("h3", null, "Score de confiance"),
    h("div", { class: "mp-score" },
      h("div", { class: "mp-score-value" }, sc == null ? "—" : String(sc), sc == null ? null : h("span", null, "/100")),
      sc == null ? null : h("div", { class: "mp-score-bar", role: "progressbar", "aria-valuenow": String(sc), "aria-valuemin": "0", "aria-valuemax": "100" }, h("div", { style: `width:${sc}%` })),
      score ? h("p", { class: "mp-score-parts" }, `Confiance ${score.parts.trust} · Visibilité ${score.parts.visibility} · Fidélité ${score.parts.loyalty} · Réactivité ${score.parts.reactivity}`) : null,
      h("p", { class: "mp-score-note" }, "Basé sur la confiance (40%), visibilité (20%), fidélité (20%) et réactivité (20%). ", h("b", null, "Ce n'est pas une certification officielle."))));

  /* ---------- Publications ---------- */
  const postBox = h("textarea", { class: "input", rows: "3", maxlength: "2000", placeholder: "Partagez une actualité ou un bien… (pas de numéro de téléphone)" });
  const posts = pub?.publications ?? [];
  const publicationsTab = h("div", { class: "mp-grid" },
    h("div", { class: "mp-col" }, aboutCard, scoreCard),
    h("div", { class: "mp-col" },
      h("div", { class: "mp-card" }, h("h3", null, "Nouvelle publication"), postBox,
        h("div", { class: "mp-row end" }, h("button", { class: "mp-btn mp-btn-primary", type: "button", onClick: () => {
          if (postBox.value.trim().length < 5) { toast("Le texte de la publication est trop court.", true); return; }
          run(() => api("/me/publications", { method: "POST", body: { content: postBox.value.trim() } }), "Publication ajoutée.");
        } }, "Publier"))),
      posts.length
        ? posts.map((p) => h("article", { class: "mp-card" }, h("p", { class: "mp-post" }, p.content),
            h("div", { class: "mp-row between" }, h("small", null, dateFr(p.createdAt)),
              h("button", { class: "mp-link danger", type: "button", onClick: () => { if (window.confirm("Supprimer cette publication ?")) run(() => api(`/me/publications/${encodeURIComponent(p.id)}/delete`, { method: "POST", body: {} }), "Publication supprimée."); } }, "Supprimer"))))
        : h("div", { class: "mp-card mp-empty" }, h("div", { class: "mp-empty-ic" }, "📝"), h("h3", null, "Aucune publication récente"),
            h("p", null, "Lorsque vous publierez des annonces ou partagerez des biens, ils apparaîtront ici."))));

  /* ---------- Mes annonces ---------- */
  const count = (f) => (f === "all" ? visible.length : visible.filter((l) => l.status === f).length);
  const listingCard = (l) => {
    const st = STATUS[l.status];
    const editable = ["PUBLISHED", "REJECTED", "EXPIRED", "PENDING"].includes(l.status);
    return h("div", { class: `mp-listing${l.status === "PENDING" ? " pending" : ""}` },
      h("img", { src: l.imageUrl, alt: l.title, loading: "lazy" }),
      h("div", { class: "mp-listing-body" },
        h("h4", null, l.title), h("span", { class: "mp-price" }, formatPrice(l.price, l.transactionType)),
        h("div", { class: "mp-tags" }, st ? badge(st[0], st[1]) : null,
          badge("neutral", `📄 ${l.declaredDocument || "Aucun document déclaré"}`, l.declaredDocument ? "Document déclaré, non examiné" : null)),
        l.status === "REJECTED" && l.moderationNote ? h("p", { class: "mp-note" }, `Motif : ${l.moderationNote}`) : null,
        h("div", { class: "mp-listing-actions" },
          editable ? h("a", { class: "mp-btn mp-btn-outline", href: `#/modifier/${encodeURIComponent(l.id)}` }, "Modifier") : h("button", { class: "mp-btn mp-btn-outline", type: "button", disabled: true }, "Modifier"),
          l.status === "PUBLISHED" ? h("a", { class: "mp-btn mp-btn-outline", href: `#/annonce/${encodeURIComponent(l.id)}` }, "Voir") : h("button", { class: "mp-btn mp-btn-outline", type: "button", disabled: true, title: "Visible une fois l'annonce en ligne" }, "Voir"))));
  };
  const listingsBox = h("div", { class: "mp-listing-grid" });
  const paintListings = () => {
    const rows = listingFilter === "all" ? visible : visible.filter((l) => l.status === listingFilter);
    listingsBox.replaceChildren(...(rows.length ? rows.map(listingCard) : [h("div", { class: "mp-card mp-empty mp-span" }, h("div", { class: "mp-empty-ic" }, "🏠"), h("h3", null, "Aucune annonce ici"), h("p", null, "Déposez une annonce pour la retrouver dans cet onglet."))]));
    filterBox.querySelectorAll("[data-filter]").forEach((el) => el.classList.toggle("on", el.dataset.filter === listingFilter));
  };
  const filterBox = h("div", { class: "mp-card" }, h("h3", null, "Filtres rapides"),
    FILTERS.map(([f, ic, label]) => h("button", { class: "mp-intro mp-filter", type: "button", "data-filter": f, onClick: () => { listingFilter = f; paintListings(); } }, h("span", null, ic), `${label} (${count(f)})`)),
    h("a", { class: "mp-btn mp-btn-gold block", href: "#/publier" }, "Nouvelle annonce"),
    h("a", { class: "mp-link block", href: "#/mes-annonces" }, "Gestion avancée (prolonger, vendu, justificatif…)"));
  const annoncesTab = h("div", { class: "mp-grid" }, h("div", { class: "mp-col" }, filterBox), h("div", { class: "mp-col" }, listingsBox));

  /* ---------- Avis ---------- */
  const rating = pub?.rating ?? { average: 0, count: 0 };
  const avisTab = h("div", { class: "mp-grid" },
    h("div", { class: "mp-col" }, h("div", { class: "mp-card" }, h("h3", null, "Note globale"),
      h("div", { class: "mp-score" }, h("div", { class: "mp-score-value" }, rating.count ? String(rating.average).replace(".", ",") : "—", rating.count ? h("span", null, "/5") : null),
        rating.count ? stars(rating.average) : null,
        h("p", { class: "mp-score-note" }, rating.count ? `${rating.count} avis` : "Aucun avis pour le moment. Les avis sont collectés après des transactions réelles.")))),
    h("div", { class: "mp-col" }, reviews.length
      ? reviews.map((r) => h("article", { class: "mp-card" }, h("div", { class: "mp-row between" }, h("strong", null, r.author), stars(r.rating)), h("p", { class: "mp-post" }, r.body),
          r.reply ? h("p", { class: "mp-reply" }, h("b", null, "Votre réponse : "), r.reply.body) : null, h("small", null, dateFr(r.createdAt))))
      : h("div", { class: "mp-card mp-empty" }, h("div", { class: "mp-empty-ic" }, "⭐"), h("h3", null, "Aucun avis reçu"), h("p", null, "Les avis vous aident à bâtir votre réputation sur IKA SO."))));

  /* ---------- Paramètres & Confidentialité ---------- */
  const toggle = (on, label, onChange) => h("button", { class: `mp-toggle${on ? " active" : ""}`, type: "button", role: "switch", "aria-checked": String(on), "aria-label": label, onClick: onChange });
  const setting = (title, text, ...controls) => h("div", { class: "mp-setting" }, h("div", null, h("h5", null, title), h("p", null, text)), h("div", { class: "mp-ctl" }, controls));
  const proofLabel = { PENDING: "en cours de contrôle", ACCEPTED: "acceptée", REFUSED: "refusée" };
  const agencyRole = /agence/i.test(edit.role ?? "");
  const rccm = h("input", { class: "sr-only", type: "file", accept: "image/*,application/pdf", "aria-label": "Registre de commerce", onChange: async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    run(async () => api("/me/proofs", { method: "POST", body: { kind: "AGENCE", fileData: await readProofFile(file) } }), "Pièce envoyée. Une personne de l'équipe la contrôlera.");
  } });
  /* ---------- Abonnés : qui me suit, et qui je suis ---------- */
  const person = (x, ...extra) => h("li", { class: "mp-person" },
    x.avatarUrl ? h("img", { class: "mp-miniava", src: x.avatarUrl, alt: "", loading: "lazy" }) : h("span", { class: `mp-miniava${x.anonymous ? " anon" : ""}`, "aria-hidden": "true" }, x.anonymous ? "🕶" : initials(x.name)),
    h("div", { class: "mp-person-body" },
      x.id && !x.anonymous ? h("a", { href: `#/annonceur/${encodeURIComponent(x.id)}` }, h("strong", null, x.name)) : h("strong", null, x.name),
      h("small", null, [x.role, x.city, x.since ? `depuis le ${dateFr(x.since)}` : null].filter(Boolean).join(" · "))),
    ...extra);
  const followersCard = h("div", { class: "mp-card" }, h("h3", null, `Mes abonnés (${followers.total})`),
    h("p", { class: "mp-hint" }, "Les personnes qui suivent votre profil. Celles qui ont choisi l'anonymat apparaissent sans nom ni photo."),
    followers.items.length
      ? h("ul", { class: "mp-people" }, followers.items.map((x) => person(x)))
      : h("p", { class: "mp-hint" }, "Aucun abonné pour le moment."),
    followers.anonymousCount ? h("p", { class: "mp-hint" }, `Dont ${followers.anonymousCount} abonné${followers.anonymousCount > 1 ? "s" : ""} anonyme${followers.anonymousCount > 1 ? "s" : ""}.`) : null);
  const followingCard = h("div", { class: "mp-card" }, h("h3", null, `Mes abonnements (${following.length})`),
    h("p", { class: "mp-hint" }, "Pour chaque compte suivi, choisissez s'il voit votre nom ou non."),
    following.length
      ? h("ul", { class: "mp-people" }, following.map((x) => person({ ...x, anonymous: false },
          h("button", { class: "mp-btn mp-btn-outline sm", type: "button", title: "Changer la visibilité de mon identité pour ce compte",
            onClick: () => run(() => api(`/advertisers/${encodeURIComponent(x.id)}/follow`, { method: "PUT", body: { anonymous: !x.anonymous } }), x.anonymous ? "Votre nom est maintenant visible pour ce compte." : "Vous êtes anonyme pour ce compte.") },
            x.anonymous ? "🕶 Anonyme" : "👤 Nom visible"))))
      : h("p", { class: "mp-hint" }, "Vous ne suivez aucun compte."));
  const abonnes = h("div", { class: "mp-grid" }, h("div", { class: "mp-col" }, followersCard), h("div", { class: "mp-col" }, followingCard));

  /* ---------- Équipe : invitations entre comptes ---------- */
  const teamAct = (path, label, ok, cls = "mp-btn-outline") => h("button", { class: `mp-btn ${cls} sm`, type: "button", onClick: () => run(() => api(path, { method: "POST", body: {} }), ok) }, label);
  const teamPerson = (x, ...extra) => person({ ...x, role: x.teamRole || x.role, since: null }, ...extra);
  const teamTab = h("div", { class: "mp-grid" },
    h("div", { class: "mp-col" },
      h("div", { class: "mp-card" }, h("h3", null, `Membres de mon équipe (${team.members.length})`),
        h("p", { class: "mp-hint" }, "Une fois l'invitation acceptée, chaque compte apparaît dans l'équipe de l'autre. Pour inviter quelqu'un, ouvrez son profil et utilisez « Inviter dans mon équipe » (onglet Équipe)."),
        team.members.length ? h("ul", { class: "mp-people" }, team.members.map((x) => teamPerson(x, teamAct(`/me/team-requests/${encodeURIComponent(x.linkId)}/remove`, "Quitter", "Vous ne faites plus partie de cette équipe.")))) : h("p", { class: "mp-hint" }, "Aucun membre pour le moment."))),
    h("div", { class: "mp-col" },
      h("div", { class: "mp-card" }, h("h3", null, `Invitations reçues (${team.received.length})`),
        team.received.length ? h("ul", { class: "mp-people" }, team.received.map((x) => teamPerson(x,
          teamAct(`/me/team-requests/${encodeURIComponent(x.linkId)}/accept`, "Accepter", "Invitation acceptée.", "mp-btn-primary"),
          teamAct(`/me/team-requests/${encodeURIComponent(x.linkId)}/decline`, "Refuser", "Invitation refusée.")))) : h("p", { class: "mp-hint" }, "Aucune invitation en attente.")),
      h("div", { class: "mp-card" }, h("h3", null, `Invitations envoyées (${team.sent.length})`),
        team.sent.length ? h("ul", { class: "mp-people" }, team.sent.map((x) => teamPerson(x, teamAct(`/me/team-requests/${encodeURIComponent(x.linkId)}/remove`, "Annuler", "Invitation annulée.")))) : h("p", { class: "mp-hint" }, "Aucune invitation envoyée."))));

  const parametresTab = h("div", { class: "mp-grid" },
    h("div", { class: "mp-col" },
      h("div", { class: "mp-card" }, h("h3", null, "Confidentialité"),
        h("p", { class: "mp-hint" }, "Contrôlez les informations que vous partagez publiquement sur IKA SO."),
        setting("Afficher mon numéro", edit.hasPhone ? "Bouton « Appeler » visible sur mon profil. Le numéro n'est jamais écrit sur la page." : "Ajoutez d'abord un numéro à votre compte.",
          toggle(pr.showPhone, "Afficher mon numéro", () => edit.hasPhone && run(() => api("/me/public-profile", { method: "PUT", body: { showPhone: !pr.showPhone } }), "Préférence enregistrée."))),
        setting("Afficher WhatsApp", edit.hasPhone ? "Bouton « WhatsApp » visible sur mon profil." : "Ajoutez d'abord un numéro à votre compte.",
          toggle(pr.showWhatsapp, "Afficher WhatsApp", () => edit.hasPhone && run(() => api("/me/public-profile", { method: "PUT", body: { showWhatsapp: !pr.showWhatsapp } }), "Préférence enregistrée."))),
        setting("Suivre anonymement", "Quand je suis un compte, mon nom reste caché par défaut (modifiable à chaque abonnement, et pour chaque compte dans l'onglet Abonnés).",
          toggle(followSettings.anonymousByDefault, "Suivre anonymement par défaut", () => run(() => api("/me/follow-settings", { method: "PUT", body: { anonymousByDefault: !followSettings.anonymousByDefault, applyToExisting: !followSettings.anonymousByDefault } }), followSettings.anonymousByDefault ? "Vos prochains abonnements montreront votre nom." : "Vous êtes maintenant anonyme pour tous vos abonnements."))),
        consent ? setting("Statistiques d'annonces", "Partager mes vues anonymes",
          toggle(consent.accepted === true, "Statistiques d'annonces", () => run(() => api("/me/analytics-consent", { method: "PUT", body: { accepted: consent.accepted !== true } }), "Préférence enregistrée."))) : null)),
    h("div", { class: "mp-col" },
      h("div", { class: "mp-card" },
        h("div", { class: "mp-group" }, h("h4", null, "Vérification"),
          setting("Vérifier mon téléphone", h("span", null, "Statut : ", h("span", { class: m.phoneVerified ? "ok" : "warn" }, m.phoneVerified ? "Vérifié" : "Non vérifié")),
            m.phoneVerified ? badge("green", "✓ Vérifié") : h("a", { class: "mp-btn mp-btn-primary sm", href: "#/publier" }, "Vérifier")),
          setting("Justificatifs", proofs.length ? proofs.slice(0, 3).map((p) => `${p.kind === "AGENCE" ? "RCCM" : p.listingTitle || "Titre foncier"} : ${proofLabel[p.status] ?? p.status}`).join(" · ") : "Aucun document soumis",
            agencyRole ? h("button", { class: "mp-btn mp-btn-primary sm", type: "button", onClick: () => rccm.click() }, "Envoyer le RCCM") : h("a", { class: "mp-btn mp-btn-outline sm", href: "#/mes-annonces" }, "Joindre à une annonce"), agencyRole ? rccm : null)),
        h("div", { class: "mp-group" }, h("h4", null, "Données & Sécurité"),
          setting("Exporter mes données", "Télécharger une copie de mes données", h("a", { class: "mp-btn mp-btn-outline", href: "/api/me/export", download: "mes-donnees-ika-so.json" }, "Exporter")),
          setting("Supprimer mon compte", "Action irréversible : voir « Mes données » plus bas", h("button", { class: "mp-btn mp-btn-outline danger", type: "button", onClick: () => { const d = settingsHost.querySelector("details"); d?.setAttribute("open", ""); (d ?? settingsHost).scrollIntoView({ behavior: "smooth", block: "center" }); } }, "Supprimer"))))));
  const settingsHost = h("div", { class: "mp-more" }, h("h3", null, "Autres réglages du compte"));
  accountSettings(reload).then((node) => settingsHost.append(node)).catch(() => {});
  const parametres = h("div", { class: "mp-stack" }, parametresTab, settingsHost);

  /* ---------- Assemblage et onglets ---------- */
  const panels = { publications: publicationsTab, annonces: annoncesTab, avis: avisTab, abonnes, equipe: teamTab, parametres };
  const body = h("div", { class: "mp-body" });
  function show(tab) {
    currentTab = tab;
    body.replaceChildren(panels[tab]);
    header.querySelectorAll(".mp-tab").forEach((el) => el.setAttribute("aria-selected", String(el.dataset.tab === tab)));
    if (tab === "annonces") paintListings();
  }
  mount(app, h("div", { class: "mp" }, header, body));
  show(currentTab);
}
