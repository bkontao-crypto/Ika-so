import { api, daysLeft, fail, formatPrice, h, mount, readProofFile, toast } from "/js/dom.js";
import { S, app, clearSession, refreshSession } from "/js/core/state.js";
import { go, needLogin } from "/js/core/router.js";
import { listingCard } from "/js/components/listing-card.js";
import { field } from "/js/components/ui.js";

const STATUS_LABEL = { PENDING: "En attente", PUBLISHED: "En ligne", REJECTED: "Refusée", SOLD: "Vendue", RENTED: "Louée", ARCHIVED: "Archivée", EXPIRED: "Expirée", DRAFT: "Brouillon" };

/** Consentement explicite à la newsletter (facultatif, non précoché, retirable à tout moment). */
function newsletterCard() {
  const box = h("input", { type: "checkbox", disabled: true, onChange: async (e) => {
    try { await api("/me/newsletter", { method: "PUT", body: { subscribed: e.target.checked } }); toast(e.target.checked ? "Abonnement à la newsletter enregistré." : "Désabonnement enregistré."); }
    catch (error) { e.target.checked = !e.target.checked; fail(error); }
  } });
  api("/me/newsletter").then((r) => { box.checked = r.subscribed === true; box.disabled = false; }).catch(() => {});
  return h("article", { class: "card pad stack" },
    h("h2", null, "Newsletter"),
    h("p", { class: "small muted" }, "Facultatif. Ika So ne vous envoie la newsletter que si vous la demandez ici, et vous pouvez l'arrêter à tout moment."),
    h("label", { class: "row" }, box, h("span", null, "Je veux recevoir la newsletter d'Ika So par e-mail")));
}

/** Accès au centre de contrôle des annonceurs Premium certifiés (ou explication de ce qui manque). */
function centreCard(access) {
  if (!access) return null;
  if (access.eligible) return h("article", { class: "card pad stack" }, h("h2", null, "Centre de contrôle Premium"),
    h("p", { class: "small muted" }, `Premium actif jusqu'au ${new Date(access.premiumUntil).toLocaleDateString("fr-FR")}. Statistiques, carte de vos annonces, messages, alertes et échéances.`),
    h("a", { class: "btn btn-gold", href: "#/centre" }, "Ouvrir le centre de contrôle"));
  if (access.premium && !access.certified) return h("article", { class: "card pad stack" }, h("h2", null, "Mon espace"),
    h("p", { class: "small muted" }, "Premium payé mais profil non certifié (agence vérifiée ou titre foncier contrôlé requis)."),
    h("a", { class: "btn", href: "#/profil" }, "Compléter la certification"));
  return h("article", { class: "card pad stack" }, h("h2", null, "Mon espace"),
    h("p", { class: "small muted" }, "Vos annonces, messages et visites au même endroit, avec un aperçu de ce que Premium débloque."),
    h("a", { class: "btn btn-primary", href: "#/centre" }, "Ouvrir mon espace"));
}

export async function minePage() {
  if (needLogin()) return;
  async function act(id, outcome) {
    try { await api(`/listings/${encodeURIComponent(id)}/outcome`, { method: "POST", body: { outcome } }); toast("Annonce mise à jour."); minePage(); } catch (error) { fail(error); }
  }
  const items = await api("/me/listings");
  const proofs = await api("/me/proofs").catch(() => []);
  const PROOF = { PENDING: "pièce en cours de contrôle", ACCEPTED: "pièce acceptée", REFUSED: "pièce refusée" };
  async function sendProof(kind, listingId, file) {
    if (!file) return;
    try {
      await api("/me/proofs", { method: "POST", body: { kind, listingId, fileData: await readProofFile(file) } });
      toast("Pièce envoyée. Une personne de l'équipe la contrôlera.");
      minePage();
    } catch (error) { fail(error); }
  }
  const offers = (await api("/offers").catch(() => ({ offers: [] }))).offers.filter((o) => o.kind !== "PREMIUM");
  async function boost(listingId) {
    const choice = offers.length === 1 ? offers[0] : offers.find((o) => window.confirm(`${o.label} : ${o.priceXof.toLocaleString("fr-FR")} FCFA ? (OK = choisir, Annuler = voir la suivante)`));
    if (!choice) return;
    try {
      const { instructions, paymentUrl } = await api("/payments/checkout", { method: "POST", body: { offerCode: choice.code, listingId } });
      if (paymentUrl) { toast("Redirection vers la page de paiement…"); location.href = paymentUrl; return; }
      toast(instructions);
      location.hash = "#/paiements";
    } catch (error) { fail(error); }
  }
  const ui = await import("/js/components/espace.js"); ui.loadCss();
  const premiumBlock = ui.premiumCard(await api("/me/center/access").catch(() => null), "compte");
  mount(app,
    premiumBlock,
    h("div", { class: "row-between" },
      h("div", null, h("h1", { class: "title" }, "Mes annonces"), h("p", { class: "muted small" }, "Le motif de refus s'affiche ici, sans détour.")),
      h("div", { class: "row" }, offers.length ? h("a", { class: "btn", href: "#/paiements" }, "Mes paiements") : null, h("a", { class: "btn btn-gold", href: "#/publier" }, "Nouvelle annonce"))),
    items.length ? null : h("p", { class: "card pad muted" }, "Vous n'avez pas encore déposé d'annonce."),
    h("ul", { class: "stack" }, items.map((item) => {
      const left = item.expiresAt ? daysLeft(item.expiresAt) : null;
      const expired = item.status === "PUBLISHED" && left != null && left <= 0;
      const btn = (label, onClick, cls = "") => h("button", { class: `btn btn-small ${cls}`, type: "button", onClick }, label);
      return h("li", { class: "card list-item" },
        h("img", { src: item.imageUrl, alt: "" }),
        h("div", { class: "grow" },
          h("span", { class: "pill pill-gold" }, expired ? "Expirée" : STATUS_LABEL[item.status] ?? item.status),
          h("h2", null, item.title),
          h("p", { class: "small muted" }, `${formatPrice(item.price, item.transactionType)} · ${item.neighborhood}`),
          item.status === "PUBLISHED" && left != null
            ? h("p", { class: "small" }, left <= 0 ? "Plus visible : les 45 jours sont passés. Prolongez pour la remettre en ligne." : left <= 7 ? `Visible encore ${left} jour(s).` : null) : null,
          item.moderationNote ? h("p", { class: "small" }, `Motif : ${item.moderationNote}`) : null,
          item.documentVerified ? h("p", { class: "small" }, "Titre foncier contrôlé par l'équipe") : null,
          proofs.filter((p) => p.listingId === item.id).slice(0, 1).map((p) => h("p", { class: "small" }, `Justificatif : ${PROOF[p.status]}${p.note ? ` — ${p.note}` : ""}`))),
        h("div", { class: "row" },
          item.status === "PUBLISHED" ? h("a", { class: "btn btn-small", href: `#/annonce/${encodeURIComponent(item.id)}` }, "Aperçu") : null,
          item.status !== "ARCHIVED" ? h("a", { class: "btn btn-small", href: `#/localiser/${encodeURIComponent(item.id)}` }, "Localiser") : null,
          ["PUBLISHED", "REJECTED", "EXPIRED", "PENDING"].includes(item.status) ? h("a", { class: "btn btn-small", href: `#/modifier/${encodeURIComponent(item.id)}` }, "Modifier") : null,
          item.status === "PUBLISHED" && offers.length ? btn("Mettre à la une", () => boost(item.id), "btn-gold") : null,
          item.status === "PUBLISHED" ? btn("Prolonger 45 jours", () => act(item.id, "RENEW")) : null,
          item.status === "PUBLISHED" ? btn(item.transactionType === "Location" ? "Marquer loué" : "Marquer vendu", () => act(item.id, item.transactionType === "Location" ? "RENTED" : "SOLD")) : null,
          item.status === "REJECTED" || item.status === "EXPIRED" ? btn("Renvoyer", () => act(item.id, "RESUBMIT"), "btn-primary") : null,
          ["PUBLISHED", "PENDING"].includes(item.status) && !item.documentVerified
            ? h("label", { class: "btn btn-small" }, "Joindre un justificatif", h("input", { class: "sr-only", type: "file", accept: "image/*,application/pdf", "aria-label": `Justificatif pour ${item.title}`, onChange: (e) => sendProof("DOCUMENT_FONCIER", item.id, e.target.files?.[0]) })) : null,
          item.status !== "ARCHIVED" ? btn("Archiver", () => act(item.id, "ARCHIVED"), "btn-quiet") : null));
    })));
}

export async function favoritesPage() {
  if (needLogin()) return;
  const items = await api("/me/favorites");
  const favorites = new Set(items.map((i) => i.id));
  mount(app, h("h1", { class: "title" }, "Favoris"),
    items.length ? h("div", { class: "listing-grid" }, items.map((i) => listingCard(i, favorites))) : h("p", { class: "card pad muted" }, "Aucun favori pour le moment."));
}

/** Réglages du compte (rôles, accès, alertes, données…) : contenu de l'onglet « Paramètres & Confidentialité » du profil. */
export async function accountSettings(refresh = () => {}) {
  await refreshSession();
  const m = S.meta;
  const prefs = await api("/me/notify-prefs").catch(() => null);
  const access = await api("/me/center/access").catch(() => null);
  let premiumBlock = null;
  if (access) { const ui = await import("/js/components/espace.js"); ui.loadCss(); premiumBlock = ui.premiumCard(access, "compte"); }
  const stats = await api("/me/analytics-consent").catch(() => null);
  const saveStats = async (accepted) => { try { await api("/me/analytics-consent", { method: "PUT", body: { accepted } }); toast(accepted ? "Statistiques autorisées." : "Statistiques refusées."); refresh(); } catch (error) { fail(error); } };
  const savePrefs = async (body) => { try { await api("/me/notify-prefs", { method: "PUT", body }); toast("Préférences enregistrées."); refresh(); } catch (error) { fail(error); } };
  const status = { ACTIVE: "Actif", RESTRICTED: "Restreint", BANNED: "Bloqué" }[m.accountStatus] ?? m.accountStatus;

  // Profil unique : tous les rôles et accès dans une seule vue
  const roles = [];
  roles.push(h("span", { class: "pill" }, m.displayRole || "Annonceur"));
  if (m.staffRole && m.staffRole !== "USER") roles.push(h("span", { class: "pill pill-dark" }, m.staffRole));
  if (access?.premium) roles.push(h("span", { class: "pill pill-gold" }, "Premium"));
  if (access?.certified) roles.push(h("span", { class: "pill pill-green" }, "Certifié"));

  const accessLinks = [];
  if (m.staffRole === "SUPERADMIN") {
    accessLinks.push(h("a", { class: "btn btn-gold", href: "/owner" }, "Owner Control Center"));
  }
  if (m.staffRole && m.staffRole !== "USER") {
    accessLinks.push(h("a", { class: "btn btn-dark", href: "/admin.html" }, `Centre de contrôle staff${m.pendingCount ? ` (${m.pendingCount})` : ""}`));
  }
  if (access?.eligible) {
    accessLinks.push(h("a", { class: "btn btn-primary", href: "#/centre" }, "Centre Premium"));
  } else if (access?.premium) {
    accessLinks.push(h("a", { class: "btn", href: "#/profil" }, "Compléter la certification"));
  }
  accessLinks.push(h("a", { class: "btn", href: "#/mon-profil-public" }, "Mon profil public"));
  if (access?.premium || m.staffRole !== "USER") {
    accessLinks.push(h("a", { class: "btn btn-outline", href: "#/partenaires" }, "Annonces sponsorisées"));
  }

  return h("div", { class: "stack" },
    h("div", { class: "row", style: "flex-wrap:wrap;gap:8px;margin:12px 0" }, roles),
    h("div", { class: "row", style: "flex-wrap:wrap;gap:8px;margin-bottom:18px" }, accessLinks),
    h("div", { class: "grid" },
      h("article", { class: "card pad stack" },
        h("p", { class: "small muted" }, "Identité"), h("h2", null, m.fullName || S.user.name), h("p", { class: "muted" }, S.user.email),
        h("p", null, `Rôle affiché : ${m.displayRole || "—"}`),
        h("p", null, m.phoneVerified ? `Numéro confirmé : ${m.phone}${m.verifiedBySms ? " (SMS)" : ""}` : "Numéro pas encore vérifié.")),
      h("article", { class: "card pad stack" },
        h("p", { class: "small muted" }, "Compte & permissions"), h("h2", null, status),
        h("p", null, m.staffRole === "USER" ? "Annonceur standard" : `Équipe : ${m.staffRole}`),
        access?.premium ? h("p", null, `Premium actif${access.premiumUntil ? ` jusqu'au ${new Date(access.premiumUntil).toLocaleDateString("fr-FR")}` : ""}`) : h("p", { class: "muted" }, "Premium non actif"),
        m.statusReason ? h("p", null, `Motif : ${m.statusReason}`) : null)),
    m.displayRole && /agence|agent/i.test(m.displayRole) ? h("article", { class: "card pad stack" },
      h("h2", null, "Agence vérifiée"),
      m.agencyVerified ? h("p", { class: "pill pill-green" }, "Votre agence est vérifiée") : null,
      h("p", { class: "small muted" }, "Envoyez votre registre de commerce (RCCM) : une personne de l'équipe le contrôle avant tout badge."),
      h("label", { class: "btn" }, "Envoyer le RCCM", h("input", { class: "sr-only", type: "file", accept: "image/*,application/pdf", "aria-label": "Registre de commerce", onChange: async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try { await api("/me/proofs", { method: "POST", body: { kind: "AGENCE", fileData: await readProofFile(file) } }); toast("Pièce envoyée."); } catch (error) { fail(error); }
      } }))) : null,
    prefs && (prefs.emailAvailable || prefs.smsAvailable) ? h("article", { class: "card pad stack" },
      h("h2", null, "Alertes hors du site"),
      h("p", { class: "small muted" }, "Désactivées par défaut. Vous pouvez les activer ou les couper à tout moment. Aucun message privé n'est jamais recopié dans un e-mail ou un SMS : seulement « vous avez un nouveau message »."),
      prefs.emailAvailable ? h("label", { class: "row" }, h("input", { type: "checkbox", checked: prefs.email, onChange: (e) => savePrefs({ email: e.target.checked, sms: prefs.sms }) }), h("span", null, "Me prévenir par e-mail")) : null,
      prefs.smsAvailable ? h("label", { class: "row" }, h("input", { type: "checkbox", checked: prefs.sms, disabled: !m.phoneVerified, onChange: (e) => savePrefs({ email: prefs.email, sms: e.target.checked }) }), h("span", null, m.phoneVerified ? "Me prévenir par SMS (messages et visites, 5 par jour au plus)" : "Me prévenir par SMS (vérifiez d'abord votre numéro)")) : null) : null,
    stats ? h("article", { class: "card pad stack" },
      h("h2", null, "Statistiques d'usage"),
      h("p", { class: "small muted" }, "Facultatif. Ika So peut compter certaines actions (annonces vues, favoris, contacts) pour s'améliorer. Ni votre adresse IP, ni vos messages, ni votre numéro ne sont enregistrés. Refuser ne change rien à votre usage ; si vous refusez, vos actions restent comptées sans votre nom."),
      h("label", { class: "row" }, h("input", { type: "checkbox", checked: stats.accepted === true, onChange: (e) => saveStats(e.target.checked) }), h("span", null, stats.accepted === true ? "Autorisées" : "Refusées"))) : null,
    premiumBlock,
    centreCard(access),
    h("article", { class: "card pad stack" },
      h("h2", null, "Devenir annonceur"),
      h("p", { class: "small muted" }, "Demandez gratuitement le statut d'annonceur particulier, ou créez une demande pour une agence immobilière."),
      h("div", { class: "row" },
        h("a", { class: "btn btn-primary", href: "#/devenir-annonceur?type=particulier" }, "Annonceur particulier (gratuit)"),
        h("a", { class: "btn", href: "#/devenir-annonceur?type=agence" }, "Devenir agence"))),
    newsletterCard(),
    h("article", { class: "card pad stack" },
      h("h2", null, "Mes données"),
      h("p", { class: "small muted" }, "Vous pouvez télécharger une copie de vos données ou supprimer votre compte (Loi n° 2013-015, art. 12 et 13)."),
      h("a", { class: "btn", href: "/api/me/export", download: "mes-donnees-ika-so.json" }, "Télécharger mes données"),
      h("details", { class: "stack" },
        h("summary", { class: "btn" }, "Supprimer mon compte"),
        h("p", { class: "small" }, "Vos annonces, messages, favoris et pièces envoyées seront effacés. Les paiements déjà faits restent dans la comptabilité, sans votre nom. Cette action est définitive."),
        h("form", { class: "stack", onSubmit: async (e) => {
          e.preventDefault();
          const f = new FormData(e.target);
          try { await api("/me/delete", { method: "POST", body: { password: f.get("password"), confirm: f.get("confirm") } }); clearSession(); toast("Compte supprimé."); go("/"); } catch (error) { fail(error); }
        } },
          field("Mot de passe", h("input", { class: "input", name: "password", type: "password", autocomplete: "current-password", required: true })),
          field("Tapez SUPPRIMER pour confirmer", h("input", { class: "input", name: "confirm", autocomplete: "off", required: true })),
          h("button", { class: "btn btn-dark", type: "submit" }, "Supprimer définitivement")))),
    h("div", { class: "row" },
      h("a", { class: "btn", href: "#/favoris" }, "Mes favoris"),
      h("a", { class: "btn", href: "#/reclamations" }, "Mes réclamations"),
      h("a", { class: "btn", href: "#/agence" }, "Espace agence"),
      h("button", { class: "btn", type: "button", onClick: async () => { await api("/auth/logout", { method: "POST", body: {} }); clearSession(); toast("Déconnecté."); go("/"); } }, "Se déconnecter")));
}

