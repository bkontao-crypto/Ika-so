// Onglet « Découvrir » (#/decouvrir) : actualités, informations et demandes de la communauté, séparées des annonces professionnelles.
import { CATEGORIES, api, fail, h, mount, toast } from "/js/dom.js";
import { app } from "/js/core/state.js";
import { needLogin } from "/js/core/router.js";
import { icon } from "/js/icons.js";
import { ago, avatar } from "/js/components/espace.js";
import { KIND_LABELS, loadDiscoverCss, photoGrid, postComposer, sharedCard, videoCard } from "/js/components/post-composer.js";
import { socialBar } from "/js/components/social.js";

const REASONS = ["Annonce déguisée ou publicité", "Arnaque ou demande d'argent", "Contenu choquant ou insultant", "Numéro de téléphone ou contact direct", "Autre"];

/** Fenêtre « Écrire à l'auteur » : ouvre une conversation dans la messagerie. */
function contactDialog(item) {
  const msg = h("textarea", { class: "input", rows: "4", maxlength: "1000", "aria-label": "Votre message", placeholder: item.kind === "RECHERCHE" ? "Bonjour, j'ai un bien qui pourrait vous convenir…" : "Bonjour, je suis intéressé(e) par votre publication…" });
  const dialog = h("dialog", { "aria-labelledby": "dc-msg-title" }, h("form", { class: "pad stack", method: "dialog" },
    h("h2", { id: "dc-msg-title" }, `Écrire à ${item.author.name}`), msg,
    h("p", { class: "small muted" }, "Échangez par la messagerie du site. Ne versez jamais d'argent avant d'avoir vu le bien et contrôlé les documents."),
    h("div", { class: "row" }, h("button", { class: "btn btn-quiet", value: "cancel" }, "Annuler"),
      h("button", { class: "btn btn-primary", type: "button", onClick: async () => {
        try { const r = await api(`/discover/${encodeURIComponent(item.id)}/contact`, { method: "POST", body: { body: msg.value } }); dialog.close(); toast("Message envoyé."); location.hash = `#/boite/${r.threadId}`; } catch (error) { fail(error); }
      } }, "Envoyer"))));
  return dialog;
}

function reportDialog(item) {
  const sel = h("select", { class: "input", "aria-label": "Motif" }, REASONS.map((r) => h("option", { value: r }, r)));
  const dialog = h("dialog", { "aria-labelledby": "dc-rep-title" }, h("form", { class: "pad stack", method: "dialog" },
    h("h2", { id: "dc-rep-title" }, "Signaler cette publication"), sel,
    h("p", { class: "small muted" }, "L'équipe examine les signalements et peut masquer la publication."),
    h("div", { class: "row" }, h("button", { class: "btn btn-quiet", value: "cancel" }, "Annuler"),
      h("button", { class: "btn btn-primary", type: "button", onClick: async () => {
        try { await api(`/discover/${encodeURIComponent(item.id)}/report`, { method: "POST", body: { reason: sel.value } }); dialog.close(); toast("Merci, le signalement est transmis à l'équipe."); } catch (error) { fail(error); }
      } }, "Signaler"))));
  return dialog;
}

function card(item, onChange, highlight = false) {
  const dialogs = [];
  const open = (make) => { if (needLogin()) return; const d = make(item); dialogs.push(d); article.append(d); d.addEventListener("close", () => d.remove()); d.showModal(); };
  const name = item.author.advertiser ? h("a", { href: `#/annonceur/${encodeURIComponent(item.author.id)}` }, h("strong", null, item.author.name)) : h("strong", null, item.author.name);
  const meta = [ago(item.createdAt), item.category, item.zone].filter(Boolean).join(" · ");
  const article = h("article", { class: `card pad stack dc-post kind-${item.kind.toLowerCase()}` },
    h("header", { class: "dc-head" }, avatar(item.author.name, item.author.avatarUrl),
      h("div", { class: "dc-who" }, h("div", { class: "row" }, name, h("span", { class: "pill" }, item.kindLabel), item.author.advertiser ? h("span", { class: "pill pill-green" }, "Annonceur") : null), h("small", { class: "muted" }, meta))),
    h("p", { class: "dc-text" }, item.content), sharedCard(item.shared), photoGrid(item.photos, { id: item.id, title: item.author.name }), videoCard(item.video),
    socialBar("PUBLICATION", item.id, { openComments: highlight }),
    h("footer", { class: "row dc-actions" },
      item.mine
        ? h("button", { class: "btn btn-quiet", type: "button", onClick: async () => { if (!window.confirm("Supprimer cette publication ?")) return; try { await api(`/me/publications/${encodeURIComponent(item.id)}/delete`, { method: "POST", body: {} }); toast("Publication supprimée."); onChange(); } catch (error) { fail(error); } } }, icon("trash"), "Supprimer")
        : [h("button", { class: "btn btn-primary", type: "button", onClick: () => open(contactDialog) }, icon("message"), "Écrire"),
          h("button", { class: "btn btn-quiet", type: "button", onClick: () => open(reportDialog) }, icon("flag"), "Signaler")]));
  return article;
}

export async function decouvrirPage() {
  loadDiscoverCss();
  let kind = ""; let category = ""; let before = null; let loading = false;
  const linked = new URLSearchParams((location.hash.split("?")[1] ?? "")).get("p"); // lien partagé #/decouvrir?p=…
  const list = h("div", { class: "stack", "aria-live": "polite" });
  const more = h("button", { class: "btn", type: "button", hidden: true, onClick: () => load(false) }, "Voir plus de publications");
  const chips = h("div", { class: "row", role: "group", "aria-label": "Filtrer les publications" });
  const cat = h("select", { class: "input dc-cat", "aria-label": "Type de bien", onChange: (e) => { category = e.target.value; load(true); } },
    h("option", { value: "" }, "Tous les biens"), CATEGORIES.map((c) => h("option", { value: c }, c)));
  const drawChips = () => chips.replaceChildren(...[["", "Tout"], ...Object.entries(KIND_LABELS)].map(([k, label]) => h("button", { class: "chip", type: "button", "aria-pressed": String(kind === k), onClick: () => { kind = k; drawChips(); load(true); } }, label)));

  async function load(reset) {
    if (loading) return; loading = true;
    if (reset) { before = null; list.replaceChildren(h("div", { class: "skeleton" })); }
    try {
      const qs = new URLSearchParams({ ...(kind ? { kind } : {}), ...(category ? { category } : {}), ...(!reset && before ? { before } : {}) });
      const r = await api(`/discover?${qs}`);
      if (reset) list.replaceChildren();
      if (reset && linked) { try { list.append(card(await api(`/discover/${encodeURIComponent(linked)}`), () => load(true), true)); } catch { /* publication supprimée : on affiche le fil */ } }
      list.append(...r.items.filter((it) => it.id !== linked || !reset).map((it) => card(it, () => load(true))));
      if (reset && !r.items.length) list.append(h("div", { class: "card pad muted dc-empty" }, r.settings?.enabled === false ? "Découvrir est fermé pour le moment." : "Aucune publication pour le moment. Soyez la première personne à publier !"));
      before = r.next; more.hidden = !r.next;
    } catch (error) { fail(error); } finally { loading = false; }
  }

  mount(app,
    h("div", null, h("p", { class: "rx-kicker" }, "Communauté"), h("h1", { class: "title" }, "Découvrir")),
    h("p", { class: "muted" }, "Actualités, informations et demandes de la communauté : vœux de maison ou de terrain, conseils, nouvelles. Ce ne sont pas des annonces professionnelles : écrivez à l'auteur pour en discuter."),
    postComposer({ onPosted: () => load(true) }),
    h("section", { class: "card pad stack" }, chips, cat),
    list, h("div", { class: "row" }, more));
  drawChips();
  await load(true);
}
