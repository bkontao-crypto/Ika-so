// Page d'administration « WhatsApp » : envoi rapide et historique des conversations (Meta WhatsApp Cloud API).
// Réservée au personnel autorisé : le serveur refuse tout autre compte (401/403), la page ne fait qu'afficher ce refus.
import { api, h, mount, toast } from "/js/dom.js";

const STATUS = { received: "Reçu", sent: "Envoyé", delivered: "Distribué", read: "Lu", failed: "Échec" };
const POLL_MS = 8000;
const digits = (value) => String(value ?? "").replace(/\D/g, "");
const when = (iso) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

export async function whatsappPage() {
  let messages = [];
  let selected = "";
  let loadFailed = false;

  const banner = h("div", { class: "card notice", hidden: true });
  const phoneInput = h("input", { name: "phone", placeholder: "Numéro avec indicatif, ex. 22370000000", inputmode: "numeric", maxlength: 20, required: true, autocomplete: "off" });
  const textInput = h("textarea", { name: "message", placeholder: "Votre message", rows: 3, maxlength: 4096, required: true });
  const sendButton = h("button", { class: "btn", type: "submit" }, "Envoyer sur WhatsApp");
  const result = h("p", { class: "small", role: "status" });
  const conversationsEl = h("div", { class: "stack", style: "display:grid;gap:8px;align-content:start" });
  const threadEl = h("div", { class: "card", style: "display:flex;flex-direction:column;gap:8px;max-height:60vh;overflow-y:auto" });
  const refreshButton = h("button", { class: "btn btn-outline", type: "button", onClick: () => load(false) }, "Actualiser");

  const form = h("form", {
    class: "card stack",
    style: "display:grid;gap:8px",
    onSubmit: async (event) => {
      event.preventDefault();
      sendButton.disabled = true;
      result.className = "small";
      result.textContent = "Envoi en cours…";
      try {
        await api("/whatsapp/send", { method: "POST", body: { phone: phoneInput.value, message: textInput.value } });
        selected = digits(phoneInput.value);
        textInput.value = "";
        result.textContent = "Message transmis à Meta. Le statut (distribué, lu) s'affiche dès que Meta le confirme.";
        await load(true);
      } catch (error) {
        result.className = "small notice";
        result.textContent = error?.message || "Envoi impossible.";
        await load(true);
      } finally {
        sendButton.disabled = false;
      }
    },
  },
  h("h3", null, "Envoi rapide"),
  phoneInput,
  textInput,
  h("div", { class: "row wrap gap-sm" }, sendButton),
  result,
  h("p", { class: "small muted" }, "Meta n'accepte un message libre que si le contact a écrit au cours des 24 dernières heures ; sinon seul un modèle de message approuvé peut être envoyé."));

  function conversations() {
    const byPhone = new Map();
    for (const m of messages) {
      const entry = byPhone.get(m.phone) ?? { phone: m.phone, name: null, last: m };
      if (m.name) entry.name = m.name;
      entry.last = m;
      byPhone.set(m.phone, entry);
    }
    return [...byPhone.values()].sort((a, b) => new Date(b.last.createdAt) - new Date(a.last.createdAt));
  }

  function bubble(m) {
    const mine = m.direction === "outbound";
    const meta = [when(m.createdAt), mine ? STATUS[m.status] ?? m.status : null].filter(Boolean).join(" · ");
    return h("div", { style: `max-width:80%;padding:8px 12px;border-radius:12px;${mine ? "align-self:flex-end;background:rgba(37,211,102,.18)" : "align-self:flex-start;background:rgba(127,127,127,.18)"}` },
      h("div", { style: "white-space:pre-wrap;word-break:break-word" }, m.text || "—"),
      h("div", { class: "small muted", style: "margin-top:4px" }, meta),
      m.status === "failed" && m.error ? h("div", { class: "small notice", style: "margin-top:4px" }, m.error) : null);
  }

  function render() {
    const list = conversations();
    if (!list.length) {
      conversationsEl.replaceChildren(h("div", { class: "card empty-state" }, h("p", null, loadFailed ? "Historique indisponible." : "Aucun message pour le moment.")));
    } else {
      conversationsEl.replaceChildren(...list.map((c) => h("button", {
        class: c.phone === selected ? "card btn" : "card btn btn-outline",
        type: "button",
        style: "text-align:left;display:block;width:100%",
        onClick: () => { selected = c.phone; phoneInput.value = c.phone; render(); },
      },
      h("strong", null, c.name || `+${c.phone}`),
      h("div", { class: "small" }, `${c.name ? `+${c.phone} · ` : ""}${when(c.last.createdAt)}`),
      h("div", { class: "small muted" }, String(c.last.text ?? "").slice(0, 60)))));
    }
    const nearBottom = threadEl.scrollHeight - threadEl.scrollTop - threadEl.clientHeight < 80;
    const thread = messages.filter((m) => m.phone === selected);
    threadEl.replaceChildren(...(thread.length ? thread.map(bubble) : [h("p", { class: "muted small" }, selected ? "Aucun message avec ce numéro." : "Choisissez une conversation ou saisissez un numéro.")]));
    if (nearBottom) threadEl.scrollTop = threadEl.scrollHeight;
  }

  async function load(silent) {
    try {
      const data = await api("/whatsapp/messages?limit=500");
      messages = data.messages ?? [];
      loadFailed = false;
      if (!selected && messages.length) selected = messages[messages.length - 1].phone;
      render();
    } catch (error) {
      loadFailed = true;
      if (!silent) toast(error?.message || "Historique indisponible.");
      render();
    }
  }

  async function loadStatus() {
    try {
      const info = await api("/whatsapp/status");
      const url = `${location.origin}${info.webhookPath}`;
      banner.hidden = false;
      banner.className = info.configured ? "card" : "card notice";
      banner.replaceChildren(
        h("strong", null, info.configured ? "WhatsApp est configuré sur ce serveur." : "WhatsApp n'est pas encore configuré : l'envoi est impossible."),
        h("p", { class: "small", style: "margin:6px 0" }, `Adresse du webhook à coller dans le tableau de bord Meta : ${url}`),
        h("p", { class: "small muted" }, "Jeton de vérification : la valeur de WHATSAPP_VERIFY_TOKEN. Abonnement à cocher chez Meta : messages."));
    } catch (error) {
      banner.hidden = false;
      banner.className = "card notice";
      banner.replaceChildren(h("strong", null, error?.message || "Accès refusé."), h("p", { class: "small" }, "Cette page est réservée aux administrateurs connectés."));
    }
  }

  const root = h("section", { class: "stack", style: "display:grid;gap:16px;max-width:960px;margin:0 auto" },
    h("h1", { class: "title" }, "WhatsApp"),
    h("p", { class: "muted small" }, "Test d'envoi et historique des conversations. Les messages se mettent à jour automatiquement toutes les 8 secondes."),
    banner,
    form,
    h("div", { class: "row-between" }, h("h3", null, "Conversations"), refreshButton),
    h("div", { style: "display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;align-items:start" }, conversationsEl, threadEl));

  mount(document.getElementById("app") || document.body, root);
  render();
  await Promise.all([loadStatus(), load(true)]);
  setInterval(() => { if (!document.hidden) load(true); }, POLL_MS);
}
