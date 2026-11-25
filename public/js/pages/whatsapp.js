// Page « WhatsApp » (#/whatsapp) : conversations et envoi (Meta WhatsApp Cloud API), dans l'habillage normal du site.
// Réservée au personnel autorisé : le serveur refuse tout autre compte (401/403), la page ne fait qu'afficher ce refus.
import { api, h, mount, toast } from "/js/dom.js";
import { app } from "/js/core/state.js";
import { icon } from "/js/icons.js";

const STATUS = { received: "Reçu", sent: "Envoyé", delivered: "Distribué", read: "Lu", failed: "Échec" };
const POLL_MS = 8000;
const digits = (value) => String(value ?? "").replace(/\D/g, "");
const when = (iso) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
const shown = (phone) => `+${phone}`;

/** Messages d'erreur de Meta rendus compréhensibles. */
export function friendlyError(raw) {
  const text = String(raw ?? "");
  if (/131030|not in allowed list/i.test(text)) return "Ce numéro n'est pas dans la liste autorisée par Meta. Tant que l'application Meta n'est pas publiée, ajoutez-le dans Meta (WhatsApp → Configuration de l'API → « À »), ou publiez l'application.";
  if (/131047|24 ?h|re-engagement/i.test(text)) return "Le contact n'a pas écrit depuis plus de 24 heures : Meta n'accepte plus qu'un modèle de message approuvé.";
  return text || "Envoi impossible.";
}

export async function whatsappPage() {
  loadCss();
  let messages = [];
  let selected = "";
  let composing = false; // « Nouvelle conversation » : le numéro se saisit
  let loadFailed = false;
  let configured = null;

  const statusEl = h("div", { class: "wa-status" });
  const infoEl = h("details", { class: "wa-info", hidden: true });
  const listEl = h("div", { class: "wa-list", role: "list" });
  const headEl = h("div", { class: "wa-thead" });
  const threadEl = h("div", { class: "wa-thread", "aria-live": "polite" });
  const phoneInput = h("input", { class: "input", name: "phone", placeholder: "Numéro avec indicatif, ex. 22370000000", inputmode: "numeric", maxlength: 20, autocomplete: "off", "aria-label": "Numéro du destinataire" });
  const textInput = h("textarea", { class: "input", name: "message", placeholder: "Votre message", rows: 2, maxlength: 4096, "aria-label": "Votre message" });
  const sendButton = h("button", { class: "btn btn-primary", type: "submit" }, icon("message"), "Envoyer");
  const result = h("p", { class: "small wa-result", role: "status" });

  const form = h("form", { class: "wa-compose", onSubmit: async (event) => {
    event.preventDefault();
    const to = composing ? phoneInput.value : selected;
    if (!digits(to)) { result.className = "small wa-result is-err"; result.textContent = "Saisissez le numéro du destinataire."; return; }
    sendButton.disabled = true; result.className = "small wa-result"; result.textContent = "Envoi en cours…";
    try {
      await api("/whatsapp/send", { method: "POST", body: { phone: to, message: textInput.value } });
      textInput.value = ""; result.textContent = "Message transmis à Meta.";
      await load(true);
      const last = [...messages].reverse().find((m) => m.direction === "outbound");
      if (composing && last) { selected = last.phone; composing = false; }
      render();
    } catch (error) {
      result.className = "small wa-result is-err"; result.textContent = friendlyError(error?.message); await load(true);
    } finally { sendButton.disabled = false; }
  } }, composing ? phoneInput : null, textInput, h("div", { class: "wa-send" }, h("p", { class: "small muted" }, "Message libre : le contact doit avoir écrit il y a moins de 24 h."), sendButton), result);

  function conversations() {
    const byPhone = new Map();
    for (const m of messages) {
      const entry = byPhone.get(m.phone) ?? { phone: m.phone, name: null, last: m };
      if (m.name) entry.name = m.name;
      entry.last = m; byPhone.set(m.phone, entry);
    }
    return [...byPhone.values()].sort((a, b) => new Date(b.last.createdAt) - new Date(a.last.createdAt));
  }

  const bubble = (m) => {
    const mine = m.direction === "outbound";
    const meta = [when(m.createdAt), mine ? STATUS[m.status] ?? m.status : null].filter(Boolean).join(" · ");
    return h("div", { class: `wa-bubble ${mine ? "is-out" : "is-in"}${m.status === "failed" ? " is-failed" : ""}` },
      h("div", { class: "wa-text" }, m.text || "—"), h("div", { class: "wa-meta" }, meta),
      m.status === "failed" && m.error ? h("div", { class: "wa-err" }, friendlyError(m.error)) : null);
  };

  function render() {
    const list = conversations();
    listEl.replaceChildren(...(list.length ? list.map((c) => h("button", { class: `wa-conv${!composing && c.phone === selected ? " is-on" : ""}`, type: "button", role: "listitem",
      onClick: () => { selected = c.phone; composing = false; render(); } },
      h("span", { class: "wa-av", "aria-hidden": "true" }, (c.name || "#").trim().charAt(0).toUpperCase()),
      h("span", { class: "wa-cinfo" }, h("strong", null, c.name || shown(c.phone)), h("small", { class: "muted" }, String(c.last.text ?? "").slice(0, 60) || "—")),
      h("small", { class: "wa-ctime muted" }, when(c.last.createdAt)))) : [h("p", { class: "muted small wa-empty" }, loadFailed ? "Historique indisponible." : "Aucun message pour le moment.")]));
    const cur = list.find((c) => c.phone === selected);
    headEl.replaceChildren(...[h("strong", null, composing ? "Nouvelle conversation" : cur ? (cur.name || shown(cur.phone)) : "Conversation"), !composing && cur?.name ? h("small", { class: "muted" }, shown(cur.phone)) : null].filter(Boolean)); // replaceChildren(null) écrirait « null »
    const near = threadEl.scrollHeight - threadEl.scrollTop - threadEl.clientHeight < 80;
    const thread = composing ? [] : messages.filter((m) => m.phone === selected);
    threadEl.replaceChildren(...(thread.length ? thread.map(bubble) : [h("p", { class: "muted small wa-empty" }, composing ? "Saisissez un numéro et votre message." : "Choisissez une conversation.")]));
    if (near) threadEl.scrollTop = threadEl.scrollHeight;
    form.replaceChildren(...(composing ? [phoneInput] : []), textInput, h("div", { class: "wa-send" }, h("p", { class: "small muted" }, "Message libre : le contact doit avoir écrit il y a moins de 24 h."), sendButton), result);
  }

  async function load(silent) {
    try {
      messages = (await api("/whatsapp/messages?limit=500")).messages ?? []; loadFailed = false;
      if (!selected && !composing && messages.length) selected = messages[messages.length - 1].phone;
    } catch (error) { loadFailed = true; if (!silent) toast(error?.message || "Historique indisponible.", true); }
    render();
  }

  async function loadStatus() {
    try {
      const info = await api("/whatsapp/status"); configured = Boolean(info.configured);
      const url = `${location.origin}${info.webhookPath}`;
      statusEl.replaceChildren(h("span", { class: `pill ${configured ? "pill-green" : ""}` }, configured ? "Connecté à Meta" : "Non configuré"));
      infoEl.hidden = false;
      infoEl.replaceChildren(h("summary", null, "Configuration Meta"),
        h("p", { class: "small" }, "Adresse du webhook (à coller chez Meta) :"),
        h("div", { class: "row" }, h("code", { class: "wa-url" }, url), h("button", { class: "btn btn-small", type: "button", onClick: async () => { try { await navigator.clipboard.writeText(url); toast("Adresse copiée."); } catch { toast("Copie impossible.", true); } } }, "Copier")),
        h("p", { class: "small muted" }, "Jeton de vérification : la valeur de WHATSAPP_VERIFY_TOKEN. Abonnement à cocher chez Meta : messages."));
      if (!configured) infoEl.open = true;
    } catch (error) {
      statusEl.replaceChildren(h("span", { class: "pill" }, error?.message || "Accès refusé"));
      infoEl.hidden = false; infoEl.replaceChildren(h("p", { class: "small" }, "Cette page est réservée aux administrateurs connectés."));
    }
  }

  const root = h("section", { class: "wa stack" },
    h("div", { class: "wa-head" }, h("div", null, h("p", { class: "rx-kicker" }, "Messagerie"), h("h1", { class: "title" }, "WhatsApp")), statusEl),
    h("p", { class: "muted" }, "Conversations avec vos contacts WhatsApp. Mise à jour automatique toutes les 8 secondes."),
    infoEl,
    h("div", { class: "wa-grid card" },
      h("aside", { class: "wa-side" },
        h("div", { class: "wa-sidehead" }, h("strong", null, "Conversations"),
          h("button", { class: "btn btn-small", type: "button", onClick: () => { composing = true; render(); phoneInput.focus(); } }, "Nouveau")), listEl),
      h("section", { class: "wa-main" }, headEl, threadEl, form)));

  mount(app, root);
  render();
  await Promise.all([loadStatus(), load(true)]);
  const timer = setInterval(() => { if (!root.isConnected) return clearInterval(timer); if (!document.hidden) load(true); }, POLL_MS);
}

function loadCss() {
  const href = "/css/whatsapp.css";
  if (!document.querySelector(`link[href="${href}"]`)) document.head.append(h("link", { rel: "stylesheet", href }));
}
