// Demande du badge Étoile (compte identifié), dans Profil › Paramètres & Confidentialité.
// Affichée seulement quand le superadmin a ouvert le badge. Les pièces sont envoyées une à une (aperçu : nom du fichier seulement) et restent privées.
import { api, fail, h, readProofFile, toast } from "/js/dom.js";

const ACCOUNT_LABEL = { INDIVIDUAL: "Particulier / propriétaire", AGENCY: "Agence immobilière", OTHER: "Autre professionnel" };
const STATUS = { PENDING: "Dossier envoyé : en cours d'étude par l'équipe" };
const day = (d) => (d ? new Date(d).toLocaleDateString("fr-FR") : "");
const fcfa = (n) => `${Number(n).toLocaleString("fr-FR")} FCFA`;

/** Renvoie le bloc à insérer, ou null si le badge n'est pas ouvert (ou si la personne n'est pas connectée). */
export async function starBadgeCard() {
  const info = await api("/star-badge/info").catch(() => null);
  if (!info?.enabled) return null;
  const card = h("div", { class: "mp-card", id: "star-badge" });
  let accountType = "INDIVIDUAL";
  let state = null;

  const infoPanel = (p) => h("div", { class: "mp-hint", role: "region", "aria-label": p.infoTitle, style: { display: "none" }, "data-star-info": "1" },
    h("p", null, p.infoBody),
    h("p", null, h("strong", null, "Pièces demandées selon votre type de compte :")),
    h("ul", null, Object.entries(p.requirements).map(([t, r]) => h("li", null, h("b", null, `${ACCOUNT_LABEL[t]} : `), [...r.required.map((d) => d.label), ...r.optional.map((d) => `${d.label} (facultatif)`)].join(", ")))),
    h("p", null, [p.priceXof > 0 || p.paymentRequired ? `Prix : ${p.priceXof > 0 ? fcfa(p.priceXof) : "gratuit"}. ` : "", `Validité : ${p.durationMonths} mois. Réponse sous ${p.reviewDelayDays} jours environ.`]),
    h("p", null, h("strong", null, p.warningText)));

  async function paint() {
    state = await api("/star-badge/mine").catch(() => null);
    if (!state) { card.replaceChildren(); return; }
    const p = state.policy;
    const r = state.request;
    const open = r && ["DRAFT", "PENDING"].includes(r.status);
    const panel = infoPanel(p);
    const infoBtn = h("button", { class: "mp-btn mp-btn-outline sm", type: "button", "aria-expanded": "false", onClick: () => { const show = panel.style.display === "none"; panel.style.display = show ? "" : "none"; infoBtn.setAttribute("aria-expanded", String(show)); } }, "C'est quoi un compte certifié ?");
    const parts = [h("h3", null, "Badge Étoile : compte certifié"),
      h("p", { class: "mp-hint" }, "Faites vérifier votre identité pour afficher une étoile de confiance sur votre profil et vos annonces. Ce badge est indépendant du Premium."), infoBtn, panel];
    // Badge actif, motif d'un refus ou d'un retrait : visibles avant le formulaire.
    if (state.badge) parts.push(h("p", { class: "mp-hint" }, h("strong", null, `Compte certifié : badge Étoile valable jusqu'au ${day(state.badge.validUntil)}.`)));
    if (r && ["REJECTED", "REVOKED"].includes(r.status)) parts.push(h("p", { class: "mp-hint" }, `${r.status === "REVOKED" ? "Badge retiré" : "Demande non retenue"}${r.revokedAt || r.decidedAt ? ` le ${day(r.revokedAt ?? r.decidedAt)}` : ""} : ${r.revokedNote || r.decidedNote || "motif non précisé"}.`));
    const canApply = open || !state.badge || state.badge.renewable; // un badge actif n'a pas besoin d'une nouvelle demande, sauf renouvellement (30 jours avant la fin)

    if (r?.status === "PENDING") {
      parts.push(h("p", null, h("strong", null, STATUS.PENDING), r.reviewDueAt ? ` (réponse attendue avant le ${day(r.reviewDueAt)})` : ""),
        h("p", { class: "mp-hint" }, `Étapes : ${p.steps.map((x) => `${x.label} ${r.progress[x.step - 1] ? "✓" : "…"}`).join(" · ")}`),
        h("ul", null, r.documents.map((d) => h("li", null, d.label))),
        h("button", { class: "mp-btn mp-btn-outline sm danger", type: "button", onClick: async () => { if (!window.confirm("Retirer votre dossier ? Les pièces envoyées seront supprimées.")) return; try { await api("/star-badge/cancel", { method: "POST", body: {} }); toast("Dossier retiré."); await paint(); } catch (error) { fail(error); } } }, "Retirer mon dossier"));
    } else if (canApply) {
      if (open) accountType = r.accountType;
      const typeSel = h("select", { class: "input", "aria-label": "Type de compte", disabled: Boolean(open), onChange: () => { accountType = typeSel.value; paint(); } },
        Object.entries(ACCOUNT_LABEL).map(([v, l]) => h("option", { value: v, selected: v === accountType }, l)));
      const req = p.requirements[accountType];
      const have = new Map((r?.documents ?? []).map((d) => [d.kind, d]));
      const row = (d, required) => {
        const input = h("input", { class: "sr-only", type: "file", accept: "image/*,application/pdf", "aria-label": d.label, onChange: async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try { await api("/star-badge/documents", { method: "POST", body: { accountType, kind: d.kind, fileData: await readProofFile(file) } }); toast("Pièce enregistrée (privée)."); await paint(); } catch (error) { fail(error); }
        } });
        return h("li", null, h("span", null, `${d.label}${required ? " (obligatoire)" : " (facultatif, recommandé)"} : `), h("span", { class: have.has(d.kind) ? "ok" : "warn" }, have.has(d.kind) ? "envoyée" : "à envoyer"), " ",
          h("button", { class: "mp-btn mp-btn-outline sm", type: "button", onClick: () => input.click() }, have.has(d.kind) ? "Remplacer" : "Choisir le fichier"), input);
      };
      const phone = h("input", { class: "input", type: "tel", maxlength: "20", placeholder: "Numéro joignable", "aria-label": "Numéro de téléphone", value: r?.phone ?? "" });
      const message = h("textarea", { class: "input", maxlength: "500", rows: "3", placeholder: "Message pour l'équipe (facultatif)", "aria-label": "Message" });
      const terms = h("input", { type: "checkbox", id: "star-terms" });
      const missing = req.required.filter((d) => !have.has(d.kind));
      parts.push(h("label", { class: "field" }, "Type de compte", typeSel),
        h("ul", null, req.required.map((d) => row(d, true)), req.optional.map((d) => row(d, false))),
        p.requirePhone ? h("p", { class: "mp-hint" }, "Votre numéro de téléphone doit être confirmé par code (voir « Vérification » ci-dessus).") : null,
        h("form", { class: "stack", onSubmit: async (e) => {
          e.preventDefault();
          try { const out = await api("/star-badge/submit", { method: "POST", body: { phone: phone.value, message: message.value, acceptTerms: terms.checked } }); toast(`Dossier envoyé. Réponse sous ${out.reviewDelayDays} jours environ.`); await paint(); } catch (error) { fail(error); }
        } }, phone, message, h("label", { class: "row", for: "star-terms" }, terms, h("span", null, "Je certifie l'exactitude des pièces et j'accepte leur examen par l'équipe IKA SO.")),
          h("button", { class: "mp-btn mp-btn-primary", type: "submit", disabled: !open || missing.length > 0, title: missing.length ? `Pièces manquantes : ${missing.map((d) => d.label).join(", ")}` : "" }, "Envoyer mon dossier")),
        open ? h("button", { class: "mp-btn mp-btn-outline sm danger", type: "button", onClick: async () => { if (!window.confirm("Abandonner ce dossier ? Les pièces déjà envoyées seront supprimées.")) return; try { await api("/star-badge/cancel", { method: "POST", body: {} }); await paint(); } catch (error) { fail(error); } } }, "Abandonner le dossier") : null);
    }
    card.replaceChildren(...parts.filter(Boolean));
  }
  await paint();
  return card;
}
