// Page « WhatsApp » (#/whatsapp) : discussions et envoi (Meta WhatsApp Cloud API), présentés comme une messagerie
// (liste de discussions, bulles, coches d'état, thème clair ou sombre selon le système), dans l'habillage du site.
// Réservée au personnel autorisé : le serveur refuse tout autre compte (401/403), la page ne fait qu'afficher ce refus.
import { api, h, mount, toast } from "/js/dom.js";
import { app } from "/js/core/state.js";
import { icon } from "/js/icons.js";

const POLL_MS = 8000;
const NS = "http://www.w3.org/2000/svg";
const digits = (value) => String(value ?? "").replace(/\D/g, "");
const shown = (phone) => `+${phone}`;
const hhmm = (iso) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const dayKey = (iso) => new Date(iso).toLocaleDateString("fr-CA");
const dayLabel = (iso) => {
  const d = new Date(iso); const today = new Date(); const yest = new Date(Date.now() - 86_400_000);
  if (dayKey(iso) === dayKey(today)) return "Aujourd'hui";
  if (dayKey(iso) === dayKey(yest)) return "Hier";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
};
/** Heure du jour si c'est aujourd'hui, « Hier », sinon la date courte (comme dans une liste de discussions). */
const listTime = (iso) => (dayKey(iso) === dayKey(new Date()) ? hhmm(iso) : dayKey(iso) === dayKey(new Date(Date.now() - 86_400_000)) ? "Hier" : new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" }));

/** Petit dessin SVG (traits simples) : flèche, avion en papier, coches. */
function svg(paths, cls = "") {
  const el = document.createElementNS(NS, "svg");
  el.setAttribute("viewBox", "0 0 24 24"); el.setAttribute("class", `wa-svg ${cls}`.trim()); el.setAttribute("aria-hidden", "true");
  for (const [d, fill] of paths) { const p = document.createElementNS(NS, "path"); p.setAttribute("d", d); p.setAttribute(fill ? "fill" : "stroke-linecap", fill ? "currentColor" : "round"); el.append(p); }
  return el;
}
const SEND = [["M3.4 20.4l17.4-7.9a.6.6 0 000-1.1L3.4 3.6a.6.6 0 00-.8.7L5 11l9 1-9 1-2.4 6.7a.6.6 0 00.8.7z", true]];
const TICK1 = [["M5 12.5l4.5 4.5L19 7.5"]];
const TICK2 = [["M2 12.5l4.5 4.5L16 7.5"], ["M9.5 16.5l.9.9L21 7.5"]];
const WARN = [["M12 8v5M12 16.5v.01"]];

/** Messages d'erreur de Meta rendus compréhensibles. */
export function friendlyError(raw) {
  const text = String(raw ?? "");
  if (/131030|not in allowed list/i.test(text)) return "Ce numéro n'est pas dans la liste autorisée par Meta. Tant que l'application Meta n'est pas publiée, ajoutez-le dans Meta (WhatsApp → Configuration de l'API → « À »), ou publiez l'application.";
  if (/131047|24 ?h|re-engagement/i.test(text)) return "Le contact n'a pas écrit depuis plus de 24 heures : Meta n'accepte plus qu'un modèle de message approuvé.";
  return text || "Envoi impossible.";
}

const AV_COLORS = ["#128c7e", "#d1584a", "#6d5ec9", "#c27a1c", "#2f80b7", "#b24f94"];
const avatar = (phone, name) => {
  const hue = AV_COLORS[Number(String(phone).slice(-2)) % AV_COLORS.length];
  const letter = (name || "").trim().charAt(0).toUpperCase();
  return h("span", { class: "wa-av", style: `background:${hue}`, "aria-hidden": "true" }, letter || icon("user"));
};

export async function whatsappPage() {
  loadCss();
  let messages = [];
  let selected = "";
  let composing = false; // « Nouvelle discussion » : le numéro se saisit
  let open = false;      // petit écran : la discussion occupe tout l'écran
  let query = "";
  let loadFailed = false;

  const statusEl = h("div", { class: "wa-status" });
  const infoEl = h("details", { class: "wa-info", hidden: true });
  const search = h("input", { class: "wa-search-in", type: "search", placeholder: "Rechercher une discussion", "aria-label": "Rechercher une discussion", onInput: (e) => { query = e.target.value.trim().toLowerCase(); renderList(); } });
  const listEl = h("div", { class: "wa-list", role: "list" });
  const headEl = h("div", { class: "wa-chead" });
  const threadEl = h("div", { class: "wa-thread", "aria-live": "polite" });
  const toInput = h("input", { class: "wa-to", name: "phone", placeholder: "Numéro avec indicatif, ex. 22370000000", inputmode: "numeric", maxlength: 20, autocomplete: "off", "aria-label": "Numéro du destinataire" });
  const toRow = h("div", { class: "wa-newto", hidden: true }, h("span", null, "À :"), toInput);
  const textInput = h("textarea", { class: "wa-msg", name: "message", placeholder: "Écrivez un message", rows: 1, maxlength: 4096, "aria-label": "Votre message",
    onInput: () => grow(), onKeydown: (e) => { if (e.key === "Enter" && !e.shiftKey && matchMedia("(hover: hover)").matches) { e.preventDefault(); form.requestSubmit(); } } });
  const grow = () => { textInput.style.height = "auto"; textInput.style.height = `${Math.min(textInput.scrollHeight, 120)}px`; };
  const sendButton = h("button", { class: "wa-sendbtn", type: "submit", "aria-label": "Envoyer" }, svg(SEND));
  const result = h("p", { class: "wa-result", role: "status" });
  const emptyEl = h("div", { class: "wa-placeholder" }, h("span", { class: "wa-bigic" }, icon("message")), h("h2", null, "Vos discussions WhatsApp"), h("p", null, "Choisissez une discussion à gauche, ou cliquez sur « Nouvelle discussion »."));

  const form = h("form", { class: "wa-compose", onSubmit: async (event) => {
    event.preventDefault();
    const to = composing ? toInput.value : selected;
    if (!digits(to)) { result.textContent = "Saisissez le numéro du destinataire."; result.className = "wa-result is-err"; return; }
    if (!textInput.value.trim()) return;
    sendButton.disabled = true; result.className = "wa-result"; result.textContent = "";
    try {
      await api("/whatsapp/send", { method: "POST", body: { phone: to, message: textInput.value } });
      textInput.value = ""; grow();
      await load(true);
      const last = [...messages].reverse().find((m) => m.direction === "outbound");
      if (composing && last) { selected = last.phone; composing = false; }
      render();
    } catch (error) {
      result.className = "wa-result is-err"; result.textContent = friendlyError(error?.message); await load(true);
    } finally { sendButton.disabled = false; }
  } }, h("div", { class: "wa-field" }, textInput), sendButton);

  // Petit écran : la discussion s'ouvre par-dessus la liste ; le bouton « précédent » du téléphone (ou du navigateur) la referme.
  const small = () => matchMedia("(max-width: 720px)").matches;
  function openChat() { if (small() && !open) history.pushState({ waChat: true }, ""); open = true; }
  const onPop = () => { if (open) { open = false; composing = false; render(); } };
  window.addEventListener("popstate", onPop);

  function conversations() {
    const byPhone = new Map();
    for (const m of messages) {
      const entry = byPhone.get(m.phone) ?? { phone: m.phone, name: null, last: m };
      if (m.name) entry.name = m.name;
      entry.last = m; byPhone.set(m.phone, entry);
    }
    return [...byPhone.values()].sort((a, b) => new Date(b.last.createdAt) - new Date(a.last.createdAt));
  }

  const ticks = (m) => {
    if (m.direction !== "outbound") return null;
    if (m.status === "failed") return h("span", { class: "wa-tick is-failed", title: "Échec de l'envoi" }, svg(WARN, "is-warn"));
    if (m.status === "read") return h("span", { class: "wa-tick is-read", title: "Lu" }, svg(TICK2));
    if (m.status === "delivered") return h("span", { class: "wa-tick", title: "Distribué" }, svg(TICK2));
    return h("span", { class: "wa-tick", title: "Envoyé" }, svg(TICK1));
  };

  const bubble = (m) => {
    const mine = m.direction === "outbound";
    return h("div", { class: `wa-bubble ${mine ? "is-out" : "is-in"}${m.status === "failed" ? " is-failed" : ""}` },
      h("div", { class: "wa-text" }, m.text || "—"),
      h("div", { class: "wa-meta" }, h("span", null, hhmm(m.createdAt)), ticks(m)),
      m.status === "failed" && m.error ? h("div", { class: "wa-err" }, friendlyError(m.error)) : null);
  };

  function renderList() {
    const list = conversations().filter((c) => !query || `${c.name ?? ""} ${c.phone} ${c.last.text ?? ""}`.toLowerCase().includes(query));
    listEl.replaceChildren(...(list.length ? list.map((c) => h("button", { class: `wa-conv${!composing && c.phone === selected ? " is-on" : ""}`, type: "button", role: "listitem",
      onClick: () => { selected = c.phone; composing = false; openChat(); render(); threadEl.scrollTop = threadEl.scrollHeight; } },
      avatar(c.phone, c.name),
      h("span", { class: "wa-cinfo" }, h("span", { class: "wa-crow" }, h("strong", null, c.name || shown(c.phone)), h("small", { class: "wa-ctime" }, listTime(c.last.createdAt))),
        h("span", { class: "wa-clast" }, c.last.direction === "outbound" ? ticks(c.last) : null, h("span", null, String(c.last.text ?? "").slice(0, 70) || "—"))))) : [h("p", { class: "wa-empty" }, loadFailed ? "Historique indisponible." : query ? "Aucune discussion trouvée." : "Aucun message pour le moment.")]));
  }

  function render() {
    document.body.classList.toggle("wa-open", open);
    root.classList.toggle("is-open", open);
    renderList();
    const cur = conversations().find((c) => c.phone === selected);
    const hasChat = composing || Boolean(cur);
    emptyEl.hidden = hasChat; headEl.hidden = !hasChat; threadEl.hidden = !hasChat; form.hidden = !hasChat; toRow.hidden = !composing;
    headEl.replaceChildren(...[
      composing ? h("span", { class: "wa-av wa-av-new", "aria-hidden": "true" }, icon("user")) : avatar(selected, cur?.name),
      h("div", { class: "wa-ctitle" }, h("strong", null, composing ? "Nouvelle discussion" : cur ? (cur.name || shown(cur.phone)) : ""), !composing && cur?.name ? h("small", null, shown(cur.phone)) : null),
    ].filter(Boolean)); // replaceChildren(null) écrirait « null »
    const near = threadEl.scrollHeight - threadEl.scrollTop - threadEl.clientHeight < 120;
    const thread = composing ? [] : messages.filter((m) => m.phone === selected);
    const nodes = []; let lastDay = "";
    for (const m of thread) { const k = dayKey(m.createdAt); if (k !== lastDay) { lastDay = k; nodes.push(h("div", { class: "wa-day" }, h("span", null, dayLabel(m.createdAt)))); } nodes.push(bubble(m)); }
    threadEl.replaceChildren(...(nodes.length ? nodes : [h("p", { class: "wa-empty" }, composing ? "Saisissez un numéro puis votre message." : "Aucun message avec ce numéro.")]));
    if (near) threadEl.scrollTop = threadEl.scrollHeight;
  }

  async function load(silent) {
    try {
      messages = (await api("/whatsapp/messages?limit=500")).messages ?? []; loadFailed = false;
      if (!selected && !composing && messages.length && !matchMedia("(max-width: 720px)").matches) selected = conversations()[0].phone;
    } catch (error) { loadFailed = true; if (!silent) toast(error?.message || "Historique indisponible.", true); }
    render();
  }

  async function loadStatus() {
    try {
      const info = await api("/whatsapp/status"); const configured = Boolean(info.configured);
      const url = `${location.origin}${info.webhookPath}`;
      statusEl.replaceChildren(h("span", { class: `wa-pill${configured ? " is-ok" : ""}` }, configured ? "Connecté à Meta" : "Non configuré"));
      infoEl.hidden = false;
      infoEl.replaceChildren(h("summary", null, "Configuration Meta"),
        h("p", { class: "small" }, "Adresse du webhook (à coller chez Meta) :"),
        h("div", { class: "wa-urlrow" }, h("code", { class: "wa-url" }, url), h("button", { class: "wa-btn", type: "button", onClick: async () => { try { await navigator.clipboard.writeText(url); toast("Adresse copiée."); } catch { toast("Copie impossible.", true); } } }, "Copier")),
        h("p", { class: "small muted" }, "Jeton de vérification : la valeur de WHATSAPP_VERIFY_TOKEN. Abonnement à cocher chez Meta : messages."));
      if (!configured) infoEl.open = true;
    } catch (error) {
      statusEl.replaceChildren(h("span", { class: "wa-pill" }, error?.message || "Accès refusé"));
      infoEl.hidden = false; infoEl.replaceChildren(h("p", { class: "small" }, "Cette page est réservée aux administrateurs connectés."));
    }
  }

  const root = h("section", { class: "wa" },
    h("div", { class: "wa-top" }, h("div", { class: "wa-title" }, h("span", { class: "wa-logo", "aria-hidden": "true" }, icon("message")), h("h1", null, "WhatsApp")), statusEl),
    infoEl,
    h("div", { class: "wa-app" },
      h("aside", { class: "wa-side" },
        h("div", { class: "wa-shead" }, h("strong", null, "Discussions"),
          h("button", { class: "wa-btn", type: "button", onClick: () => { composing = true; openChat(); render(); toInput.focus(); } }, icon("plus"), "Nouvelle discussion")),
        h("div", { class: "wa-search" }, icon("search"), search), listEl),
      h("section", { class: "wa-main" }, emptyEl, headEl, toRow, threadEl, result, form)));

  mount(app, root);
  render();
  await Promise.all([loadStatus(), load(true)]);
  const timer = setInterval(() => {
    if (!root.isConnected) { clearInterval(timer); window.removeEventListener("popstate", onPop); document.body.classList.remove("wa-open"); return; }
    if (!document.hidden) load(true);
  }, POLL_MS);
}

function loadCss() {
  const href = "/css/whatsapp.css";
  if (!document.querySelector(`link[href="${href}"]`)) document.head.append(h("link", { rel: "stylesheet", href }));
}
