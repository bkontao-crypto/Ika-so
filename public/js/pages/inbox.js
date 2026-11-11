import { api, fail, formatDate, h, mount, toast } from "/js/dom.js";
import { S, app, refreshUnread } from "/js/core/state.js";
import { currentRoute, needLogin } from "/js/core/router.js";
import { field, select } from "/js/components/ui.js";
import { avatar, clock, dayLabel, listTime, ticks } from "/js/components/chat.js";
import { icon } from "/js/icons.js";

const KIND = { SEARCH_MATCH: "Alerte", SEARCH_DIGEST: "Résumé", MESSAGE: "Message", VISIT_REQUEST: "Visite", VISIT_ANSWER: "Visite", LISTING_APPROVED: "Annonce", LISTING_REJECTED: "Annonce", ADVERTISER_APPLICATION: "Demande annonceur", TEAM_REQUEST: "Équipe" };
const FILTER = { transaction: "Transaction", category: "Type", zone: "Quartier", maxPrice: "Prix max", minPrice: "Prix min", minSurface: "Surface min (m²)", bedrooms: "Chambres min.", q: "Mots" };
const USER_REPORT_REASONS = ["Harcèlement ou insultes", "Arnaque ou demande d'acompte", "Spam ou publicité", "Autre"];
const VISIT = { PENDING: "En attente", ACCEPTED: "Acceptée", DECLINED: "Refusée", CANCELLED: "Annulée" };

export async function inboxPage() {
  if (needLogin()) return;
  document.body.classList.remove("in-chat");
  let tab = currentRoute().params.get("onglet") || "alertes";
  let msgFilter = "all"; let msgQuery = "";
  const [notes, searches, threads, visits, prefs] = await Promise.all([api("/me/notifications"), api("/me/searches"), api("/me/threads"), api("/me/visits"), api("/me/alert-prefs").catch(() => ({ mode: "INSTANT" }))]);
  const unread = (list) => list.filter((x) => (x.read === false) || x.unread).length;

  const reload = async () => { await refreshUnread(); inboxPage(); };
  const panels = {
    alertes: () => [
      h("div", { class: "row-between" }, h("h2", null, "Alertes"),
        notes.some((n) => !n.read) ? h("button", { class: "btn btn-small", type: "button", onClick: async () => { await api("/me/notifications/read", { method: "POST", body: {} }); reload(); } }, "Tout marquer lu") : null),
      notes.length ? h("ul", { class: "stack" }, notes.map((n) => h("li", { class: `card pad ${n.read ? "" : "is-unread"}` },
        h("span", { class: "pill" }, KIND[n.kind] ?? "Info"), " ", h("a", { href: n.link || "#/boite", onClick: () => api("/me/notifications/read", { method: "POST", body: { id: n.id } }).then(refreshUnread).catch(() => undefined) }, h("strong", null, n.title)),
        n.body ? h("p", { class: "small muted" }, n.body) : null, h("p", { class: "small muted" }, formatDate(n.createdAt)))))
        : h("p", { class: "card pad muted" }, "Aucune alerte pour le moment."),
      h("h2", null, "Mes recherches enregistrées"),
      h("p", { class: "small muted" }, "Depuis l'accueil, utilisez « Enregistrer cette recherche »."),
      h("label", { class: "field" }, h("span", null, "Fréquence des alertes"),
        h("select", { class: "input", onChange: async (e) => { try { await api("/me/alert-prefs", { method: "PUT", body: { mode: e.target.value } }); toast(e.target.value === "DAILY" ? "Vous recevrez un résumé par jour." : "Vous serez prévenu dès la publication."); reload(); } catch (error) { fail(error); } } },
          h("option", { value: "INSTANT", selected: prefs.mode !== "DAILY" }, "Dès qu'une annonce correspond"),
          h("option", { value: "DAILY", selected: prefs.mode === "DAILY" }, "Un résumé par jour"))),
      searches.length ? h("ul", { class: "stack" }, searches.map((s) => h("li", { class: "card pad row-between" },
        h("span", null, h("strong", null, s.label), h("br"), h("span", { class: "small muted" }, Object.entries(s.filters).map(([k, v]) => `${FILTER[k] ?? k} : ${v}`).join(" · "))),
        h("button", { class: "btn btn-small", type: "button", "aria-label": `Supprimer la recherche ${s.label}`, onClick: async () => { await api(`/me/searches/${encodeURIComponent(s.id)}/delete`, { method: "POST", body: {} }); reload(); } }, "Supprimer"))))
        : h("p", { class: "card pad muted" }, "Aucune recherche enregistrée."),
    ],
    messages: () => {
      const unreadTotal = threads.filter((t) => t.unread).length;
      const chips = [["all", "Toutes"], ["unread", `Non lues${unreadTotal ? ` ${unreadTotal}` : ""}`], ["owner", "Mes annonces"], ["visitor", "Mes demandes"], ["blocked", "Bloquées"]];
      const list = h("ul", { class: "chat-list", "aria-live": "polite" });
      const match = (t) => {
        const q = msgQuery.trim().toLowerCase();
        if (q && !`${t.otherName ?? ""} ${t.title ?? ""} ${t.lastBody ?? ""}`.toLowerCase().includes(q)) return false;
        return { all: true, unread: t.unread, owner: t.asOwner, visitor: !t.asOwner, blocked: t.blockedByMe }[msgFilter];
      };
      const row = (t) => h("li", null, h("a", { class: `chat-row ${t.unread ? "unread" : ""}`, href: `#/boite/${encodeURIComponent(t.id)}`, "aria-label": `${t.otherName ?? "Conversation"}, ${t.title}${t.unreadCount ? `, ${t.unreadCount} message${t.unreadCount > 1 ? "s" : ""} non lu${t.unreadCount > 1 ? "s" : ""}` : ""}` },
        avatar(t.otherName),
        h("span", { class: "chat-main" },
          h("span", { class: "chat-line" }, h("strong", { class: "chat-name" }, t.otherName || "Utilisateur"), h("time", { class: "chat-time", datetime: t.lastMessageAt }, listTime(t.lastMessageAt))),
          h("span", { class: "chat-line" },
            h("span", { class: "chat-preview" }, t.lastMine ? ticks(t.lastRead) : null, t.blockedByMe ? "Personne bloquée" : (t.lastBody ?? "")),
            t.unreadCount ? h("span", { class: "chat-badge" }, h("span", { class: "sr-only" }, "Non lus : "), String(t.unreadCount)) : null),
          h("span", { class: "chat-listing" }, `${t.asOwner ? "Intéressé par" : "Annonce :"} ${t.title}`))));
      const drawList = () => {
        const rows = threads.filter(match);
        mount(list, rows.length ? rows.map(row) : h("li", { class: "card pad muted" }, threads.length ? "Aucune conversation ne correspond." : "Aucun message. Écrivez à un annonceur depuis une fiche d'annonce."));
      };
      const chipBar = h("div", { class: "chat-chips", role: "group", "aria-label": "Filtrer les discussions" });
      const drawChips = () => mount(chipBar, chips.map(([key, label]) => h("button", { type: "button", class: "chip", "aria-pressed": String(msgFilter === key), onClick: () => { msgFilter = key; drawChips(); drawList(); } }, label)));
      drawChips(); drawList();
      return [h("div", { class: "chat-search" }, icon("search"), h("input", { class: "input", type: "search", "aria-label": "Rechercher dans les discussions", placeholder: "Rechercher une personne, une annonce ou un message", value: msgQuery, onInput: (e) => { msgQuery = e.target.value; drawList(); } })), chipBar, list];
    },
    visites: () => [
      h("h2", null, "Visites"),
      visits.length ? h("ul", { class: "stack" }, visits.map((v) => h("li", { class: "card pad stack" },
        h("div", { class: "row-between" }, h("strong", null, v.title), h("span", { class: "pill pill-gold" }, VISIT[v.status])),
        h("p", { class: "small" }, `${v.asOwner ? "Demandée par" : "Annonceur :"} ${v.otherName ?? ""} · le ${formatDate(v.proposedAt)}`),
        v.note ? h("p", { class: "small muted" }, `« ${v.note} »`) : null,
        v.answerNote ? h("p", { class: "small" }, `Réponse : ${v.answerNote}`) : null,
        v.status === "PENDING" && v.asOwner ? h("div", { class: "row" },
          h("button", { class: "btn btn-small btn-primary", type: "button", onClick: () => answer(v, true) }, "Accepter"),
          h("button", { class: "btn btn-small", type: "button", onClick: () => answer(v, false) }, "Refuser")) : null,
        v.status === "PENDING" && !v.asOwner ? h("button", { class: "btn btn-small", type: "button", onClick: async () => { await api(`/me/visits/${encodeURIComponent(v.id)}/cancel`, { method: "POST", body: {} }); reload(); } }, "Annuler la demande") : null)))
        : h("p", { class: "card pad muted" }, "Aucune visite. Demandez-en une depuis une fiche d'annonce."),
    ],
  };
  async function answer(v, accept) {
    const note = accept ? (window.prompt("Message pour le visiteur (facultatif) :") ?? "") : window.prompt("Motif du refus, ou autre date proposée (obligatoire) :");
    if (note === null || (!accept && note.trim().length < 3)) return;
    try { await api(`/me/visits/${encodeURIComponent(v.id)}/answer`, { method: "POST", body: { accept, note } }); toast(accept ? "Visite acceptée." : "Réponse envoyée."); reload(); } catch (error) { fail(error); }
  }
  const tabs = [["alertes", `Alertes${unread(notes) ? ` (${unread(notes)})` : ""}`], ["messages", `Messages${unread(threads) ? ` (${unread(threads)})` : ""}`], ["visites", `Visites${visits.filter((v) => v.asOwner && v.status === "PENDING").length ? ` (${visits.filter((v) => v.asOwner && v.status === "PENDING").length})` : ""}`]];
  const draw = () => mount(app, h("h1", { class: "title" }, "Boîte"),
    h("div", { class: "tabs", role: "tablist" }, tabs.map(([key, label]) => h("button", { type: "button", role: "tab", "aria-selected": String(tab === key), onClick: () => { tab = key; draw(); } }, label))),
    h("div", { class: "stack", id: "inbox-body" }, panels[tab]()));
  draw();
}

export async function threadPage(id) {
  if (needLogin()) return;
  const t = await api(`/me/threads/${encodeURIComponent(id)}`);
  refreshUnread();
  document.body.classList.add("in-chat");
  const hash = `#/boite/${encodeURIComponent(id)}`;
  const body = h("textarea", { class: "input", rows: "1", maxlength: "1000", "aria-label": "Votre message", placeholder: "Votre message" });
  const grow = () => { body.style.height = "auto"; body.style.height = `${Math.min(body.scrollHeight, 140)}px`; };
  const list = h("ul", { class: "chat-body", "aria-live": "polite", "aria-label": "Messages" });
  let count = -1; let timer = null;
  const stop = () => { if (timer) clearInterval(timer); timer = null; };
  function drawMessages(messages, stick) {
    let last = "";
    const items = [];
    for (const m of messages) {
      const day = dayLabel(m.createdAt);
      if (day !== last) { items.push(h("li", { class: "chat-day" }, h("span", null, day))); last = day; }
      items.push(h("li", { class: `bubble-row ${m.mine ? "mine" : ""}` }, h("div", { class: `bubble ${m.mine ? "bubble-mine" : "bubble-their"}` },
        h("p", null, m.body), h("span", { class: "bubble-meta" }, h("time", { datetime: m.createdAt }, clock(m.createdAt)), m.mine ? ticks(m.read) : null))));
    }
    mount(list, items.length ? items : h("li", { class: "chat-day" }, h("span", null, "Aucun message")));
    if (stick) list.scrollTop = list.scrollHeight;
  }
  async function refresh() {
    if (location.hash !== hash) return stop(); // on a quitté la conversation
    try {
      const fresh = await api(`/me/threads/${encodeURIComponent(id)}`);
      const changed = fresh.messages.length !== count || fresh.messages.some((m, i) => m.read !== t.messages[i]?.read);
      if (changed) { const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80; t.messages = fresh.messages; count = fresh.messages.length; drawMessages(fresh.messages, atBottom); refreshUnread(); }
    } catch { /* hors connexion : on réessaie au prochain passage */ }
  }
  const send = async () => {
    const text = body.value.trim();
    if (text.length < 2) return;
    try {
      await api(`/me/threads/${encodeURIComponent(id)}/messages`, { method: "POST", body: { body: text } });
      body.value = ""; grow();
      const fresh = await api(`/me/threads/${encodeURIComponent(id)}`);
      t.messages = fresh.messages; count = fresh.messages.length; drawMessages(fresh.messages, true);
    } catch (error) { fail(error); }
  };
  body.addEventListener("input", grow);
  // Ordinateur : Entrée envoie, Maj+Entrée saute une ligne. Téléphone : Entrée saute une ligne (comme WhatsApp).
  body.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) { e.preventDefault(); send(); } });
  const setBlock = async (on) => {
    if (on && !window.confirm("Bloquer cette personne ? Elle ne pourra plus vous écrire ni demander de visite. Vous pouvez la débloquer à tout moment.")) return;
    try { stop(); await api(`/me/threads/${encodeURIComponent(id)}/${on ? "block" : "unblock"}`, { method: "POST", body: {} }); toast(on ? "Personne bloquée." : "Personne débloquée."); threadPage(id); } catch (error) { fail(error); }
  };
  let reason = USER_REPORT_REASONS[0];
  const details = h("textarea", { class: "input", rows: "3", maxlength: "1000", "aria-label": "Précisions facultatives", placeholder: "Précisions facultatives" });
  const dialog = h("dialog", { "aria-labelledby": "ureport-title" }, h("form", { class: "pad stack", method: "dialog" },
    h("h2", { id: "ureport-title" }, "Signaler cette personne"),
    field("Motif", select(USER_REPORT_REASONS, reason, (v) => { reason = v; })), details,
    h("p", { class: "small muted" }, "La modération ne reçoit que les 10 derniers messages de cette conversation, pas le reste."),
    h("div", { class: "row" }, h("button", { class: "btn btn-quiet", value: "cancel" }, "Annuler"),
      h("button", { class: "btn btn-primary", type: "button", onClick: async () => {
        try { await api(`/me/threads/${encodeURIComponent(id)}/report`, { method: "POST", body: { reason, details: details.value } }); dialog.close(); toast("Signalement transmis à la modération."); } catch (error) { fail(error); }
      } }, "Envoyer"))));
  mount(app,
    h("section", { class: "chat" },
      h("header", { class: "chat-head" },
        h("a", { href: "#/boite?onglet=messages", class: "btn btn-quiet btn-small", "aria-label": "Retour aux discussions" }, "Retour"),
        avatar(t.otherName),
        h("div", { class: "chat-who" }, h("h1", null, t.otherName || "Conversation"), h("a", { class: "small", href: `#/annonce/${encodeURIComponent(t.listingId)}` }, t.title)),
        h("div", { class: "chat-actions" },
          t.otherIsAdvertiser ? h("a", { class: "btn btn-quiet btn-small", href: `#/annonceur/${encodeURIComponent(t.otherId)}` }, "Profil") : null,
          h("button", { class: "btn btn-quiet btn-small", type: "button", onClick: () => dialog.showModal() }, "Signaler"),
          h("button", { class: "btn btn-quiet btn-small", type: "button", onClick: () => setBlock(!t.blockedByMe) }, t.blockedByMe ? "Débloquer" : "Bloquer"))),
      list,
      t.blockedByMe
        ? h("p", { class: "notice chat-blocked" }, "Vous avez bloqué cette personne. Débloquez-la pour lui écrire.")
        : h("form", { class: "chat-composer", onSubmit: (e) => { e.preventDefault(); send(); } }, body,
            h("button", { class: "chat-send", type: "submit", "aria-label": "Envoyer le message" }, icon("send")))),
    dialog);
  count = t.messages.length;
  drawMessages(t.messages, true);
  timer = setInterval(refresh, 8000);
}
