import { documentDisclaimer, REPORT_REASONS, api, fail, formatPrice, h, mount, toast } from "/js/dom.js";
import { S, app } from "/js/core/state.js";
import { watchDwell } from "/js/core/analytics.js";
import { needLogin } from "/js/core/router.js";
import { field, select } from "/js/components/ui.js";
import { initials } from "/js/components/espace.js";
import { openFullscreen, socialBar } from "/js/components/social.js";
import { brand } from "../core/brand.js";
import { icon } from "/js/icons.js";
import { moduleNotice } from "/js/components/module-notice.js";

export async function listingPage(id) {
  const [item, comments, similar] = await Promise.all([api(`/listings/${encodeURIComponent(id)}`), api(`/listings/${encodeURIComponent(id)}/comments`), api(`/listings/${encodeURIComponent(id)}/similar`).catch(() => [])]);
  watchDwell(item.id ?? id); // durée de visionnage, envoyée à la sortie de la fiche
  const ownerSummary = h("div", { class: "card owner-card", style: "margin-top:16px" },
    h("div", { class: "owner-body" }, h("h3", { style: "margin:0 0 8px" }, "Annonceur"),
      h("p", { class: "muted small" }, "Chargement…"))
  );
  if (item.ownerId) api(`/advertisers/${encodeURIComponent(item.ownerId)}`).then((p) => {
    const pills = [];
    if (p.rating?.count) pills.push(h("span", { class: "pill pill-gold" }, `★ ${String(p.rating.average).replace(".", ",")}/5 (${p.rating.count})`));
    if (p.trust?.label) pills.push(h("span", { class: "pill pill-green" }, p.trust.label));
    if (p.agencyVerified) pills.push(h("span", { class: "pill" }, "Agence vérifiée"));
    // filter(Boolean) : replaceChildren écrit « null » à la place d'un élément absent.
    // Photo de profil (ou initiales) à côté du nom. Une photo masquée par l'annonceur ou la modération n'arrive pas de l'API.
    const name = p.name || "Annonceur";
    const avatar = p.profile?.avatarUrl ? h("img", { class: "owner-avatar", src: p.profile.avatarUrl, alt: `Photo de ${name}`, loading: "lazy" }) : h("div", { class: "owner-avatar", "aria-hidden": "true" }, initials(name));
    ownerSummary.replaceChildren(h("div", { class: "owner-body" }, ...[
      h("div", { class: "owner-id" }, avatar, h("div", { class: "owner-who" }, h("h3", { style: "margin:0" }, name), p.displayRole ? h("small", { class: "muted" }, p.displayRole) : null)),
      pills.length ? h("div", { class: "row wrap gap-sm", style: "margin-top:10px" }, ...pills) : null,
      p.trust?.detail ? h("p", { class: "small muted" }, p.trust.detail) : null,
      h("a", { class: "btn btn-small btn-outline", href: `#/annonceur/${encodeURIComponent(item.ownerId)}`, style: "margin-top:8px" }, "Voir le profil")
    ].filter(Boolean)));
  }).catch(() => {
    ownerSummary.replaceChildren(h("p", { class: "muted small" }, "Informations annonceur indisponibles."), h("a", { class: "btn btn-small btn-outline", href: `#/annonceur/${encodeURIComponent(item.ownerId)}` }, "Voir le profil"));
  });
  let photo = 0;
  const all = item.photos.length ? item.photos : [item.imageUrl].filter(Boolean);
  // Clic sur la photo : plein écran, avec défilement gauche/droite (flèches, clavier, balayage) s'il y a plusieurs photos.
  const openFull = () => { if (all.length) openFullscreen(all, photo, (i) => { photo = i; main.src = all[i]; drawThumbs(); }); };
  const main = h("img", { src: all[0] ?? "", alt: item.title, class: "gallery-zoom", role: "button", tabindex: "0", "aria-label": "Afficher la photo en plein écran",
    onClick: openFull, onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openFull(); } } });
  // Mosaïque façon maquette : grande photo + 5 vignettes (la dernière indique « +N » s'il en reste).
  const thumbs = h("div", { class: "ld-thumbs" });
  const dots = h("div", { class: "ld-dots", "aria-hidden": "true" });
  const drawThumbs = () => {
    const extra = all.slice(1, 6);
    mount(thumbs, extra.length ? extra.map((url, k) => {
      const i = k + 1; const more = all.length - 6;
      return h("button", { class: "ld-thumb", type: "button", "aria-label": `Photo ${i + 1}`, "aria-current": String(i === photo), onClick: () => { photo = i; main.src = url; drawThumbs(); } },
        h("img", { src: url, alt: "", loading: "lazy" }), k === extra.length - 1 && more > 0 ? h("span", { class: "ld-more" }, `+${more}`) : null);
    }) : null);
    mount(dots, all.length > 1 ? all.slice(0, 5).map((_, i) => h("span", { class: i === Math.min(photo, 4) ? "on" : "" })) : null);
  };
  drawThumbs();

  async function contact(kind) {
    if (needLogin()) return;
    try {
      const { phone } = await api(`/listings/${encodeURIComponent(id)}/contact`, { method: "POST", body: { kind } });
      const clean = phone.replace(/\s/g, "");
      if (kind === "CALL") location.href = `tel:${clean}`;
      else {
        const text = encodeURIComponent(`Bonjour, je vous contacte depuis ${brand()} au sujet de « ${item.title} ». Est-elle toujours disponible ?`);
        window.open(`https://wa.me/${clean.replace("+", "")}?text=${text}`, "_blank", "noopener,noreferrer");
      }
    } catch (error) { fail(error); }
  }

  async function share() {
    const url = location.href;
    try {
      if (navigator.share) await navigator.share({ title: item.title, url });
      else { await navigator.clipboard.writeText(url); toast("Lien copié."); }
    } catch { /* partage annulé */ }
  }

  async function reportComment(commentId) {
    const reason = window.prompt("Motif : Insulte ou propos haineux / Arnaque ou demande d'acompte / Publicité ou spam / Autre", "Arnaque ou demande d'acompte");
    if (!reason) return;
    try { await api(`/comments/${encodeURIComponent(commentId)}/report`, { method: "POST", body: { reason: reason.trim() } }); toast("Signalement transmis à la modération."); } catch (error) { fail(error); }
  }

  const commentList = h("ul", { class: "stack" });
  const drawComments = (rows) => mount(commentList, rows.length
    ? rows.map((c) => h("li", { class: "comment" }, h("strong", null, c.authorName), h("p", null, c.body),
        S.user ? h("button", { class: "btn btn-quiet btn-small", type: "button", "aria-label": `Signaler le commentaire de ${c.authorName}`, onClick: () => reportComment(c.id) }, "Signaler") : null))
    : h("li", { class: "muted small" }, "Pas encore de commentaire."));
  drawComments(comments);
  const body = h("input", { class: "input", placeholder: "Une question précise, sans acompte", maxlength: "1000", "aria-label": "Votre commentaire" });

  const dialog = h("dialog", { "aria-labelledby": "report-title" });
  let reason = REPORT_REASONS[0];
  const details = h("textarea", { class: "input", rows: "3", placeholder: "Précisions facultatives", "aria-label": "Précisions facultatives" });
  dialog.append(h("form", { class: "pad stack", method: "dialog" },
    h("h2", { id: "report-title" }, "Signaler cette annonce"),
    field("Motif", select(REPORT_REASONS, reason, (v) => { reason = v; })), details,
    h("div", { class: "row" },
      h("button", { class: "btn btn-quiet", value: "cancel" }, "Annuler"),
      h("button", { class: "btn btn-primary", type: "button", onClick: async () => {
        if (needLogin()) return;
        try {
          await api(`/listings/${encodeURIComponent(id)}/report`, { method: "POST", body: { reason, details: details.value } });
          dialog.close();
          toast("Signalement transmis à la modération.");
        } catch (error) { fail(error); }
      } }, "Envoyer"))));

  const msg = h("textarea", { class: "input", rows: "3", maxlength: "1000", "aria-label": "Votre message", placeholder: "Bonjour, ce bien est-il toujours disponible ?" });
  const msgDialog = h("dialog", { "aria-labelledby": "msg-title" }, h("form", { class: "pad stack", method: "dialog" },
    h("h2", { id: "msg-title" }, "Écrire à l'annonceur"), h("div", { "data-module": "messaging" }, msg), moduleNotice("messaging"),
    h("p", { class: "small muted" }, "Ne versez aucun acompte avant la visite et le contrôle du document."),
    h("div", { class: "row" }, h("button", { class: "btn btn-quiet", value: "cancel" }, "Annuler"),
      h("button", { class: "btn btn-primary", type: "button", "data-module": "messaging", onClick: async () => {
        try { const r = await api(`/listings/${encodeURIComponent(id)}/messages`, { method: "POST", body: { body: msg.value } }); msgDialog.close(); toast("Message envoyé."); location.hash = `#/boite/${r.threadId}`; } catch (error) { fail(error); }
      } }, "Envoyer"))));
  const when = h("input", { class: "input", type: "datetime-local", "aria-label": "Date et heure proposées" });
  const visitNote = h("input", { class: "input", maxlength: "300", "aria-label": "Précision", placeholder: "Précision facultative" });
  const visitDialog = h("dialog", { "aria-labelledby": "visit-title" }, h("form", { class: "pad stack", method: "dialog" },
    h("h2", { id: "visit-title" }, "Demander une visite"), field("Date et heure proposées (heure du Mali)", when), visitNote,
    h("div", { class: "row" }, h("button", { class: "btn btn-quiet", value: "cancel" }, "Annuler"),
      h("button", { class: "btn btn-primary", type: "button", onClick: async () => {
        try { await api(`/listings/${encodeURIComponent(id)}/visit`, { method: "POST", body: { proposedAt: when.value ? new Date(`${when.value}:00Z`).toISOString() : "", note: visitNote.value } }); visitDialog.close(); toast("Demande envoyée. L'annonceur vous répondra dans la boîte."); } catch (error) { fail(error); }
      } }, "Envoyer"))));

  // Favori (signet sur la galerie) : état initial lu seulement pour un compte connecté.
  const bookmark = h("button", { class: "ld-round ld-bookmark", type: "button", "aria-pressed": "false", "aria-label": "Ajouter aux favoris", onClick: async () => {
    if (needLogin()) return;
    try { const { on } = await api(`/listings/${encodeURIComponent(id)}/favorite`, { method: "POST", body: {} }); setFav(on); } catch (error) { fail(error); }
  } }, icon("bookmark"));
  const setFav = (on) => { bookmark.setAttribute("aria-pressed", String(on)); bookmark.setAttribute("aria-label", on ? "Retirer des favoris" : "Ajouter aux favoris"); };
  if (S.user) api("/me/favorites").then((rows) => setFav(rows.some((r) => String(r.id) === String(item.id)))).catch(() => undefined);

  const n = (v, one, many) => `${v} ${v > 1 ? many : one}`;
  const quick = [
    item.bedrooms != null ? h("span", null, icon("bed"), n(item.bedrooms, "chambre", "chambres")) : null,
    item.bathrooms != null ? h("span", null, icon("bath"), n(item.bathrooms, "sanitaire", "sanitaires")) : null,
    item.surfaceLabel ? h("span", null, icon("ruler"), item.surfaceLabel) : null,
  ].filter(Boolean);
  const tile = (ic, label, value) => h("div", { class: "ld-tile" }, icon(ic), h("small", null, label), h("strong", null, value));
  const tiles = [
    item.bedrooms != null ? tile("bed", "Chambres", String(item.bedrooms)) : tile("home", "Type de bien", item.category ?? "—"),
    tile("bath", "Sanitaires", item.bathrooms == null ? "—" : String(item.bathrooms)),
    tile("ruler", "Superficie", item.surfaceLabel ?? "—"),
    tile("road", "Accès", item.roadAccess ?? "—"),
    tile("sofa", "Meublé", item.furnished == null ? "—" : item.furnished ? "Oui" : "Non"),
    tile("file", "Document", item.declaredDocument ?? "Non précisé"),
  ];
  const desc = h("p", { class: "ld-desc clamp" }, item.description);
  const more = (item.description ?? "").length > 180 ? h("button", { class: "ld-link", type: "button", onClick: () => { const open = desc.classList.toggle("clamp"); more.textContent = open ? "lire la suite" : "réduire"; } }, "lire la suite") : null;

  const geoBox = h("div", { class: "stack" }, h("p", { class: "muted small" }, "Chargement de la localisation…"));
  let geoLoaded = false;
  const loadGeo = () => { if (geoLoaded) return; geoLoaded = true; showGeo(id, geoBox, item).catch(() => mount(geoBox, geoFallback(item))); };
  const galleryGrid = h("div", { class: "ld-gallery" }, all.map((url, i) => h("button", { class: "ld-gimg", type: "button", "aria-label": `Agrandir la photo ${i + 1}`,
    onClick: () => openFullscreen(all, i, (k) => { photo = k; main.src = all[k]; drawThumbs(); }) }, h("img", { src: url, alt: "", loading: "lazy" }))));

  const panels = {
    details: h("section", { class: "ld-panel", id: "ld-p-details", role: "tabpanel", "aria-labelledby": "ld-t-details" },
      h("h2", null, "Détails"), desc, more,
      h("h2", null, "Caractéristiques"), h("div", { class: "ld-tiles" }, tiles),
      h("p", { class: "notice" }, documentDisclaimer(), " Document déclaré : ", h("strong", null, item.declaredDocument ?? "non précisé"), "."),
      h("div", { class: "row wrap gap-sm" },
        h("span", { class: "pill pill-dark" }, item.transactionType),
        item.featured ? h("span", { class: "pill pill-gold" }, "À la une") : null,
        item.documentVerified ? h("span", { class: "pill pill-green" }, "Titre foncier contrôlé par l'équipe") : null,
        item.agencyVerified ? h("span", { class: "pill pill-green" }, `Agence vérifiée${item.agencyName ? ` : ${item.agencyName}` : ""}`) : null,
        item.phoneVerified ? h("span", { class: "pill pill-green" }, "Numéro vérifié par SMS") : h("span", { class: "pill" }, "Numéro non vérifié par SMS")),
      item.ownerId ? ownerSummary : h("p", null, h("strong", null, item.ownerName), ` · ${item.ownerRole}`),
      priceHistoryBlock(item),
      h("div", { class: "contact-bar" },
        h("button", { class: "btn btn-dark", type: "button", onClick: () => contact("CALL") }, "Appeler"),
        h("button", { class: "btn btn-primary", type: "button", onClick: () => contact("WHATSAPP") }, "WhatsApp"),
        h("button", { class: "btn", type: "button", onClick: () => dialog.showModal() }, "Signaler")),
      S.user ? null : h("p", { class: "small muted" }, "Connectez-vous pour afficher le numéro : chaque contact est compté."),
      h("section", { class: "stack" }, h("h2", null, "Réactions et commentaires"), socialBar("LISTING", id, { openComments: true }))),
    location: h("section", { class: "ld-panel", id: "ld-p-location", role: "tabpanel", "aria-labelledby": "ld-t-location", hidden: true }, h("h2", null, "Localisation"), geoBox),
    gallery: h("section", { class: "ld-panel", id: "ld-p-gallery", role: "tabpanel", "aria-labelledby": "ld-t-gallery", hidden: true }, h("h2", null, `Galerie (${all.length})`), galleryGrid),
  };
  const tabDefs = [["details", "Détails"], ["location", "Localisation"], ["gallery", "Galerie"]];
  const tabBtns = tabDefs.map(([key, label]) => h("button", { class: "ld-tab", id: `ld-t-${key}`, type: "button", role: "tab", "aria-controls": `ld-p-${key}`, "aria-selected": String(key === "details"), onClick: () => showTab(key) }, label));
  function showTab(key) {
    tabDefs.forEach(([k], i) => { tabBtns[i].setAttribute("aria-selected", String(k === key)); panels[k].hidden = k !== key; });
    if (key === "location") loadGeo();
  }

  document.body.classList.add("in-listing"); // barre de prix fixe : la barre de navigation mobile est masquée sur cette page
  mount(app,
    h("article", { class: "ld" },
      h("header", { class: "ld-top" },
        h("span", { "aria-hidden": "true" }), // pas de bouton de retour à l'écran (décision du 16/11) : retour du téléphone / navigateur
        h("p", { class: "ld-top-title" }, "Détails du bien"),
        h("button", { class: "ld-round", type: "button", "aria-label": "Partager", onClick: share }, icon("share"))),
      h("div", { class: `ld-mosaic${all.length > 1 ? "" : " single"}` }, h("div", { class: "ld-main" }, main, dots), thumbs, bookmark),
      h("div", { class: "ld-head" },
        h("div", null,
          h("h1", { class: "ld-title" }, item.title),
          h("p", { class: "ld-loc" }, icon("pin"), `${item.neighborhood}, ${item.city}`),
          quick.length ? h("p", { class: "ld-quick" }, quick) : null),
        h("button", { class: "ld-round", type: "button", "aria-label": "Écrire à l'annonceur", onClick: () => { if (!needLogin()) msgDialog.showModal(); } }, icon("message"))),
      h("div", { class: "ld-tabs", role: "tablist", "aria-label": "Sections de l'annonce" }, tabBtns),
      panels.details, panels.location, panels.gallery,
      similar.length ? h("section", { class: "stack ld-similar" }, h("h2", null, "Annonces similaires"),
        h("div", { class: "listing-grid" }, similar.map((i) => h("article", { class: "card pad" },
          h("p", { class: "small muted" }, `${i.neighborhood} · ${i.surfaceLabel}`), h("h3", null, h("a", { href: `#/annonce/${encodeURIComponent(i.id)}` }, i.title)), h("p", { class: "price" }, formatPrice(i.price, i.transactionType)))))) : null,
      h("div", { class: "ld-bar" },
        h("div", null, h("small", null, "Prix"), h("p", { class: "ld-price" }, `${new Intl.NumberFormat("fr-FR").format(item.price)} FCFA`, item.transactionType === "Location" ? h("span", null, "/mois") : null),
          item.pricePerM2 ? h("small", null, `${new Intl.NumberFormat("fr-FR").format(item.pricePerM2)} FCFA / m²`) : null),
        h("button", { class: "ld-cta", type: "button", onClick: () => { if (!needLogin()) visitDialog.showModal(); } }, "Programmer une visite"))),
    dialog, msgDialog, visitDialog);
}

/** Position exacte et parcelle : le serveur ne répond que si l'annonceur l'a choisi ET que l'annonce est publiée. */
async function showGeo(id, box, item) {
  const { geo } = await api(`/listings/${encodeURIComponent(id)}/geo`);
  if (!geo) { mount(box, geoFallback(item)); return; }
  const [{ createMap }, g] = await Promise.all([import("/js/map/provider.js"), import("/js/map/geometry.js")]);
  const mapBox = h("div", { class: "geo-box" });
  mount(box, mapBox,
    h("p", { class: "small" }, geo.areaM2 ? `Parcelle délimitée : ${g.fmtM2(geo.areaM2)} (${g.fmtHa(geo.areaM2)}), périmètre ${Math.round(geo.perimeterM)} m. ` : `Position : ${geo.point.lat.toFixed(5)}, ${geo.point.lng.toFixed(5)}. `),
    h("p", { class: "notice" }, "Mesure indicative, déclarée par l'annonceur à partir de points placés sur un plan. Ce n'est pas un bornage et elle ne remplace pas le titre foncier."));
  const map = await createMap(mapBox, { center: geo.point, mode: "view" });
  map.setShape({ point: geo.polygon ? null : geo.point, vertices: geo.polygon ? g.fromPolygon(geo.polygon) : [] });
}


/** Position exacte non publiée : on affiche seulement le quartier déclaré. */
function geoFallback(item) {
  return h("div", { class: "ld-nogeo" }, icon("pin"),
    h("div", null, h("strong", null, `${item.neighborhood}, ${item.city}`),
      h("p", { class: "small muted" }, "L'annonceur n'a pas rendu publique la position exacte du bien. Demandez une visite pour la connaître."),
      item.roadAccess ? h("p", { class: "small" }, `Accès : ${item.roadAccess}`) : null));
}

/** Historique du prix : visible seulement si le prix a changé depuis la première publication. */
function priceHistoryBlock(item) {
  const points = item.priceHistory ?? [];
  if (points.length < 2) return null;
  const date = (iso) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const latest = points[0];
  const first = points[points.length - 1];
  const total = latest.price - first.price;
  const percent = Math.round((total / first.price) * 1000) / 10;
  const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.abs(n));
  const summary = total === 0 ? "Prix identique au prix d'origine." : `${total < 0 ? "Baisse" : "Hausse"} de ${fmt(total)} FCFA (${String(Math.abs(percent)).replace(".", ",")} %) depuis le ${date(first.at)}.`;
  return h("section", { class: "stack" },
    h("h2", null, "Historique du prix"),
    h("p", { class: "small" }, summary),
    h("ul", { class: "stack" }, points.map((p) => h("li", { class: "small" },
      h("strong", null, formatPrice(p.price, item.transactionType)), ` · ${date(p.at)}`,
      p.change ? h("span", { class: "muted" }, ` · ${p.change < 0 ? "−" : "+"}${fmt(p.change)} FCFA`) : h("span", { class: "muted" }, " · prix d'origine")))));
}
