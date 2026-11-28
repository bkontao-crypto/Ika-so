// Fenêtre « Gestion de vos annonces » : s'affiche à la connexion tant que des annonces sont proches de l'échéance, expirées ou à traiter.
// Les règles (30 jours au plus, vendu seulement pour une vente, louée pour une location…) sont appliquées par le serveur ; ici on guide la saisie.
import { api, fail, h, toast } from "/js/dom.js";
import { S } from "/js/core/state.js";

const DAY = 86_400_000;
const dayStr = (ms) => new Date(ms).toISOString().slice(0, 10); // jours UTC = jours du Mali (UTC+0)
const frDate = (iso) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { timeZone: "UTC" }) : "—");
const LABEL = { SOLD: "Vendu", RENTED: "Louée", ARCHIVED: "Archiver", RENEW: "Prolonger" };
const CONFIRM = {
  SOLD: "Confirmez-vous que ce bien a été vendu ?",
  RENTED: "Confirmez-vous que ce bien a été loué ?",
  ARCHIVED: "Archiver cette annonce ? Elle ne sera plus visible publiquement et restera dans vos archives.",
  RENEW: "Confirmez-vous la nouvelle date d'expiration ?",
};

let shownFor = null; // un seul affichage par connexion et par chargement de la page
let overlay = null;

function close() {
  overlay?.remove();
  overlay = null;
  document.removeEventListener("keydown", onKey);
}
function onKey(e) { if (e.key === "Escape") close(); }

function durationText(item) {
  if (item.days == null) return "";
  if (item.state === "EXPIRING") return item.days <= 1 ? "Dernier jour" : `${item.days} jours restants`;
  return item.days <= 0 ? "Expirée aujourd'hui" : `Expirée depuis ${item.days} jour${item.days > 1 ? "s" : ""}`;
}

function itemRow(item, maxDays, onDone) {
  const select = h("select", { class: "input", "aria-label": `Action pour ${item.title}` },
    h("option", { value: "" }, "Choisir une action…"),
    item.actions.map((a) => h("option", { value: a }, LABEL[a])));
  const date = h("input", { class: "input", type: "date", "aria-label": "Nouvelle date de fin", min: dayStr(Date.now() + DAY), max: dayStr(Date.now() + maxDays * DAY), value: dayStr(Date.now() + maxDays * DAY) });
  date.hidden = true;
  select.addEventListener("change", () => { date.hidden = select.value !== "RENEW"; });
  const ok = h("button", { class: "btn btn-small btn-primary", type: "button" }, "Valider");
  ok.addEventListener("click", async () => {
    const outcome = select.value;
    if (!outcome) { toast("Choisissez d'abord une action."); return; }
    if (!window.confirm(CONFIRM[outcome])) return;
    ok.disabled = true;
    try {
      await api(`/listings/${encodeURIComponent(item.id)}/outcome`, { method: "POST", body: outcome === "RENEW" ? { outcome, until: date.value } : { outcome } });
      toast("Annonce mise à jour.");
      onDone(item.id);
    } catch (error) { ok.disabled = false; fail(error); }
  });
  const expiring = item.state === "EXPIRING";
  return h("li", { class: "card pad stack", style: "list-style:none" },
    h("div", { class: "row", style: "gap:12px;align-items:flex-start" },
      h("img", { src: item.imageUrl, alt: "", width: 72, height: 72, style: "object-fit:cover;border-radius:8px;flex:none" }),
      h("div", { class: "grow stack" },
        h("span", { class: expiring ? "pill pill-gold" : "pill pill-dark" }, expiring ? "Expire bientôt" : "Expirée"),
        h("strong", null, item.title),
        h("p", { class: "small muted" }, `Réf. ${item.reference} · ${item.transactionType}`),
        h("p", { class: "small" }, `Fin de publication : ${frDate(item.expiresAt)} · ${durationText(item)}`),
        item.autoArchiveAt ? h("p", { class: "small muted" }, `Archivage automatique le ${frDate(item.autoArchiveAt)} sans action de votre part.`) : null)),
    h("div", { class: "stack" }, select, date, ok));
}

function render(items, maxDays) {
  close();
  let left = items.length;
  const list = h("ul", { class: "stack", style: "padding:0;margin:0" });
  const done = (id) => {
    list.querySelector(`[data-id="${CSS.escape(id)}"]`)?.remove();
    left -= 1;
    if (left <= 0) close();
  };
  for (const item of items) { const li = itemRow(item, maxDays, done); li.dataset.id = item.id; list.append(li); }
  const panel = h("section", { class: "card pad stack", style: "width:100%;max-width:640px;margin:auto;max-height:92vh;overflow:auto" },
    h("h2", { id: "expiry-title" }, "Gestion de vos annonces"),
    h("p", { class: "muted" }, "Certaines de vos annonces arrivent à expiration ou sont déjà expirées. Veuillez choisir une action pour chacune d'elles."),
    list,
    h("button", { class: "btn btn-quiet", type: "button", onClick: close }, "Plus tard"));
  overlay = h("div", { role: "dialog", "aria-modal": "true", "aria-labelledby": "expiry-title", style: "position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.55);display:flex;padding:12px;overflow:auto" }, panel);
  document.body.append(overlay);
  document.addEventListener("keydown", onKey);
  panel.querySelector("select")?.focus();
}

/** À appeler après chargement de la session et à chaque connexion. Sans annonce concernée, rien ne s'affiche. */
export async function showExpiryAlert({ force = false } = {}) {
  if (!S.user) { shownFor = null; close(); return; }
  if (!force && shownFor === S.user.id) return;
  shownFor = S.user.id;
  try {
    const res = await api("/me/expiry-alerts");
    if (res?.items?.length) render(res.items, Math.min(Number(res.maxExtensionDays) || 30, 30));
  } catch { /* la page « Mes annonces » reste disponible */ }
}
