import { DOCUMENT_DISCLAIMER, REPORT_REASONS, api, fail, formatPrice, h, mount, toast } from "/js/dom.js";
import { S, app } from "/js/core/state.js";
import { needLogin } from "/js/core/router.js";
import { field, select } from "/js/components/ui.js";

export async function listingPage(id) {
  const [item, comments, similar] = await Promise.all([api(`/listings/${encodeURIComponent(id)}`), api(`/listings/${encodeURIComponent(id)}/comments`), api(`/listings/${encodeURIComponent(id)}/similar`).catch(() => [])]);
  const ownerSummary = h("span", { class: "small muted" });
  if (item.ownerId) api(`/advertisers/${encodeURIComponent(item.ownerId)}`).then((p) => {
    mount(ownerSummary, p.rating.count ? `Note ${String(p.rating.average).replace(".", ",")}/5 (${p.rating.count} avis) · ${p.trust.label}` : p.trust.label);
  }).catch(() => undefined);
  let photo = 0;
  const main = h("img", { src: item.photos[0] ?? item.imageUrl, alt: item.title });
  const thumbs = h("div", { class: "thumbs" });
  const drawThumbs = () => mount(thumbs, item.photos.length > 1
    ? item.photos.map((url, i) => h("button", { class: "thumb", type: "button", "aria-label": `Photo ${i + 1}`, "aria-current": String(i === photo), onClick: () => { photo = i; main.src = url; drawThumbs(); } }, h("img", { src: url, alt: "" })))
    : null);
  drawThumbs();

  async function contact(kind) {
    if (needLogin()) return;
    try {
      const { phone } = await api(`/listings/${encodeURIComponent(id)}/contact`, { method: "POST", body: { kind } });
      const clean = phone.replace(/\s/g, "");
      if (kind === "CALL") location.href = `tel:${clean}`;
      else {
        const text = encodeURIComponent(`Bonjour, je vous contacte depuis Ika So au sujet de « ${item.title} ». Est-elle toujours disponible ?`);
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
    h("h2", { id: "msg-title" }, "Écrire à l'annonceur"), msg,
    h("p", { class: "small muted" }, "Ne versez aucun acompte avant la visite et le contrôle du document."),
    h("div", { class: "row" }, h("button", { class: "btn btn-quiet", value: "cancel" }, "Annuler"),
      h("button", { class: "btn btn-primary", type: "button", onClick: async () => {
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

  const fact = (label, value) => h("div", { class: "fact" }, h("span", null, label), h("strong", null, value));
  const geoBox = h("div", { class: "stack", hidden: true });
  mount(app,
    h("a", { href: "#/", class: "btn btn-quiet btn-small" }, "Retour au catalogue"),
    h("article", { class: "card" },
      h("div", { class: "gallery-main" }, main), thumbs,
      h("div", { class: "pad stack" },
        h("div", { class: "row-between" },
          h("div", null, h("p", { class: "small muted" }, `${item.neighborhood}, ${item.city}`), h("h1", { class: "title" }, item.title)),
          h("div", null, h("p", { class: "price" }, formatPrice(item.price, item.transactionType)),
            item.pricePerM2 ? h("p", { class: "small muted" }, `${new Intl.NumberFormat("fr-FR").format(item.pricePerM2)} FCFA / m²`) : null)),
        h("div", { class: "row" },
          h("span", { class: "pill pill-dark" }, item.transactionType),
          item.featured ? h("span", { class: "pill pill-gold" }, "À la une") : null,
          item.documentVerified ? h("span", { class: "pill pill-green" }, "Titre foncier contrôlé par l'équipe") : null,
          item.agencyVerified ? h("span", { class: "pill pill-green" }, `Agence vérifiée${item.agencyName ? ` : ${item.agencyName}` : ""}`) : null,
          item.phoneVerified ? h("span", { class: "pill pill-green" }, "Numéro vérifié par SMS") : h("span", { class: "pill" }, "Numéro non vérifié par SMS")),
        h("p", null, h("strong", null, item.ownerName), ` · ${item.ownerRole}`),
        item.ownerId ? h("div", { class: "row" }, h("a", { class: "btn btn-small", href: `#/annonceur/${encodeURIComponent(item.ownerId)}` }, "Voir le profil de l'annonceur"), ownerSummary) : null,
        h("p", { class: "notice" }, DOCUMENT_DISCLAIMER, " Document déclaré : ", h("strong", null, item.declaredDocument ?? "non précisé"), "."),
        h("div", { class: "grid facts" },
          fact("Superficie", item.surfaceLabel), fact("Accès", item.roadAccess ?? "—"),
          fact(item.bedrooms == null ? "Type de bien" : "Chambres", item.bedrooms == null ? item.category : String(item.bedrooms)),
          fact("Meublé", item.furnished == null ? "—" : item.furnished ? "Oui" : "Non")),
        h("p", null, item.description),
        priceHistoryBlock(item),
        geoBox,
        h("div", { class: "contact-bar" },
          h("button", { class: "btn btn-dark", type: "button", onClick: () => contact("CALL") }, "Appeler"),
          h("button", { class: "btn btn-primary", type: "button", onClick: () => contact("WHATSAPP") }, "WhatsApp"),
          h("button", { class: "btn", type: "button", onClick: () => { if (!needLogin()) msgDialog.showModal(); } }, "Écrire"),
          h("button", { class: "btn", type: "button", onClick: () => { if (!needLogin()) visitDialog.showModal(); } }, "Demander une visite"),
          h("button", { class: "btn", type: "button", onClick: share }, "Partager"),
          h("button", { class: "btn", type: "button", onClick: () => dialog.showModal() }, "Signaler")),
        S.user ? null : h("p", { class: "small muted" }, "Connectez-vous pour afficher le numéro : chaque contact est compté."),
        h("section", { class: "stack" },
          h("h2", null, "Commentaires"),
          h("div", { class: "row" }, body,
            h("button", { class: "btn btn-primary", type: "button", onClick: async () => {
              if (needLogin()) return;
              try {
                await api(`/listings/${encodeURIComponent(id)}/comments`, { method: "POST", body: { body: body.value } });
                body.value = "";
                drawComments(await api(`/listings/${encodeURIComponent(id)}/comments`));
                toast("Commentaire publié.");
              } catch (error) { fail(error); }
            } }, "Envoyer")),
          commentList))),
    similar.length ? h("section", { class: "stack" }, h("h2", null, "Annonces similaires"),
      h("div", { class: "listing-grid" }, similar.map((i) => h("article", { class: "card pad" },
        h("p", { class: "small muted" }, `${i.neighborhood} · ${i.surfaceLabel}`), h("h3", null, h("a", { href: `#/annonce/${encodeURIComponent(i.id)}` }, i.title)), h("p", { class: "price" }, formatPrice(i.price, i.transactionType)))))) : null,
    dialog, msgDialog, visitDialog);
  showGeo(id, geoBox).catch(() => undefined); // facultatif : n'apparaît que si l'annonceur a rendu la position publique
}

/** Position exacte et parcelle : le serveur ne répond que si l'annonceur l'a choisi ET que l'annonce est publiée. */
async function showGeo(id, box) {
  const { geo } = await api(`/listings/${encodeURIComponent(id)}/geo`);
  if (!geo) return;
  const [{ createMap }, g] = await Promise.all([import("/js/map/provider.js"), import("/js/map/geometry.js")]);
  const mapBox = h("div", { class: "geo-box" });
  box.hidden = false;
  mount(box, h("h2", null, "Localisation"), mapBox,
    h("p", { class: "small" }, geo.areaM2 ? `Parcelle délimitée : ${g.fmtM2(geo.areaM2)} (${g.fmtHa(geo.areaM2)}), périmètre ${Math.round(geo.perimeterM)} m. ` : `Position : ${geo.point.lat.toFixed(5)}, ${geo.point.lng.toFixed(5)}. `),
    h("p", { class: "notice" }, "Mesure indicative, déclarée par l'annonceur à partir de points placés sur un plan. Ce n'est pas un bornage et elle ne remplace pas le titre foncier."));
  const map = await createMap(mapBox, { center: geo.point, mode: "view" });
  map.setShape({ point: geo.polygon ? null : geo.point, vertices: geo.polygon ? g.fromPolygon(geo.polygon) : [] });
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
