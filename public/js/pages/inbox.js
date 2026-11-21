import { api, fail, formatDate, h, mount, toast } from "/js/dom.js";
import { S, app, refreshUnread } from "/js/core/state.js";
import { currentRoute, needLogin } from "/js/core/router.js";
import { field, select } from "/js/components/ui.js";
import { avatar, clock, dayLabel, listTime, ticks } from "/js/components/chat.js";
import { icon } from "/js/icons.js";

const KIND = { SEARCH_MATCH: "Alerte", SEARCH_DIGEST: "Résumé", MESSAGE: "Message", VISIT_REQUEST: "Visite", VISIT_ANSWER: "Visite", LISTING_APPROVED: "Annonce", LISTING_REJECTED: "Annonce", ADVERTISER_APPLICATION: "Demande annonceur", LISTING_PENDING: "Annonce à valider", FEATURED_REQUEST: "Mise à la une", PREMIUM_REQUEST: "Demande Premium", PREMIUM: "Premium", TEAM_REQUEST: "Équipe" };
const FILTER = { transaction: "Transaction", category: "Type", zone: "Quartier", maxPrice: "Prix max", minPrice: "Prix min", minSurface: "Surface min (m²)", bedrooms: "Chambres min.", q: "Mots" };
const USER_REPORT_REASONS = ["Harcèlement ou insultes", "Arnaque ou demande d'acompte", "Spam ou publicité", "Autre"];
const VISIT = { PENDING: "En attente", ACCEPTED: "Acceptée", DECLINED: "Refusée", CANCELLED: "Annulée" };

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const initialsOf = (name) => { const p = String(name || "?").trim().split(/\s+/).filter(Boolean); return ((p[0]?.[0] ?? "?") + (p[1]?.[0] ?? "")).toUpperCase(); };
const frDay = (iso) => cap(new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "short", year: "numeric" }));
const frShort = (iso) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const frTime = (iso) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const bxToast = (message) => {
  let box = document.querySelector(".bx-toasts");
  if (!box) { box = h("div", { class: "bx-toasts", "aria-live": "polite" }); document.body.append(box); }
  const t = h("div", { class: "bx-toast", role: "status" }, h("i"), h("span", null, message));
  box.append(t);
  requestAnimationFrame(() => t.classList.add("is-on"));
  setTimeout(() => { t.classList.remove("is-on"); setTimeout(() => t.remove(), 300); }, 3000);
};
let bxPoll = null;

export async function inboxPage() {
  if (needLogin()) return;
  document.body.classList.remove("in-chat");
  if (bxPoll) { clearInterval(bxPoll); bxPoll = null; }
  let tab = currentRoute().params.get("onglet") || "alertes";
  if (!["alertes", "messages", "visites"].includes(tab)) tab = "alertes";
  let filter = "all"; let query = ""; let activeId = null; let active = null;
  const [notes, searches, threads, visits, prefs, team] = await Promise.all([api("/me/notifications"), api("/me/searches"), api("/me/threads"), api("/me/visits"), api("/me/alert-prefs").catch(() => ({ mode: "INSTANT" })), api("/me/team-requests").catch(() => ({ received: [] }))]);
  const unreadNotes = () => notes.filter((n) => !n.read).length;
  const pendingVisits = () => visits.filter((v) => v.asOwner && v.status === "PENDING").length;
  const reload = async () => { await refreshUnread(); inboxPage(); };
  const catOf = (n) => (n.kind === "TEAM_REQUEST" ? "equipe" : "annonces");
  const markRead = async (n) => {
    if (n.read) return;
    n.read = true; draw();
    try { await api("/me/notifications/read", { method: "POST", body: { id: n.id } }); refreshUnread(); } catch { /* sera resynchronisé au prochain chargement */ }
  };
  const threadIdOf = (link) => { const m = /^#\/boite\/([^/?]+)$/.exec(link || ""); return m ? decodeURIComponent(m[1]) : null; };

  // ---- En-tête (créé une fois : la saisie de recherche garde le focus) ----
  const pillText = h("span");
  const pill = h("span", { class: "bx-pill" }, h("span", { class: "bx-dot" }), pillText);
  const search = h("input", { type: "text", "aria-label": "Rechercher", placeholder: "Rechercher (ACI 2000, Hamdallaye...)", onInput: (e) => { query = e.target.value.trim().toLowerCase(); drawPanel(); } });
  const tabsNav = h("nav", { class: "bx-tabs", "aria-label": "Onglets de la boîte", role: "tablist" });
  const host = h("div", { id: "inbox-body" });
  const drawHead = () => {
    const n = unreadNotes();
    pill.hidden = n === 0; pillText.textContent = n === 1 ? "1 alerte non lue" : `${n} alertes non lues`;
    const mk = (key, glyph, label, count, cls) => h("button", { type: "button", role: "tab", class: "bx-tab", "aria-selected": String(tab === key), onClick: () => { tab = key; if (key !== "messages" && bxPoll) { clearInterval(bxPoll); bxPoll = null; } draw(); } },
      icon(glyph), h("span", null, label), count ? h("span", { class: `bx-count ${cls}` }, String(count)) : null);
    mount(tabsNav, mk("alertes", "bell", "Alertes", n, "is-alert"), mk("messages", "message", "Messages", threads.length, ""), mk("visites", "calendar-check", "Visites", visits.length, "is-plain"));
  };

  // ---- Alertes ----
  const alertsPanel = () => {
    const matches = (n) => {
      const okF = filter === "all" || (filter === "unread" && !n.read) || filter === catOf(n);
      const okQ = !query || `${n.title ?? ""} ${n.body ?? ""} ${KIND[n.kind] ?? ""}`.toLowerCase().includes(query);
      return okF && okQ;
    };
    const rows = notes.filter(matches);
    const fp = (key, label, extra, tail) => h("button", { type: "button", class: "bx-fp", "aria-pressed": String(filter === key), onClick: () => { filter = key; drawPanel(); } }, label, extra ?? null, tail ?? null);
    const card = (n) => {
      const glyph = n.kind === "TEAM_REQUEST" ? "users" : n.kind === "MESSAGE" ? "message" : "info";
      const inv = n.kind === "TEAM_REQUEST" ? (team.received ?? []).find((r) => r.name && String(n.title).startsWith(r.name)) : null;
      const tid = n.kind === "MESSAGE" ? threadIdOf(n.link) : null;
      let action = null;
      if (inv) {
        const reply = (ok) => async (e) => { e.stopPropagation(); try { await api(`/me/team-requests/${encodeURIComponent(inv.linkId)}/${ok ? "accept" : "decline"}`, { method: "POST", body: {} }); bxToast(ok ? "Invitation acceptée." : "Invitation déclinée."); reload(); } catch (error) { fail(error); } };
        action = h("div", { class: "bx-acts" }, h("button", { type: "button", class: "bx-a is-go", onClick: reply(true) }, "Accepter"), h("button", { type: "button", class: "bx-a is-no", onClick: reply(false) }, "Refuser"));
      } else if (tid) {
        action = h("button", { type: "button", class: "bx-a is-mint", onClick: (e) => { e.stopPropagation(); markRead(n); tab = "messages"; activeId = tid; active = null; draw(); } }, h("span", null, "Répondre"), icon("arrow-right"));
      } else if (n.link && n.link !== "#/boite") {
        const visit = n.kind === "VISIT_REQUEST" || n.kind === "VISIT_ANSWER";
        action = h("button", { type: "button", class: "bx-a is-line", onClick: (e) => { e.stopPropagation(); markRead(n); if (visit) { tab = "visites"; draw(); } else if (n.link.startsWith("/")) location.assign(n.link); else location.hash = n.link; } }, icon("sparkles"), h("span", null, n.kind === "TEAM_REQUEST" ? "Voir l'équipe" : visit ? "Voir la visite" : n.kind === "SEARCH_MATCH" || n.kind === "SEARCH_DIGEST" || n.kind.startsWith("LISTING") ? "Voir l'annonce" : n.link.startsWith("/owner") ? "Traiter la demande" : "Ouvrir"));
      }
      return h("li", null, h("article", { class: `bx-card ${n.read ? "" : "is-new"}`, onClick: () => markRead(n) },
        h("div", { class: "bx-bar-l" }),
        h("div", { class: "bx-row" },
          h("div", { class: "bx-main" },
            h("div", { class: "bx-badges" }, h("span", { class: "bx-kind" }, icon(glyph), h("span", null, KIND[n.kind] ?? "Info")),
              n.read ? null : h("span", { class: "bx-new" }, h("i"), "Nouveau"), h("span", { class: "bx-d-s" }, frShort(n.createdAt))),
            h("h3", { class: "bx-ct" }, n.title), n.body ? h("p", { class: "bx-cd" }, n.body) : null),
          h("div", { class: "bx-side" }, h("span", { class: "bx-d-l" }, frShort(n.createdAt)),
            h("div", { class: "bx-acts" }, action, h("button", { type: "button", class: `bx-rd ${n.read ? "" : "is-unread"}`, title: n.read ? "Lue" : "Marquer comme lue", "aria-label": n.read ? "Alerte lue" : "Marquer comme lue", disabled: n.read, onClick: (e) => { e.stopPropagation(); markRead(n); } }, icon(n.read ? "check-circle" : "circle-dot")))))));
    };
    const empty = (title, text) => h("div", { class: "bx-empty" }, h("div", { class: "bx-eic" }, icon("bell-off")), h("h3", null, title), h("p", null, text));
    return [
      h("div", { class: "bx-tools" },
        h("div", { class: "bx-filters", role: "group", "aria-label": "Filtrer les alertes" }, fp("all", "Toutes (", h("span", null, String(notes.length)), ")"), fp("unread", "Non lues (", h("span", null, String(unreadNotes())), ")"), fp("equipe", "Équipe"), fp("annonces", "Annonces & Messages")),
        h("button", { type: "button", class: `bx-btn ${unreadNotes() ? "" : "is-off"}`, onClick: async () => { try { await api("/me/notifications/read", { method: "POST", body: {} }); notes.forEach((n) => { n.read = true; }); bxToast("Toutes les alertes ont été marquées comme lues"); refreshUnread(); draw(); } catch (error) { fail(error); } } }, icon("check-check"), h("span", null, "Tout marquer lu"))),
      rows.length ? h("ul", { class: "bx-list" }, rows.map(card)) : (notes.length ? empty("Aucune alerte trouvée", "Essayez de modifier vos filtres ou votre recherche.") : empty("Aucune alerte pour le moment", "Les nouvelles alertes apparaîtront ici.")),
      h("section", { class: "bx-sec" },
        h("h2", { "data-ic": "x" }, "Mes recherches enregistrées"),
        h("p", null, "Depuis l'accueil, utilisez « Enregistrer cette recherche »."),
        h("label", null, "Fréquence des alertes",
          h("select", { onChange: async (e) => { try { await api("/me/alert-prefs", { method: "PUT", body: { mode: e.target.value } }); bxToast(e.target.value === "DAILY" ? "Vous recevrez un résumé par jour." : "Vous serez prévenu dès la publication."); } catch (error) { fail(error); } } },
            h("option", { value: "INSTANT", selected: prefs.mode !== "DAILY" }, "Dès qu'une annonce correspond"),
            h("option", { value: "DAILY", selected: prefs.mode === "DAILY" }, "Un résumé par jour"))),
        searches.length ? h("ul", { class: "bx-list" }, searches.map((s) => h("li", { class: "bx-saved" },
          h("span", null, h("b", null, s.label), h("small", null, Object.entries(s.filters).map(([k, v]) => `${FILTER[k] ?? k} : ${v}`).join(" · "))),
          h("button", { type: "button", class: "bx-a is-no", "aria-label": `Supprimer la recherche ${s.label}`, onClick: async () => { try { await api(`/me/searches/${encodeURIComponent(s.id)}/delete`, { method: "POST", body: {} }); reload(); } catch (error) { fail(error); } } }, "Supprimer"))))
          : h("p", { class: "bx-note", style: "margin-top:.875rem" }, "Aucune recherche enregistrée.")),
    ];
  };

  // ---- Messages ----
  const loadActive = async () => {
    const id = activeId ?? threads[0]?.id;
    if (!id) return;
    activeId = id;
    try {
      active = await api(`/me/threads/${encodeURIComponent(id)}`);
      const th = threads.find((x) => x.id === id); if (th) { th.unread = false; th.unreadCount = 0; }
      refreshUnread(); drawHead(); if (tab === "messages") drawPanel();
    } catch (error) { fail(error); }
  };
  const messagesPanel = () => {
    const list = threads.filter((t) => !query || `${t.otherName ?? ""} ${t.title ?? ""} ${t.lastBody ?? ""}`.toLowerCase().includes(query));
    if (!threads.length) return [h("div", { class: "bx-empty" }, h("div", { class: "bx-eic" }, icon("message")), h("h3", null, "Aucun message"), h("p", null, "Écrivez à un annonceur depuis une fiche d'annonce."))];
    if (!active || active.id !== activeId) loadActive();
    const cur = threads.find((t) => t.id === activeId) ?? threads[0];
    const item = (t) => h("li", null, h("button", { type: "button", class: "bx-ci", "aria-current": String(t.id === activeId), onClick: () => { activeId = t.id; active = null; drawPanel(); } },
      h("span", { class: `bx-av ${t.id === activeId ? "is-main" : ""}` }, initialsOf(t.otherName)),
      h("span", { class: "bx-cm" },
        h("span", { class: "bx-cl" }, h("span", { class: "bx-cn" }, t.otherName || "Utilisateur"), h("span", { class: "bx-ctm" }, listTime(t.lastMessageAt))),
        h("span", { class: "bx-cp" }, `${t.asOwner ? "Intéressé par" : "Annonce :"} ${t.title}`),
        h("span", { class: "bx-cl" }, h("span", { class: "bx-cx" }, t.blockedByMe ? "Personne bloquée" : (t.lastBody ?? "")), t.unreadCount ? h("span", { class: "bx-ub" }, String(t.unreadCount)) : null))));
    const input = h("input", { type: "text", maxlength: "1000", "aria-label": "Votre message", placeholder: `Écrivez votre réponse à ${(cur.otherName || "cette personne").split(" ")[0]}...`, required: true });
    const area = h("div", { class: "bx-msgs", "aria-live": "polite", "aria-label": "Messages" });
    const drawMsgs = () => {
      if (!active) { mount(area, h("p", { class: "bx-mt" }, "Chargement…")); return; }
      mount(area, active.messages.length ? active.messages.map((m) => h("div", { class: `bx-m ${m.mine ? "is-me" : ""}` }, h("div", { class: "bx-bub" }, m.body), h("span", { class: "bx-mt" }, `${dayLabel(m.createdAt)} • ${clock(m.createdAt)}`))) : h("p", { class: "bx-mt" }, "Aucun message"));
      area.scrollTop = area.scrollHeight;
    };
    drawMsgs();
    const send = async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (text.length < 2) return;
      try { await api(`/me/threads/${encodeURIComponent(activeId)}/messages`, { method: "POST", body: { body: text } }); input.value = ""; active = await api(`/me/threads/${encodeURIComponent(activeId)}`); drawMsgs(); } catch (error) { fail(error); }
    };
    if (bxPoll) clearInterval(bxPoll);
    bxPoll = setInterval(async () => {
      if (!/^#\/boite\/?(\?.*)?$/.test(location.hash) || tab !== "messages") { clearInterval(bxPoll); bxPoll = null; return; }
      try { const fresh = await api(`/me/threads/${encodeURIComponent(activeId)}`); if (active && (fresh.messages.length !== active.messages.length)) { active = fresh; drawMsgs(); refreshUnread(); } } catch { /* hors connexion */ }
    }, 8000);
    return [h("div", { class: "bx-split" },
      h("div", { class: "bx-conv" },
        h("div", { class: "bx-conv-h" }, h("h2", { "data-ic": "x" }, `Discussions (${threads.length})`), h("span", { class: "bx-act" }, "Actives")),
        list.length ? h("ul", { class: "bx-convs" }, list.map(item)) : h("p", { class: "bx-nochat" }, "Aucune conversation ne correspond.")),
      h("div", { class: "bx-chat" },
        h("div", { class: "bx-chat-h" },
          h("div", { class: "bx-who" }, h("span", { class: "bx-av is-main is-sm" }, initialsOf(cur.otherName)),
            h("div", null, h("div", { class: "bx-h1row" }, h("h3", null, active?.otherIsAdvertiser ? h("a", { href: `#/annonceur/${encodeURIComponent(active.otherId)}` }, cur.otherName || "Utilisateur") : (cur.otherName || "Utilisateur")), active?.otherIsAdvertiser ? h("span", { class: "bx-badge" }, "Annonceur") : null),
              h("p", { class: "bx-lt" }, icon("home"), h("span", null, cur.title)))),
          h("div", { class: "bx-h-actions" },
            active?.listingId ? h("a", { class: "bx-ghost", href: `#/annonce/${encodeURIComponent(active.listingId)}` }, icon("home"), h("span", null, "Voir l'annonce")) : active?.publicationId ? h("a", { class: "bx-ghost", href: "#/decouvrir" }, icon("sparkles"), h("span", null, "Voir Découvrir")) : null,
            h("a", { class: "bx-ghost", href: `#/boite/${encodeURIComponent(cur.id)}` }, icon("sliders"), h("span", null, "Options")))),
        area,
        cur.blockedByMe ? h("p", { class: "bx-blocked" }, "Vous avez bloqué cette personne. Débloquez-la depuis « Options » pour lui écrire.")
          : h("form", { class: "bx-form", onSubmit: send }, input, h("button", { type: "submit", class: "bx-send" }, h("span", null, "Envoyer"), icon("send")))))];
  };

  // ---- Visites ----
  async function answer(v, accept) {
    const note = accept ? (window.prompt("Message pour le visiteur (facultatif) :") ?? "") : window.prompt("Motif du refus, ou autre date proposée (obligatoire) :");
    if (note === null || (!accept && note.trim().length < 3)) return;
    try { await api(`/me/visits/${encodeURIComponent(v.id)}/answer`, { method: "POST", body: { accept, note } }); bxToast(accept ? "Créneau de visite confirmé avec succès !" : "Réponse envoyée au visiteur."); reload(); } catch (error) { fail(error); }
  }
  const visitsPanel = () => {
    const pend = pendingVisits();
    const card = (v) => {
      const st = v.status === "PENDING" ? ["is-wait", "clock", "En attente de confirmation"] : v.status === "ACCEPTED" ? ["", "check-circle", "Visite confirmée"] : ["is-off", "x", VISIT[v.status] === "Annulée" ? "Visite annulée" : "Visite refusée"];
      let foot = null;
      if (v.status === "PENDING" && v.asOwner) foot = h("div", { class: "bx-vf" }, h("button", { type: "button", class: "bx-a is-go", onClick: () => answer(v, true) }, icon("check"), h("span", null, "Confirmer le créneau")), h("button", { type: "button", class: "bx-a is-no", onClick: () => answer(v, false) }, icon("calendar-clock"), h("span", null, "Refuser / Reporter")));
      else if (v.status === "PENDING") foot = h("div", { class: "bx-vf" }, h("button", { type: "button", class: "bx-a is-no", onClick: async () => { try { await api(`/me/visits/${encodeURIComponent(v.id)}/cancel`, { method: "POST", body: {} }); reload(); } catch (error) { fail(error); } } }, icon("x"), h("span", null, "Annuler la demande")));
      else if (v.status === "ACCEPTED") foot = h("div", { class: "bx-vf" }, h("span", { class: "is-ok" }, icon("check-check"), "Visite confirmée"));
      return h("li", { class: `bx-v ${st[0]}` }, h("i"),
        h("div", null,
          h("div", { class: "bx-vt" }, h("span", { class: "bx-vs" }, icon(st[1]), h("span", null, st[2])), h("span", { class: "bx-ref" }, `Réf. #VIS-${String(v.id).replace(/[^a-z0-9]/gi, "").slice(-4).toUpperCase()}`)),
          h("h3", null, v.title),
          h("div", { class: "bx-vbox" },
            h("div", null, h("span", { class: "bx-vl" }, "Date & Heure"), h("span", { class: "bx-vv" }, frDay(v.proposedAt)), h("span", { class: "bx-vh2" }, frTime(v.proposedAt))),
            h("div", null, h("span", { class: "bx-vl" }, v.asOwner ? "Visiteur" : "Annonceur"), h("span", { class: "bx-vv" }, v.otherName || "Utilisateur"))),
          v.note ? h("p", { class: "bx-vnote" }, `« ${v.note} »`) : null,
          v.answerNote ? h("p", { class: "bx-vnote" }, `Réponse : ${v.answerNote}`) : null),
        foot);
    };
    return [
      h("div", { class: "bx-vh" }, h("div", null, h("h2", { "data-ic": "x" }, "Demandes et planning de visites"), h("p", null, "Confirmez ou reprogrammez les créneaux demandés par vos prospects.")),
        pend ? h("div", { class: "bx-wait" }, h("i"), h("span", null, pend === 1 ? "1 visite en attente de confirmation" : `${pend} visites en attente de confirmation`)) : null),
      visits.length ? h("ul", { class: "bx-grid" }, visits.map(card)) : h("div", { class: "bx-empty" }, h("div", { class: "bx-eic" }, icon("calendar-check")), h("h3", null, "Aucune visite"), h("p", null, "Demandez-en une depuis une fiche d'annonce.")),
    ];
  };

  const panels = { alertes: alertsPanel, messages: messagesPanel, visites: visitsPanel };
  const drawPanel = () => mount(host, h("div", { class: "bx-panel" }, panels[tab]()));
  const draw = () => { drawHead(); drawPanel(); };
  mount(app, h("div", { class: "bx" },
    h("header", { class: "bx-head" },
      h("div", { class: "bx-top" },
        h("div", { class: "bx-title" }, h("div", { class: "bx-logo" }, icon("inbox", "bx-lg")),
          h("div", null, h("div", { class: "bx-h1row" }, h("h1", { class: "bx-h1" }, "Boîte"), pill),
            h("p", { class: "bx-sub" }, "Gérez vos alertes d'annonces, vos échanges clients et vos visites immobilières."))),
        h("div", { class: "bx-search" }, icon("search"), search)),
      h("div", { class: "bx-bar" }, tabsNav, h("div", { class: "bx-date" }, icon("calendar"), h("span", null, `${frDay(new Date().toISOString())} • Bamako`)))),
    host));
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
        avatar(t.otherName),
        h("div", { class: "chat-who" }, h("h1", null, t.otherName || "Conversation"), t.listingId ? h("a", { class: "small", href: `#/annonce/${encodeURIComponent(t.listingId)}` }, t.title) : h("a", { class: "small", href: "#/decouvrir" }, `Publication : ${t.title}`)),
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
