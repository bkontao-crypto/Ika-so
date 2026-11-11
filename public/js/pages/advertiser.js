// Profil public d'un annonceur (particulier ou agence) : couverture, identité, chiffres, onglets, colonne de présentation.
// Tout vient de /advertisers/:id : rien n'est inventé. Une rubrique sans donnée réelle (abonnés, équipe, publications…) n'est pas affichée.
import { api, digits, fail, formatDate, formatPrice, h, mount, toast } from "/js/dom.js";
import { S, app } from "/js/core/state.js";
import { needLogin } from "/js/core/router.js";
import { field, select } from "/js/components/ui.js";
import { stars } from "/js/components/stars.js";

const REVIEW_REASONS = ["Insulte ou propos haineux", "Avis faux ou sans échange réel", "Information privée (numéro, adresse)", "Autre"];
const REPORT_REASONS = ["Arnaque ou demande d'acompte", "Annonce trompeuse ou bien inexistant", "Faux profil ou usurpation d'identité", "Harcèlement ou insultes", "Autre"];
const TIPS = ["Visitez le bien avant tout paiement et ne versez jamais d'acompte à distance.", "Demandez les documents (titre foncier, bail) et faites-les contrôler par un notaire.", "Vérifiez que la personne qui vous reçoit est bien celle de l'annonce.", "Gardez vos échanges dans Ika So : ils aident la modération en cas de litige."];

let cssDone = false;
const loadCss = () => {
  if (cssDone || document.querySelector('link[href="/css/profil.css"]')) { cssDone = true; return; }
  document.head.append(h("link", { rel: "stylesheet", href: "/css/profil.css" }));
  cssDone = true;
};

const duration = (days) => days < 1 ? "aujourd'hui" : days < 31 ? `${days} jour${days > 1 ? "s" : ""}` : days < 365 ? `${Math.floor(days / 30)} mois` : `${Math.floor(days / 365)} an${days >= 730 ? "s" : ""}`;
const initialsOf = (name) => (String(name ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("") || "?").toUpperCase();
const card = (...kids) => h("section", { class: "pa-card" }, ...kids);
const fact = (label, value) => h("div", { class: "pa-metric" }, h("small", null, label), h("strong", null, String(value)));
const infoRow = (glyph, ...kids) => h("div", null, h("span", { class: "pa-ico", "aria-hidden": "true" }, glyph), h("span", null, ...kids));
const CATEGORY_LABEL = { Appartement: "Appartements", Maison: "Maisons", Villa: "Villas", Terrain: "Terrains", Bureau: "Bureaux", Commerce: "Commerces" };

export async function advertiserPage(id) {
  loadCss();
  const p = await api(`/advertisers/${encodeURIComponent(id)}`);
  const pr = p.profile ?? { contact: {}, zones: [] };
  const contact = pr.contact ?? {};
  const zones = pr.zones ?? [];
  // Deux présentations selon le compte : une agence (vérifiée ou déclarée comme telle) ou une personne (particulier, propriétaire…).
  const agency = Boolean(p.agencyVerified) || /agence/i.test(p.displayRole ?? "");
  const roleLabel = agency ? "Agence immobilière" : (p.displayRole || "Particulier");
  const avg = p.rating.count ? String(p.rating.average).replace(".", ",") : "—";
  const city = p.listings.find((l) => l.city)?.city ?? "";
  const reload = () => advertiserPage(id);
  const run = async (fn, ok) => { try { await fn(); if (ok) toast(ok); } catch (error) { fail(error); } };
  const photos = p.listings.filter((l) => l.imageUrl);
  const first = p.listings[0];
  let tab = "listings";

  async function reportReview(reviewId) {
    if (needLogin()) return;
    const chosen = window.prompt(`Motif : ${REVIEW_REASONS.join(" / ")}`, REVIEW_REASONS[1]);
    if (chosen) run(() => api(`/reviews/${encodeURIComponent(reviewId)}/report`, { method: "POST", body: { reason: chosen.trim() } }), "Signalement transmis à la modération.");
  }
  async function replyTo(r) {
    const text = window.prompt("Votre réponse publique (faits uniquement, sans numéro de téléphone) :", r.reply?.body ?? "");
    if (text) run(async () => { await api(`/reviews/${encodeURIComponent(r.id)}/reply`, { method: "POST", body: { body: text } }); await reload(); }, "Réponse publiée.");
  }
  const reviewItem = (r) => h("li", { class: "pa-review" },
    h("div", { class: "pa-review-top" }, h("span", { class: "pa-miniava", "aria-hidden": "true" }, initialsOf(r.author)), h("div", null, h("strong", null, r.author), h("div", null, stars(r.rating)))),
    h("p", { class: "pa-about" }, r.body),
    r.reply ? h("div", { class: "pa-reply" }, h("small", null, h("strong", null, "Réponse de l'annonceur"), ` · ${formatDate(r.reply.at)}`), h("p", { class: "pa-about" }, r.reply.body)) : null,
    p.viewer.self ? h("div", { class: "pa-row" },
      h("button", { class: "pa-btn", type: "button", onClick: () => replyTo(r) }, r.reply ? "Modifier ma réponse" : "Répondre"),
      r.reply ? h("button", { class: "pa-btn", type: "button", onClick: () => run(async () => { await api(`/reviews/${encodeURIComponent(r.id)}/reply/delete`, { method: "POST", body: {} }); await reload(); }) }, "Retirer ma réponse") : null) : null,
    h("div", { class: "pa-review-foot" }, h("small", null, formatDate(r.createdAt)),
      S.user && !p.viewer.self ? h("button", { class: "pa-link", type: "button", "aria-label": `Signaler l'avis de ${r.author}`, onClick: () => reportReview(r.id) }, "Signaler") : null));
  const reviewList = (rows, empty) => rows.length ? h("ul", { class: "pa-list" }, rows.map(reviewItem)) : h("p", { class: "pa-muted" }, empty);

  const goTo = (key) => { tab = key; draw(); document.getElementById("pa-tabs")?.scrollIntoView({ block: "nearest" }); };

  // ── Couverture et identité ──────────────────────────────────────────────
  const badge = agency && p.agencyVerified ? "Agence vérifiée" : p.phoneVerifiedBySms ? "Numéro vérifié" : null;
  const meta = [roleLabel, city || zones[0], `Membre depuis ${duration(p.memberDays) === "aujourd'hui" ? "aujourd'hui" : formatDate(p.memberSince)}`].filter(Boolean).join(" · ");
  // Suivre : au premier abonnement on choisit entre « mon nom » et « anonyme » ; ensuite on peut changer à tout moment.
  function followControl() {
    const send = (anonymous, msg) => run(async () => { await api(`/advertisers/${encodeURIComponent(id)}/follow`, { method: "POST", body: { anonymous } }); await reload(); }, msg);
    const wrap = h("span", { class: "pa-follow" });
    if (p.isFollowing) {
      wrap.append(
        h("button", { class: "pa-btn soft", type: "button", onClick: () => send(undefined, "Vous ne suivez plus cet annonceur.") }, "✓ Suivi"),
        h("button", { class: "pa-btn", type: "button", title: "Choisir si cet annonceur voit votre identité parmi ses abonnés",
          onClick: () => run(async () => { await api(`/advertisers/${encodeURIComponent(id)}/follow`, { method: "PUT", body: { anonymous: !p.followAnonymous } }); await reload(); }, p.followAnonymous ? "Votre nom est maintenant visible." : "Vous êtes maintenant anonyme.") },
          p.followAnonymous ? "🕶 Anonyme" : "👤 Nom visible"));
      return wrap;
    }
    const menu = h("div", { class: "pa-follow-menu", role: "group", "aria-label": "Comment voulez-vous suivre ?", hidden: true },
      h("button", { type: "button", onClick: () => send(false, "Vous suivez cet annonceur.") }, "👤 Suivre avec mon nom"),
      h("button", { type: "button", onClick: () => send(true, "Vous suivez cet annonceur anonymement.") }, "🕶 Suivre anonymement"));
    wrap.append(h("button", { class: "pa-btn soft", type: "button", "aria-haspopup": "true", onClick: () => { if (needLogin()) return; menu.hidden = !menu.hidden; } }, "＋ Suivre"), menu);
    return wrap;
  }
  // Inviter ce compte dans mon équipe (accepté : les deux profils s'affichent mutuellement).
  function teamAction() {
    if (p.viewer.self) return h("p", null, h("a", { class: "pa-btn", href: "#/profil?tab=equipe" }, "Gérer mon équipe"));
    const st = p.teamLink?.status ?? "NONE";
    if (st === "MEMBER") return h("p", { class: "pa-muted" }, "✓ Ce compte fait partie de votre équipe.");
    if (st === "SENT") return h("p", { class: "pa-muted" }, "Invitation envoyée : en attente de réponse.");
    if (st === "RECEIVED") return h("p", null, h("a", { class: "pa-btn primary", href: "#/profil?tab=equipe" }, "Ce compte vous a invité : répondre"));
    return h("p", null, h("button", { class: "pa-btn", type: "button", onClick: () => {
      if (needLogin()) return;
      const role = window.prompt("Rôle de ce compte dans votre équipe (facultatif, ex. : Agent commercial) :", "");
      if (role === null) return;
      run(async () => { await api(`/advertisers/${encodeURIComponent(id)}/team-request`, { method: "POST", body: { role: role.trim() } }); await reload(); }, "Invitation envoyée.");
    } }, "＋ Inviter dans mon équipe"));
  }
  const actions = p.viewer.self
    ? [h("a", { class: "pa-btn primary", href: "#/centre" }, "Mon espace"),
       h("a", { class: "pa-btn", href: "#/mon-profil-public" }, "Modifier mon profil")]
    : [followControl(),
      h("button", { class: "pa-btn soft", type: "button", onClick: () => goTo("reviews") }, "★ Donner mon avis"),
      first ? h("a", { class: "pa-btn", href: `#/annonce/${encodeURIComponent(first.id)}` }, "✉ Message") : null,
      h("button", { class: "pa-btn primary", type: "button", onClick: () => { document.getElementById("pa-contact")?.scrollIntoView({ behavior: "smooth", block: "center" }); } }, "☎ Contacter")];
  const head = [
    pr.coverUrl ? h("img", { class: "pa-cover", src: pr.coverUrl, alt: "", loading: "lazy" }) : h("div", { class: "pa-cover", "aria-hidden": "true" }),
    h("section", { class: "pa-head" },
      h("div", { class: "pa-identity" },
        pr.avatarUrl ? h("img", { class: "pa-avatar", src: pr.avatarUrl, alt: `Photo de ${p.name}` }) : h("div", { class: "pa-avatar", "aria-hidden": "true" }, initialsOf(p.name)),
        h("div", { class: "pa-who" },
          h("h1", null, p.name, badge ? h("span", { class: "pa-verified" }, ` ● ${badge}`) : null),
          h("div", { class: "pa-meta" }, meta),
          pr.bio ? h("div", { class: "pa-meta pa-clamp" }, pr.bio) : null),
        h("div", { class: "pa-actions" }, actions)),
      p.restricted ? h("p", { class: "pa-banner" }, "Ce compte fait l'objet d'une restriction par la modération. Soyez très prudent.") : null,
      h("div", { class: "pa-stats" },
        h("span", null, h("b", null, String(p.experience.listingsNow)), " annonces"),
        p.viewer.self
          ? h("a", { class: "pa-statlink", href: "#/profil?tab=abonnes" }, h("b", null, String(p.followers || 0)), " abonnés")
          : h("span", null, h("b", null, String(p.followers || 0)), " abonnés"),
        h("span", null, h("b", null, String(p.following || 0)), " abonnements"),
        h("span", null, h("b", null, p.rating.count ? `${avg}/5` : "—"), p.rating.count ? " avis clients" : " · pas encore d'avis"),
        p.responseRate != null ? h("span", null, h("b", null, `${p.responseRate} %`), " réponse") : h("span", null, h("b", null, "—"), " réponse")),
      h("nav", { class: "pa-tabs", id: "pa-tabs", role: "tablist", "aria-label": "Sections du profil" })),
  ];
  const nav = head[1].querySelector(".pa-tabs");
  const ownerSpace = p.viewer.self ? h("section", { class: "pa-card", style: "margin-bottom:16px" },
    h("h2", null, "Mon espace"),
    h("p", { class: "pa-muted" }, "Vos annonces, messages et visites au même endroit."),
    h("a", { class: "pa-btn primary", href: "#/centre" }, "Ouvrir mon espace")) : null;
  const tabs = [
    ["publications", "Publications"],
    ["listings", `Annonces immobilières (${p.listings.length})`],
    ["about", agency ? "À propos" : "À propos"],
    ["reviews", `Avis & évaluations (${p.rating.count})`],
    ["team", "Équipe"],
    ["activity", "Activité"],
    ["gallery", "Photos & vidéos"],
    ["services", "Services"],
    ["trust", "Informations & confiance"],
  ];

  // ── Colonne de gauche ───────────────────────────────────────────────────
  const specialties = [...new Set(p.listings.map((l) => l.transactionType).filter(Boolean))].concat([...new Set(p.listings.map((l) => l.category).filter(Boolean))].map((c) => CATEGORY_LABEL[c] ?? c)).slice(0, 8);
  const dist = h("div", { class: "pa-dist", "aria-label": "Répartition des notes" }, [5, 4, 3, 2, 1].map((n) => {
    const c = p.rating.distribution[n] ?? 0; const pct = p.rating.count ? Math.round((c / p.rating.count) * 100) : 0;
    return h("div", null, `${n} ★`, h("span", { class: "pa-bar", role: "img", "aria-label": `${n} sur 5 : ${c} avis` }, h("i", { style: { width: `${pct}%` } })), `${pct} %`);
  }));
  const aside = h("aside", { class: "pa-col" },
    card(h("h2", null, "Présentation"),
      pr.bio ? h("p", { class: "pa-about" }, pr.bio) : h("p", { class: "pa-muted" }, agency ? "L'agence n'a pas encore rédigé de présentation." : "Cet annonceur n'a pas encore rédigé de présentation."),
      h("div", { class: "pa-info" },
        city || pr.address ? infoRow("⌖", pr.address || city, pr.address && city ? h("small", { class: "pa-muted" }, h("br"), city) : null) : null,
        zones.length ? infoRow("◎", `Zones : ${zones.join(", ")}`) : null,
        pr.hours ? infoRow("◷", pr.hours) : null,
        pr.foundedYear ? infoRow("▣", `Depuis ${pr.foundedYear} (déclaré)`) : null,
        infoRow("✦", `Sur Ika So depuis ${duration(p.memberDays)}`))),
    specialties.length ? card(h("h2", null, "Spécialités"), h("div", { class: "pa-chips" }, specialties.map((s) => h("span", { class: "pa-chip" }, s)))) : null,
    card(h("h2", null, "Évaluation des clients"),
      p.rating.count ? h("div", null, h("div", { class: "pa-rating" }, h("strong", null, avg), h("div", null, stars(p.rating.average, { label: `Note moyenne ${avg} sur 5` }), h("small", { class: "pa-muted" }, h("br"), `Sur ${p.rating.count} avis`))), dist)
        : h("p", { class: "pa-muted" }, "Pas encore d'avis.")),
    card(h("h2", null, "Certifications & badges"), h("div", { class: "pa-chips" },
      h("span", { class: "pa-chip strong" }, p.trust.label),
      p.agencyVerified ? h("span", { class: "pa-chip ok" }, "◆ Agence vérifiée") : null,
      h("span", { class: p.phoneVerifiedBySms ? "pa-chip ok" : "pa-chip" }, p.phoneVerifiedBySms ? "✓ Numéro vérifié par SMS" : "Numéro non vérifié par SMS"),
      p.experience.titleChecked ? h("span", { class: "pa-chip ok" }, `✓ ${p.experience.titleChecked} titre${p.experience.titleChecked > 1 ? "s" : ""} foncier${p.experience.titleChecked > 1 ? "s" : ""} contrôlé${p.experience.titleChecked > 1 ? "s" : ""}`) : null,
      p.responseRate != null && p.responseRate >= 80 ? h("span", { class: "pa-chip ok" }, "⚡ Réponse rapide") : null)));

  // ── Panneaux ────────────────────────────────────────────────────────────
  const listingCard = (l) => h("a", { class: "pa-listing", href: `#/annonce/${encodeURIComponent(l.id)}` },
    l.imageUrl ? h("img", { class: "pa-listingimg", src: l.imageUrl, alt: "", loading: "lazy" }) : h("div", { class: "pa-listingimg", "aria-hidden": "true" }),
    h("div", { class: "pa-listingbody" }, h("b", null, l.title), h("small", null, [l.neighborhood, l.surfaceLabel].filter(Boolean).join(" · ")),
      h("div", { class: "pa-price" }, formatPrice(l.price, l.transactionType)),
      l.documentVerified ? h("span", { class: "pa-badge" }, "Titre foncier contrôlé") : null));

  function reviewsTab() {
    let rating = p.viewer.mine?.rating ?? 0;
    let form;
    if (!p.viewer.signedIn) form = h("p", { class: "pa-about" }, h("a", { href: `#/connexion?next=${encodeURIComponent(`/annonceur/${p.id}`)}` }, "Connectez-vous"), " pour donner votre avis.");
    else if (!p.viewer.canReview) form = h("p", { class: "pa-muted" }, p.viewer.reason);
    else {
      const body = h("textarea", { class: "input", rows: "4", maxlength: "600", required: true, "aria-label": "Votre avis", placeholder: "Racontez les faits : le bien était-il conforme ? L'annonceur était-il joignable et honnête ?", value: p.viewer.mine?.body ?? "" });
      const picker = h("div", { class: "pa-row", role: "radiogroup", "aria-label": "Note de 1 à 5" }, [1, 2, 3, 4, 5].map((n) => h("button", { class: `pa-btn${rating === n ? " primary" : ""}`, type: "button", role: "radio", "aria-checked": String(rating === n), onClick: () => {
        rating = n; picker.querySelectorAll("button").forEach((b, i) => { b.setAttribute("aria-checked", String(i + 1 === n)); b.classList.toggle("primary", i + 1 === n); });
      } }, String(n))));
      form = h("form", { class: "pa-stack", onSubmit: (e) => { e.preventDefault(); if (!rating) return toast("Choisissez une note de 1 à 5.", true); run(async () => { await api(`/advertisers/${encodeURIComponent(p.id)}/reviews`, { method: "POST", body: { rating, body: body.value } }); await reload(); }, "Avis enregistré."); } },
        p.viewer.mine?.hidden ? h("p", { class: "pa-banner" }, "Votre avis a été masqué par la modération.") : null,
        h("p", { class: "pa-muted" }, "Votre note (1 = très mauvais, 5 = excellent)"), picker, field("Votre avis", body),
        h("div", { class: "pa-row" }, h("button", { class: "pa-btn primary", type: "submit" }, p.viewer.mine ? "Modifier mon avis" : "Publier mon avis"),
          p.viewer.mine ? h("button", { class: "pa-btn", type: "button", onClick: () => run(async () => { await api(`/advertisers/${encodeURIComponent(p.id)}/reviews/delete`, { method: "POST", body: {} }); await reload(); }, "Avis supprimé.") }, "Supprimer mon avis") : null));
    }
    const list = h("div", { class: "pa-stack" });
    const more = h("button", { class: "pa-btn", type: "button", hidden: true, onClick: () => load(false) }, "Voir plus d'avis");
    let kind = "recent"; let offset = 0;
    async function load(reset) {
      if (reset) { offset = 0; list.replaceChildren(); }
      try {
        const rows = await api(`/advertisers/${encodeURIComponent(p.id)}/reviews?kind=${kind}&limit=10&offset=${offset}`);
        offset += rows.length;
        if (reset && !rows.length) list.append(h("p", { class: "pa-muted" }, kind === "best" ? "Aucun avis positif (4 ou 5 sur 5) pour le moment." : kind === "worst" ? "Aucun avis négatif (1 ou 2 sur 5) pour le moment." : "Pas encore d'avis."));
        list.append(h("ul", { class: "pa-list" }, rows.map(reviewItem))); more.hidden = rows.length < 10;
      } catch (error) { fail(error); }
    }
    const chips = h("div", { class: "pa-row", role: "group", "aria-label": "Filtrer les avis" }, [["recent", "Tous"], ["best", "Positifs (4-5)"], ["worst", "Négatifs (1-2)"]].map(([k, label]) =>
      h("button", { class: `pa-btn${k === kind ? " primary" : ""}`, type: "button", "aria-pressed": String(k === kind), onClick: (e) => { kind = k; chips.querySelectorAll("button").forEach((b) => { b.classList.remove("primary"); b.setAttribute("aria-pressed", "false"); }); e.currentTarget.classList.add("primary"); e.currentTarget.setAttribute("aria-pressed", "true"); load(true); } }, label)));
    load(true);
    return [card(h("div", { class: "pa-sectionhead" }, h("h2", null, "Avis & évaluations"), h("span", { class: "pa-badge" }, `${p.rating.count} avis`)), form),
      card(chips, list, more),
      h("p", { class: "pa-muted" }, "Les avis sont donnés par des personnes ayant contacté cet annonceur. Ils sont relus par la modération en cas de signalement. Ika So ne certifie ni les avis ni les biens.")];
  }

  function trustTab() {
    const hs = p.history ?? { published: 0, rejected: 0, closed: 0 };
    let reason = REPORT_REASONS[0];
    const details = h("textarea", { class: "input", rows: "3", maxlength: "1000", "aria-label": "Détails du litige", placeholder: "Décrivez les faits : date, annonce concernée, ce qui a été demandé ou promis." });
    const report = h("form", { class: "pa-stack", onSubmit: (e) => { e.preventDefault(); if (needLogin()) return; run(async () => { await api(`/advertisers/${encodeURIComponent(p.id)}/report`, { method: "POST", body: { reason, details: details.value } }); details.value = ""; }, "Signalement transmis à la modération."); } },
      field("Motif", select(REPORT_REASONS, reason, (v) => { reason = v; })), field("Détails", details), h("button", { class: "pa-btn", type: "submit" }, "⚑ Signaler ce profil"));
    return [
      card(h("h2", null, "Informations & confiance"), h("p", { class: "pa-muted" }, `${p.trust.met} critère(s) sur ${p.trust.total} constatés`),
        h("div", { class: "pa-info" }, p.trust.criteria.map((c) => h("div", null, h("span", { class: "pa-ico", "aria-hidden": "true" }, c.ok ? "✓" : "○"), h("span", null, c.label), h("span", { class: c.ok ? "pa-badge" : "pa-badge off" }, c.ok ? "Constaté" : "Pas encore")))),
        h("div", { class: "pa-notice" }, h("b", null, "Conseil sécurité : "), p.trust.notice)),
      card(h("h2", null, "Antécédents constatés"), h("div", { class: "pa-twocol" }, fact("Annonces publiées", hs.published), fact("Biens vendus ou loués", hs.closed), fact("Annonces refusées par la modération", hs.rejected), fact("Première annonce", hs.firstPublishedAt ? formatDate(hs.firstPublishedAt) : "—")),
        h("p", { class: "pa-muted" }, "Seuls des faits comptés par Ika So sont affichés. Un refus peut venir d'une simple erreur de saisie. Les signalements en cours ne sont pas publics : ils ne prouvent rien tant que la modération ne les a pas examinés.")),
      card(h("h2", null, "Avant d'acheter ou de louer"), h("ul", { class: "pa-bullets" }, TIPS.map((t) => h("li", null, t)))),
      p.viewer.self ? null : card(h("h2", null, "Règles & signalement"), h("p", { class: "pa-about" }, "Vous pouvez signaler un profil ou un comportement suspect. Un signalement est examiné par l'équipe et n'entraîne aucune sanction automatique."), report)];
  }

  const panels = {
    listings: () => [card(h("div", { class: "pa-sectionhead" }, h("div", null, h("h2", null, "Annonces immobilières"), h("small", { class: "pa-muted" }, "Biens actuellement proposés par ce profil"))),
      p.listings.length ? h("div", { class: "pa-listinggrid" }, p.listings.map(listingCard)) : h("div", { class: "pa-empty" }, h("b", null, "Aucune annonce en ligne"), "Ce profil n'a pas de bien publié actuellement."))],
    publications: () => [card(h("h2", null, "Publications"), p.publications?.length ? h("div", { class: "pa-stack" }, p.publications.map((pub) => h("article", { class: "pa-post" }, h("p", { class: "pa-about" }, pub.content), pub.imageUrl ? h("img", { src: pub.imageUrl, alt: "", style: { maxWidth: "100%", borderRadius: "12px", marginTop: "8px" } }) : null, h("small", { class: "pa-muted" }, formatDate(pub.createdAt))))) : h("p", { class: "pa-muted" }, "Aucune publication pour le moment."))],
    team: () => [card(h("h2", null, "Équipe & collaborateurs"),
      p.team?.length ? h("div", { class: "pa-listinggrid" }, p.team.map((m) => h(m.userId ? "a" : "div", { class: "pa-metric", href: m.userId ? `#/annonceur/${encodeURIComponent(m.userId)}` : null },
        m.avatarUrl ? h("img", { class: "pa-miniava", src: m.avatarUrl, alt: "", loading: "lazy" }) : h("div", { class: "pa-miniava" }, initialsOf(m.name)), h("b", null, m.name), h("small", null, m.role || "Collaborateur")))) : h("p", { class: "pa-muted" }, "Aucune équipe renseignée."),
      teamAction())],
    services: () => [card(h("h2", null, "Services proposés"), p.services?.length ? h("div", { class: "pa-info" }, p.services.map((s) => infoRow("▣", h("b", null, s.title), s.description ? h("small", { class: "pa-muted" }, h("br"), s.description) : null))) : h("p", { class: "pa-muted" }, "Aucun service listé."))],
    about: () => [card(h("h2", null, agency ? "À propos de l'agence" : "À propos"), pr.bio ? h("p", { class: "pa-about" }, pr.bio) : null,
      h("div", { class: "pa-twocol" }, pr.foundedYear ? fact("Création (déclarée)", pr.foundedYear) : null, zones.length ? fact("Zones d'intervention", zones.join(", ")) : null, pr.address ? fact("Adresse", pr.address) : null, pr.hours ? fact("Horaires", pr.hours) : null,
        fact("Type de compte", agency ? (p.agencyVerified ? "Agence vérifiée" : "Agence") : roleLabel), fact("Sur Ika So depuis", `${duration(p.memberDays)} (${formatDate(p.memberSince)})`)),
      !pr.bio && !pr.foundedYear && !zones.length && !pr.address && !pr.hours ? h("p", { class: "pa-muted" }, "Aucune information complémentaire renseignée.") : h("p", { class: "pa-muted" }, "Informations déclarées par l'annonceur, non contrôlées par Ika So."))],
    reviews: reviewsTab,
    gallery: () => [card(h("h2", null, "Photos & vidéos"), photos.length ? h("div", { class: "pa-listinggrid" }, photos.map((l) => h("a", { href: `#/annonce/${encodeURIComponent(l.id)}`, "aria-label": l.title }, h("img", { class: "pa-listingimg round", src: l.imageUrl, alt: l.title, loading: "lazy" })))) : h("p", { class: "pa-muted" }, "Aucune photo pour le moment."))],
    activity: () => [card(h("h2", null, "Activité du profil"), h("div", { class: "pa-twocol" },
      fact("Annonces en ligne", p.experience.listingsNow), fact("Annonces publiées au total", p.experience.listingsEver), fact("Biens vendus ou loués", p.experience.closed), fact("Contacts reçus", p.experience.contactsReceived)),
      h("p", { class: "pa-muted" }, "Ces chiffres sont comptés par Ika So. « Vendus ou loués » dépend de ce que l'annonceur déclare."))],
    trust: trustTab,
  };

  // ── Contact (toujours visible sous les onglets) ─────────────────────────
  const reach = async (kind) => {
    if (needLogin()) return;
    run(async () => {
      const { phone } = await api(`/advertisers/${encodeURIComponent(p.id)}/contact`, { method: "POST", body: { kind } });
      const clean = String(phone).replace(/[^\d+]/g, "");
      if (kind === "CALL") location.href = `tel:${clean}`;
      else window.open(`https://wa.me/${digits(clean)}`, "_blank", "noopener,noreferrer");
    });
  };
  const contactCard = p.viewer.self ? null : h("section", { class: "pa-card", id: "pa-contact" },
    h("h2", null, agency ? "Contacter l'agence" : "Contacter l'annonceur"),
    h("p", { class: "pa-about" }, agency ? "Une question sur un bien ou un service ? Appelez l'agence ou écrivez-lui au sujet d'une annonce." : "Une question sur un bien ? Contactez directement cet annonceur."),
    h("div", { class: "pa-row" },
      contact.canCall ? h("button", { class: "pa-btn primary", type: "button", onClick: () => reach("CALL") }, "☎ Appeler") : null,
      contact.canWhatsapp ? h("button", { class: "pa-btn", type: "button", onClick: () => reach("WHATSAPP") }, "WhatsApp") : null,
      first ? h("a", { class: "pa-btn", href: `#/annonce/${encodeURIComponent(first.id)}` }, "✉ Écrire à propos d'une annonce") : null),
    !contact.canCall && !contact.canWhatsapp ? h("p", { class: "pa-muted" }, "Cet annonceur n'affiche pas son numéro sur son profil.") : null,
    contact.needsLogin ? h("p", { class: "pa-muted" }, "Connexion demandée pour afficher les moyens de contact : cela limite les abus.") : null,
    h("p", { class: "pa-muted" }, "Un échange par la messagerie, un appel ou WhatsApp vous permet ensuite de donner votre avis."));
  const shareBtn = h("button", { class: "pa-btn", type: "button", onClick: async () => { try { if (navigator.share) await navigator.share({ title: p.name, url: location.href }); else { await navigator.clipboard.writeText(location.href); toast("Lien copié."); } } catch { /* partage annulé */ } } }, "↗ Partager ce profil");

  const panel = h("div", { class: "pa-stack", role: "tabpanel", id: "pa-panel" });
  function draw() {
    nav.replaceChildren(...tabs.map(([key, label]) => h("button", { type: "button", role: "tab", class: tab === key ? "active" : null, "aria-selected": String(tab === key), tabindex: tab === key ? "0" : "-1", onClick: () => goTo(key),
      onKeydown: (e) => { const at = tabs.findIndex(([k]) => k === key); const i = at + (e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0); if (i !== at && tabs[i]) { e.preventDefault(); goTo(tabs[i][0]); nav.querySelector("[aria-selected=true]")?.focus(); } } }, label)));
    mount(panel, panels[tab]());
  }

  const root = h("div", { class: `pa pa-${agency ? "agency" : "person"}` },
    h("a", { href: "#/annonceurs", class: "pa-back" }, "← Retour aux annonceurs"),
    ...head,
    ownerSpace,
    h("div", { class: "pa-layout" }, aside, h("div", { class: "pa-col pa-main" }, panel, contactCard, h("div", { class: "pa-row" }, shareBtn))));
  mount(app, root);
  draw();
}
