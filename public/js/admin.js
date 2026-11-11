// Centre de contrôle : tout le contrôle des droits est fait côté serveur ; cette page ne fait qu'afficher.
import { api, fail, formatDate, formatPrice, h, mount, toast } from "/js/dom.js";
import { startDecorating } from "/js/decorate.js";

startDecorating();

let trust = { proofs: [], alerts: [], commentReports: [], userReports: [], reviewReports: [] };
let blacklist = [];
let offers = [];
let recon = null;
let sheetView = null; let compareView = null; let compareSel = []; let rankView = null; let statsView = null; let statsDays = 7; let statsError = null;

const app = document.getElementById("app");

/** Graphique en barres SVG (aucune bibliothèque) dans une boîte de dialogue accessible : titre, valeurs lisibles, tableau de repli. */
function barChartDialog(title, series) {
  const NS = "http://www.w3.org/2000/svg";
  const el = (name, attrs = {}, text) => { const n = document.createElementNS(NS, name); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v)); if (text != null) n.textContent = text; return n; };
  const W = 640; const H = 220; const padL = 34; const padB = 26; const padT = 12;
  const charts = series.map(({ label, rows }) => {
    const max = Math.max(1, ...rows.map((r) => r.n));
    const bw = rows.length ? (W - padL - 8) / rows.length : 0;
    const total = rows.reduce((a, r) => a + r.n, 0);
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `${label} : ${total} sur ${rows.length} jours, maximum ${max} par jour`, style: { width: "100%", height: "auto", maxWidth: "640px" } });
    for (const frac of [0, 0.5, 1]) {
      const y = padT + (H - padT - padB) * (1 - frac);
      svg.append(el("line", { x1: padL, x2: W - 8, y1: y, y2: y, stroke: "currentColor", "stroke-opacity": 0.15 }), el("text", { x: padL - 4, y: y + 4, "text-anchor": "end", "font-size": 11, fill: "currentColor" }, Math.round(max * frac)));
    }
    rows.forEach((r, i) => {
      const bh = (H - padT - padB) * (r.n / max);
      const x = padL + i * bw;
      const bar = el("rect", { x: x + 1, y: H - padB - bh, width: Math.max(1, bw - 2), height: bh, rx: 2, fill: "var(--leaf, #1e6b50)" });
      bar.append(el("title", {}, `${r.day} : ${r.n}`));
      svg.append(bar);
      if (rows.length <= 10 || i % Math.ceil(rows.length / 8) === 0) svg.append(el("text", { x: x + bw / 2, y: H - 8, "text-anchor": "middle", "font-size": 10, fill: "currentColor" }, String(r.day).slice(5)));
    });
    return h("section", { class: "stack" }, h("h3", null, `${label} (total ${total})`), rows.length ? svg : h("p", { class: "muted" }, "Aucune donnée sur la période."));
  });
  const dlg = h("dialog", { "aria-label": title }, h("div", { class: "pad stack" }, h("h2", null, title), ...charts, h("button", { class: "btn", type: "button", onClick: () => dlg.close() }, "Fermer")));
  dlg.style.width = "min(700px, calc(100vw - 32px))";
  dlg.addEventListener("close", () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
}
const ACTIONS = {
  APPROVE: "Annonce approuvée", REJECT: "Annonce refusée", FEATURE: "Mise à la une", UNFEATURE: "Retrait de la une",
  SANCTION: "Sanction de compte", RANKING_WEIGHTS: "Pondérations des classements modifiées", HIDE_PROFILE_IMAGES: "Photos de profil masquées", SHOW_PROFILE_IMAGES: "Photos de profil rétablies", STAFF_ROLE: "Changement de rôle", DISMISS_REPORT: "Signalement ignoré",
  LISTING_SUBMIT: "Annonce soumise", LISTING_EDIT: "Annonce modifiée", HIDE_COMMENT: "Commentaire masqué", HIDE_REVIEW: "Avis masqué", DISMISS_REVIEW_REPORTS: "Signalements d'avis écartés", VIEW_PROOF: "Pièce consultée", VIEW_ADVERTISER_SHEET: "Fiche annonceur consultée", OFFER_SET: "Offre modifiée", PAYMENT_REFUND: "Remboursement noté (fait chez le fournisseur)", PAYMENT_REFUND_PARTIAL: "Remboursement partiel à traiter à la main", PROOF_ACCEPT: "Pièce acceptée", PROOF_REFUSE: "Pièce refusée", BADGE_REVOKE: "Badge retiré", BLACKLIST_ADD: "Ajout liste noire", BLACKLIST_REMOVE: "Retrait liste noire", ALERT_CLOSE: "Alerte close", DISMISS_COMMENT_REPORTS: "Signalements de commentaire écartés", DISMISS_USER_REPORTS: "Signalements de personne écartés",
};
let tab = "pending";
let data = null;
let accounts = [];
let me = null;
let homepageConfig = null;
let homepageDraft = null;

// ---------- Retour arrière : chaque changement d'onglet ou de vue détaillée s'empile, le bouton « Retour » et le retour du navigateur le défont ----------
const backStack = [];
function pushNav(undo) { backStack.push(undo); history.pushState({ adm: backStack.length }, ""); }
function goBack() { if (backStack.length) history.back(); else location.href = "/#/profil"; }
window.addEventListener("popstate", () => {
  const undo = backStack.pop();
  if (undo) { undo(); draw(); }
});

async function load() {
  const session = await api("/me");
  me = session.meta;
  if (!session.user) {
    return mount(app, h("div", { class: "card pad stack" }, h("h1", { class: "title" }, "Centre de contrôle"),
      h("p", null, "Ouvrez une session de l'équipe pour continuer."), h("a", { class: "btn btn-primary", href: "/#/connexion?next=%2Fprofil" }, "Connexion")));
  }
  try {
    [data, accounts, trust] = await Promise.all([api("/staff/queue"), api("/staff/accounts"), api("/staff/trust")]);
    const isAdmin = ["ADMIN", "SUPERADMIN"].includes(me.staffRole);
    blacklist = isAdmin ? await api("/staff/blacklist") : [];
    [offers, recon] = isAdmin ? await Promise.all([api("/staff/offers"), api("/staff/payments/reconcile")]) : [[], null];
    if (isAdmin) { homepageConfig = await api("/homepage-settings"); homepageDraft = { ...homepageConfig }; }
  } catch (error) {
    return mount(app, h("div", { class: "card pad stack" }, h("h1", { class: "title" }, "Centre de contrôle"), h("p", { class: "notice" }, error.message)));
  }
  draw();
}

async function run(request, message) {
  try { await request(); toast(message); await load(); } catch (error) { fail(error); }
}

const ask = (label, min = 3) => {
  const value = (window.prompt(label) ?? "").trim();
  return value.length >= min ? value : null;
};

function draw() {
  const s = data.stats;
  const trend = s.contacts7d - s.contactsPrev7d;
  const stat = (label, value, note) => h("div", { class: "card stat" }, h("span", { class: "small muted" }, label), h("strong", null, String(value)), note ? h("span", { class: "small muted" }, note) : null);
  const tabs = [["pending", `File (${data.pending.length})`], ["apps", "Demandes annonceurs"], ["trust", `Confiance (${trust.proofs.length + trust.alerts.length + trust.commentReports.length + trust.userReports.length + (trust.reviewReports?.length ?? 0)})`], ["reports", `Signalements (${data.reports.length})`], ["online", "En ligne"], ["pay", `Paiements${recon?.toReview.length ? ` (${recon.toReview.length})` : ""}`], ["journal", "Journal"], ["accounts", `Comptes (${accounts.length})`]];
  if (["ADMIN", "SUPERADMIN"].includes(me.staffRole)) tabs.push(["stats", "Statistiques"]);
  mount(app,
    backStack.length ? h("button", { class: "back-btn back-admin", type: "button", onClick: goBack, "aria-label": "Retour à l'écran précédent" }, h("span", { "aria-hidden": "true" }, "←"), h("span", null, "Retour")) : null,
    h("section", { class: "hero" }, h("p", { class: "eyebrow" }, "Centre de contrôle"), h("h1", null, "Ce qui se passe sur Ika So"),
      h("p", null, `Connecté en tant que ${me.fullName || "membre de l'équipe"} · ${me.staffRole}`),
      me.staffRole === "SUPERADMIN" ? h("a", { class: "btn btn-gold", href: "/owner" }, "Ouvrir le Owner Control Center") : null),
    h("div", { class: "stat-grid", role: "group", "aria-label": "Statistiques" },
      stat("En attente", s.pending), stat("En ligne", s.published), stat("Signalements ouverts", s.openReports),
      stat("Nouvelles annonces (7 j)", s.newListings7d),
      stat("Contacts (7 j)", s.contacts7d, `${trend >= 0 ? "+" : ""}${trend} par rapport aux 7 jours précédents`)),
    h("div", { class: "tabs admin-tabs", id: "admin-tabs", role: "tablist" }, tabs.map(([key, label]) =>
      h("button", { type: "button", role: "tab", "aria-selected": String(tab === key), onClick: () => { if (key !== tab) { const before = tab; pushNav(() => { tab = before; }); } tab = key; if (key === "stats" && !statsView) loadStats(); draw(); } }, label))),
    h("div", { class: "stack" }, panel()));

  // Hamburger for mobile tabs
  const burger = document.getElementById("admin-burger");
  const tabsEl = document.getElementById("admin-tabs");
  if (burger && tabsEl) {
    burger.style.display = window.innerWidth <= 900 ? "" : "none";
    burger.onclick = () => tabsEl.classList.toggle("open");
  }
  const logoutBtn = document.getElementById("admin-logout");
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      try { await api("/auth/logout", { method: "POST", body: {} }); location.href = "/"; } catch { location.href = "/"; }
    };
  }
}

function panel() {
  if (tab === "stats") return statsPanel();
  if (tab === "homepage") return homepagePanel();
  if (tab === "pending") {
    if (!data.pending.length) return h("p", { class: "card pad muted" }, "Rien en attente.");
    return data.pending.map((item) => h("article", { class: "card list-item" },
      h("img", { src: item.imageUrl, alt: "" }),
      h("div", { class: "grow" },
        h("span", { class: "pill pill-gold" }, "EN ATTENTE"), h("h2", null, item.title),
        h("p", { class: "small muted" }, `${item.transactionType} · ${item.category} · ${item.neighborhood} · ${formatPrice(item.price, item.transactionType)}`),
        h("p", { class: "small muted" }, `${item.ownerName} · ${item.ownerPhone}${item.phoneVerified ? " · numéro vérifié par SMS" : ""}`),
        h("p", { class: "small" }, `Document déclaré : ${item.declaredDocument ?? "non précisé"} — sans garantie.`),
        item.similarIds?.length ? h("p", { class: "notice" }, `Doublon possible : ${item.similarIds.length} annonce(s) très proche(s) — `, item.similarIds.map((id) => h("a", { href: `/#/annonce/${encodeURIComponent(id)}`, class: "small" }, `${id.slice(0, 8)} `))) : null),
      h("div", { class: "row" },
        h("button", { class: "btn btn-small btn-primary", type: "button", onClick: () => run(() => api(`/staff/listings/${encodeURIComponent(item.id)}/decision`, { method: "POST", body: { action: "APPROVE" } }), "Annonce publiée.") }, "Approuver"),
        h("button", { class: "btn btn-small", type: "button", onClick: () => {
          const reason = ask("Motif du refus, obligatoire :");
          if (reason) run(() => api(`/staff/listings/${encodeURIComponent(item.id)}/decision`, { method: "POST", body: { action: "REJECT", reason } }), "Annonce refusée.");
        } }, "Refuser"))));
  }
  if (tab === "apps") return appsPanel();
  if (tab === "trust") return trustPanel();
  if (tab === "reports") {
    if (!data.reports.length) return h("p", { class: "card pad muted" }, "Aucun signalement ouvert.");
    return data.reports.map((r) => h("article", { class: "card list-item" },
      h("div", { class: "grow" }, h("span", { class: "pill pill-gold" }, r.reason), h("h2", null, r.title), h("p", { class: "small muted" }, r.details || "Sans précision.")),
      h("div", { class: "row" },
        h("a", { class: "btn btn-small", href: `/#/annonce/${encodeURIComponent(r.listingId)}` }, "Voir"),
        h("button", { class: "btn btn-small", type: "button", onClick: () => run(() => api(`/staff/reports/${encodeURIComponent(r.id)}/dismiss`, { method: "POST", body: {} }), "Signalement ignoré.") }, "Ignorer"))));
  }
  if (tab === "online") {
    const canFeature = ["ADMIN", "SUPERADMIN"].includes(me.staffRole);
    if (!data.online.length) return h("p", { class: "card pad muted" }, "Aucune annonce en ligne.");
    return data.online.map((item) => h("article", { class: "card list-item" },
      h("div", { class: "grow" }, h("h2", null, item.title), h("p", { class: "small muted" }, `${item.neighborhood}${item.featured ? " · À la une" : ""}`)),
      canFeature ? h("button", { class: "btn btn-small btn-gold", type: "button", onClick: () => run(() => api(`/staff/listings/${encodeURIComponent(item.id)}/feature`, { method: "POST", body: { on: !item.featured } }), item.featured ? "Retirée de la une." : "À la une pour 7 jours.") }, item.featured ? "Retirer de la une" : "Mettre à la une") : null));
  }
  if (tab === "pay") return payPanel();
  if (tab === "journal") {
    if (!data.journal.length) return h("p", { class: "card pad muted" }, "Le journal est vide.");
    return data.journal.map((e) => h("p", { class: "card pad small" }, h("strong", null, ACTIONS[e.action] ?? e.action), ` · ${formatDate(e.createdAt)}`, e.note ? ` · ${e.note}` : "", e.listingId ? ` · annonce ${e.listingId}` : ""));
  }
  const isSuper = me.staffRole === "SUPERADMIN";
  return accounts.map((a) => h("article", { class: "card list-item" },
    h("div", { class: "grow" }, h("h2", null, a.fullName), h("p", { class: "small muted" }, `${a.staffRole} · ${a.accountStatus}${a.phone ? ` · ${a.phone}` : ""}`), a.statusReason ? h("p", { class: "small" }, `Motif : ${a.statusReason}`) : null),
    h("div", { class: "row" },
      isSuper ? h("select", { class: "input", "aria-label": `Rôle de ${a.fullName}`, onChange: (e) => run(() => api(`/staff/accounts/${encodeURIComponent(a.userId)}/role`, { method: "POST", body: { role: e.target.value } }), "Rôle mis à jour.") },
        ["USER", "MODERATOR", "ADMIN", "SUPERADMIN"].map((r) => h("option", { value: r, selected: r === a.staffRole }, r))) : null,
      h("button", { class: "btn btn-small", type: "button", onClick: () => run(() => api(`/staff/accounts/${encodeURIComponent(a.userId)}/status`, { method: "POST", body: { status: "ACTIVE" } }), "Compte réactivé.") }, "Réactiver"),
      h("button", { class: "btn btn-small", type: "button", onClick: () => { const reason = ask("Motif de la restriction, obligatoire :"); if (reason) run(() => api(`/staff/accounts/${encodeURIComponent(a.userId)}/status`, { method: "POST", body: { status: "RESTRICTED", reason } }), "Compte restreint."); } }, "Restreindre"),
      ["ADMIN", "SUPERADMIN"].includes(me.staffRole) ? h("button", { class: "btn btn-small", type: "button", title: "Génère un lien à transmettre à la personne (valable 30 minutes)", onClick: async () => {
        try { const r = await api(`/staff/accounts/${encodeURIComponent(a.userId)}/reset-link`, { method: "POST", body: {} }); window.prompt(`Lien de réinitialisation pour ${a.fullName} (valable ${r.validMinutes} min, usage unique). Transmettez-le uniquement à cette personne :`, r.link); } catch (error) { fail(error); }
      } }, "Lien mot de passe") : null,
      h("button", { class: "btn btn-small btn-dark", type: "button", onClick: () => { const reason = ask("Motif du blocage, obligatoire :"); if (reason) run(() => api(`/staff/accounts/${encodeURIComponent(a.userId)}/status`, { method: "POST", body: { status: "BANNED", reason } }), "Compte bloqué."); } }, "Bloquer"))));
}

function homepagePanel() {
  if (!homepageDraft) return h("p", { class: "card pad muted" }, "Configuration indisponible.");
  const fields = [
    ["image", "Photo d’arrière-plan (importée, ou fichier /media/… du site)", "/media/ma-photo.jpg"],
    ["badge", "Petit bandeau supérieur", "L’immobilier au Mali, en toute confiance"],
    ["titleLine1", "Titre – première ligne", "Trouvez votre"],
    ["titleLine2", "Titre – deuxième ligne", "bien immobilier idéal"],
    ["subtitle", "Texte descriptif", "Maisons, appartements…"],
    ["assurance1", "Avantage 1", "Annonces modérées"],
    ["assurance2", "Avantage 2", "Téléphones vérifiés"],
    ["assurance3", "Avantage 3", "Contact direct"],
    ["trustTitle", "Titre du macaron confiance", "Confiance"],
    ["trustLine1", "Ligne 1 du macaron", "Sécurité"],
    ["trustLine2", "Ligne 2 du macaron", "Sérénité"],
    ["overlayColor", "Couleur de l’overlay (hex)", "#091f19"],
    ["overlayOpacity", "Opacité de l’overlay (0 à 1)", "0.75"],
    ["accentColor", "Couleur d’accent (titre, badge)", "#C9EF75"],
    ["textColor", "Couleur du texte principal", "#ffffff"],
  ];
  const preview = h("section", { class: "hero-bg homepage-preview", style: {
    "--hero-photo": `url("${homepageDraft.image}")`,
    "--hero-overlay": homepageDraft.overlayColor || "#091f19",
    "--hero-overlay-opacity": homepageDraft.overlayOpacity || "0.75",
    "--hero-accent": homepageDraft.accentColor || "#C9EF75",
    "--hero-text": homepageDraft.textColor || "#ffffff",
  } },
    h("div", { class: "hero-shade" }),
    h("div", { class: "hero-content" },
      h("div", { class: "hero-copy" }, h("p", { class: "hero-badge", id: "hp-preview-badge" }, homepageDraft.badge),
        h("h1", null, homepageDraft.titleLine1, h("br"), h("em", { id: "hp-preview-title" }, homepageDraft.titleLine2)),
        h("p", { class: "hero-lead", id: "hp-preview-subtitle" }, homepageDraft.subtitle),
        h("div", { class: "hero-assurances" }, ["assurance1", "assurance2", "assurance3"].map((k) => h("span", { "data-hp": k }, homepageDraft[k])))),
      h("div", { class: "hero-trust" }, h("span", { class: "trust-check" }, "OK"), h("strong", { id: "hp-preview-trust" }, homepageDraft.trustTitle),
        h("span", { "data-hp": "trustLine1" }, homepageDraft.trustLine1), h("span", { "data-hp": "trustLine2" }, homepageDraft.trustLine2))));
  const controls = fields.map(([key, label, placeholder]) => {
    const isColor = ["overlayColor", "accentColor", "textColor"].includes(key);
    const isOpacity = key === "overlayOpacity";
    let val = homepageDraft[key] ?? "";
    if (isColor && /^#[0-9a-fA-F]{3}$/.test(val)) {
      val = "#" + val[1]+val[1]+val[2]+val[2]+val[3]+val[3];
      homepageDraft[key] = val;
    }
    const input = h("input", {
      class: "input",
      type: isColor ? "color" : isOpacity ? "range" : "text",
      value: val,
      placeholder,
      maxlength: key === "image" ? 1200 : 300,
      min: isOpacity ? "0" : undefined,
      max: isOpacity ? "1" : undefined,
      step: isOpacity ? "0.05" : undefined,
      onInput: (event) => {
      homepageDraft[key] = event.target.value;
      if (["overlayColor", "overlayOpacity", "accentColor", "textColor"].includes(key)) {
        const varMap = { overlayColor: "--hero-overlay", overlayOpacity: "--hero-overlay-opacity", accentColor: "--hero-accent", textColor: "--hero-text" };
        preview.style.setProperty(varMap[key], event.target.value);
      }
      const target = key === "image" ? null : key === "badge" ? preview.querySelector("#hp-preview-badge") : key === "titleLine1" ? null : key === "titleLine2" ? preview.querySelector("#hp-preview-title") : key === "subtitle" ? preview.querySelector("#hp-preview-subtitle") : key === "trustTitle" ? preview.querySelector("#hp-preview-trust") : preview.querySelector(`[data-hp="${key}"]`);
      if (target) target.textContent = event.target.value;
      if (key === "titleLine1") preview.querySelector("h1").firstChild.textContent = event.target.value;
      if (key === "image") preview.style.setProperty("--hero-photo", `url("${event.target.value.replaceAll('"', '')}")`);
    } });
    if (key !== "image") return h("label", { class: "field" }, h("span", null, label), input);
    const fileInput = h("input", { class: "input", type: "file", accept: "image/jpeg,image/png,image/webp", "aria-label": "Choisir une photo depuis le téléphone" });
    const uploadStatus = h("span", { class: "small muted", role: "status" }, "JPEG, PNG ou WebP · 2 Mo maximum.");
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0]; if (!file) return;
      if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 2 * 1024 * 1024) {
        uploadStatus.textContent = "Format non accepté ou fichier supérieur à 2 Mo."; fileInput.value = ""; return;
      }
      try {
        uploadStatus.textContent = "Envoi de la photo…";
        const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error("Lecture de la photo impossible.")); reader.readAsDataURL(file); });
        const result = await api("/staff/homepage-image", { method: "POST", body: { dataUrl } });
        homepageDraft.image = result.image; input.value = result.image;
        preview.style.setProperty("--hero-photo", `url("${result.image}")`);
        uploadStatus.textContent = "Photo importée : elle apparaît dans l’aperçu mais ne sera publique qu’après « Enregistrer les modifications ».";
      } catch (error) { uploadStatus.textContent = error.message; }
      finally { fileInput.value = ""; }
    });
    return h("div", { class: "field" }, h("label", null, h("span", null, label), input), h("label", null, h("span", null, "Importer depuis mon téléphone"), fileInput), uploadStatus);
  });
  const save = h("button", { class: "btn btn-primary", type: "button", onClick: async () => {
    try { homepageConfig = await api("/staff/homepage-settings", { method: "PUT", body: homepageDraft }); homepageDraft = { ...homepageConfig }; toast("Page d’accueil enregistrée."); }
    catch (error) { fail(error); }
  } }, "Enregistrer les modifications");
  const reset = h("button", { class: "btn btn-small", type: "button", onClick: async () => {
    homepageDraft = { ...homepageConfig }; draw(); toast("Modifications locales annulées.");
  } }, "Annuler les modifications");
  const previewLink = h("a", {
    class: "btn btn-small",
    href: "/",
    target: "_blank",
    rel: "noopener noreferrer",
    title: "Ouvre la page d’accueil publique dans un nouvel onglet (version actuellement publiée)"
  }, "Prévisualiser la page d’accueil");
  const scrollToPreview = h("button", {
    class: "btn btn-small",
    type: "button",
    onClick: () => {
      const el = document.querySelector(".homepage-preview");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, "Voir l’aperçu du brouillon");
  return h("section", { class: "stack" },
    h("div", { class: "card pad stack" }, h("h2", null, "Personnalisation de la page d’accueil"),
      h("p", { class: "muted small" }, "Modifiez les textes et la photo sans modifier le code. L’aperçu se met à jour pendant la saisie. Importez une photo JPEG, PNG ou WebP depuis votre téléphone (2 Mo maximum) : elle reste en attente, visible seulement ici, jusqu’à l’enregistrement. « Annuler » revient à la dernière version enregistrée."),
      h("div", { class: "grid" }, controls),
      h("div", { class: "row" }, save, reset, previewLink, scrollToPreview)),
    h("div", { class: "stack" }, h("h2", null, "Aperçu en direct du brouillon"), preview));
}



const post = (path, body) => api(path, { method: "POST", body });

async function openProof(id) {
  try {
    const { fileData } = await api(`/staff/proofs/${encodeURIComponent(id)}/file`);
    const bytes = Uint8Array.from(atob(fileData.split(",")[1]), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: fileData.slice(5, fileData.indexOf(";")) }));
    window.open(url, "_blank", "noopener");
  } catch (error) { fail(error); }
}

function appsPanel() {
  let apps = [];
  const host = h("div", { class: "stack" });
  (async () => {
    try {
      apps = await api("/staff/advertiser-applications?status=PENDING");
      mount(host,
        h("h2", null, `Demandes annonceurs en attente (${apps.length})`),
        apps.length ? apps.map((a) => h("article", { class: "card pad stack" },
          h("div", { class: "row-between" },
            h("strong", null, a.full_name || a.user_name || a.user_id),
            h("span", { class: "pill" }, a.type === "AGENCE" ? `AGENCE · RCCM : ${({ PENDING: "à contrôler", ACCEPTED: "accepté", REFUSED: "refusé" })[a.agency_proof_status] || "aucun"}` : a.type)),
          h("p", { class: "small muted" }, a.data?.description || "Aucune description."),
          (a.documents || []).length ? h("div", { class: "row" }, (a.documents || []).map((d) => h("button", { class: "btn btn-small", type: "button", onClick: async () => {
            try {
              const { fileData } = await api(`/staff/advertiser-applications/${encodeURIComponent(a.id)}/documents/${encodeURIComponent(d.id)}`);
              const bytes = Uint8Array.from(atob(fileData.split(",")[1]), (c) => c.charCodeAt(0));
              window.open(URL.createObjectURL(new Blob([bytes], { type: fileData.slice(5, fileData.indexOf(";")) })), "_blank", "noopener");
            } catch (error) { fail(error); }
          } }, `Voir : ${d.label === "PIECE_IDENTITE" ? "pièce d'identité" : d.label === "RCCM" ? "RCCM" : "justificatif"}`))) : h("p", { class: "small muted" }, "Aucune pièce jointe (facultatif)."),
          // Justificatif d'agence (RCCM) : même circuit que la certification d'agence ; l'approbation de la demande n'en dépend pas (facultatif).
          a.type === "AGENCE" ? h("div", { class: "row" },
            a.agency_proof_id
              ? [h("button", { class: "btn btn-small", type: "button", onClick: () => openProof(a.agency_proof_id) }, "Voir : RCCM de l'agence"),
                a.agency_proof_status === "PENDING" && ["ADMIN", "SUPERADMIN"].includes(me.staffRole) ? [
                  h("button", { class: "btn btn-small btn-primary", type: "button", onClick: () => {
                    const note = ask("Qu'avez-vous contrôlé ? (greffe, numéro RCCM), obligatoire :");
                    if (!note) return;
                    const agencyName = ask("Nom de l'agence, obligatoire :", 2);
                    if (!agencyName) return;
                    run(() => post(`/staff/proofs/${encodeURIComponent(a.agency_proof_id)}/decision`, { action: "ACCEPT", note, agencyName }), "RCCM accepté, badge « Agence vérifiée » donné.");
                  } }, "RCCM contrôlé : accepter"),
                  h("button", { class: "btn btn-small", type: "button", onClick: () => {
                    const note = ask("Motif du refus du RCCM, obligatoire :");
                    if (note) run(() => post(`/staff/proofs/${encodeURIComponent(a.agency_proof_id)}/decision`, { action: "REFUSE", note }), "RCCM refusé.");
                  } }, "RCCM : refuser"),
                ] : h("span", { class: "small muted" }, `RCCM ${({ PENDING: "à contrôler", ACCEPTED: "accepté", REFUSED: "refusé" })[a.agency_proof_status] || ""}`),
              ]
              : h("span", { class: "small muted" }, "Aucun RCCM déposé (facultatif)."),
          ) : null,
          h("p", { class: "small" }, `Demandé : ${a.display_role_requested || "—"} · ${new Date(a.created_at).toLocaleDateString("fr-FR")}`),
          h("div", { class: "row" },
            h("button", { class: "btn btn-small btn-primary", type: "button", onClick: () => run(() => api(`/staff/advertiser-applications/${encodeURIComponent(a.id)}/decide`, { method: "POST", body: { action: "APPROVE" } }), "Demande approuvée.") }, "Approuver"),
            h("button", { class: "btn btn-small", type: "button", onClick: () => {
              const note = ask("Informations à demander au candidat :");
              if (note) run(() => api(`/staff/advertiser-applications/${encodeURIComponent(a.id)}/decide`, { method: "POST", body: { action: "NEED_INFO", note } }), "Informations demandées.");
            } }, "Demander des infos"),
            h("button", { class: "btn btn-small", type: "button", onClick: () => {
              const note = ask("Motif du refus :");
              if (note) run(() => api(`/staff/advertiser-applications/${encodeURIComponent(a.id)}/decide`, { method: "POST", body: { action: "REJECT", note } }), "Demande refusée.");
            } }, "Refuser")))) : h("p", { class: "muted" }, "Aucune demande en attente."));
    } catch (e) { mount(host, h("p", { class: "notice" }, e.message)); }
  })();
  return host;
}

function trustPanel() {
  const isAdmin = ["ADMIN", "SUPERADMIN"].includes(me.staffRole);
  const blocks = [];
  blocks.push(h("h2", null, `Pièces à contrôler (${trust.proofs.length})`));
  if (!trust.proofs.length) blocks.push(h("p", { class: "card pad muted" }, "Aucune pièce en attente."));
  for (const p of trust.proofs) {
    blocks.push(h("article", { class: "card list-item" },
      h("div", { class: "grow" }, h("span", { class: "pill pill-gold" }, p.kind === "AGENCE" ? "AGENCE" : "DOCUMENT"),
        h("h2", null, p.listingTitle ?? `Agence de ${p.ownerName}`),
        h("p", { class: "small muted" }, `${p.ownerName}${p.declaredDocument ? ` · document déclaré : ${p.declaredDocument}` : ""} · ${formatDate(p.createdAt)}`),
        h("p", { class: "small" }, "Un badge n'est donné qu'après un vrai contrôle (cadastre, greffe, mairie…). Indiquez ce que vous avez vérifié.")),
      h("div", { class: "row" },
        h("button", { class: "btn btn-small", type: "button", onClick: () => openProof(p.id) }, "Voir la pièce"),
        h("button", { class: "btn btn-small btn-primary", type: "button", onClick: () => {
          const note = ask("Qu'avez-vous contrôlé ? (organisme, numéro), obligatoire :");
          if (!note) return;
          const agencyName = p.kind === "AGENCE" ? ask("Nom de l'agence, obligatoire :", 2) : "";
          if (p.kind === "AGENCE" && !agencyName) return;
          run(() => post(`/staff/proofs/${encodeURIComponent(p.id)}/decision`, { action: "ACCEPT", note, agencyName }), "Pièce acceptée, badge donné.");
        } }, "Contrôlée : accepter"),
        h("button", { class: "btn btn-small", type: "button", onClick: () => {
          const note = ask("Motif du refus, obligatoire :");
          if (note) run(() => post(`/staff/proofs/${encodeURIComponent(p.id)}/decision`, { action: "REFUSE", note }), "Pièce refusée.");
        } }, "Refuser"))));
  }
  blocks.push(h("h2", null, `Alertes automatiques (${trust.alerts.length})`));
  if (!trust.alerts.length) blocks.push(h("p", { class: "card pad muted" }, "Aucune alerte."));
  const KIND = { PRICE: "Prix inhabituel", BURST: "Rafale d'annonces", DUPLICATE: "Doublon possible", COMMENT: "Commentaire signalé" };
  for (const a of trust.alerts) {
    blocks.push(h("article", { class: "card list-item" },
      h("div", { class: "grow" }, h("span", { class: "pill pill-gold" }, KIND[a.kind] ?? a.kind), h("h2", null, a.title ?? "Commentaire"), h("p", { class: "small muted" }, a.detail)),
      h("div", { class: "row" },
        a.listingId ? h("a", { class: "btn btn-small", href: `/#/annonce/${encodeURIComponent(a.listingId)}` }, "Voir") : null,
        h("button", { class: "btn btn-small", type: "button", onClick: () => run(() => post(`/staff/alerts/${encodeURIComponent(a.id)}/close`, {}), "Alerte traitée.") }, "Traitée"))));
  }
  blocks.push(h("h2", null, `Commentaires signalés (${trust.commentReports.length})`));
  if (!trust.commentReports.length) blocks.push(h("p", { class: "card pad muted" }, "Aucun commentaire signalé."));
  for (const c of trust.commentReports) {
    blocks.push(h("article", { class: "card list-item" },
      h("div", { class: "grow" }, h("span", { class: "pill pill-gold" }, `${c.reports} signalement(s)`), h("p", null, `« ${c.body} »`), h("p", { class: "small muted" }, `${c.authorName} · ${c.lastReason}${c.hidden ? " · déjà masqué" : ""}`)),
      h("div", { class: "row" },
        h("button", { class: "btn btn-small btn-dark", type: "button", onClick: () => run(() => post(`/staff/comments/${encodeURIComponent(c.commentId)}/hide`, {}), "Commentaire masqué.") }, "Masquer"),
        h("button", { class: "btn btn-small", type: "button", onClick: () => run(() => post(`/staff/comments/${encodeURIComponent(c.commentId)}/dismiss-reports`, {}), "Signalements écartés.") }, "Écarter"))));
  }
  const reviewReports = trust.reviewReports ?? [];
  blocks.push(h("h2", null, `Avis signalés (${reviewReports.length})`));
  if (!reviewReports.length) blocks.push(h("p", { class: "card pad muted" }, "Aucun avis signalé."));
  for (const r of reviewReports) {
    blocks.push(h("article", { class: "card list-item" },
      h("div", { class: "grow" }, h("span", { class: "pill pill-gold" }, `${r.reports} signalement(s)`), h("p", null, `Note ${r.rating}/5 : « ${r.body} »`), h("p", { class: "small muted" }, `${r.authorName} · ${r.lastReason}`)),
      h("div", { class: "row" },
        h("button", { class: "btn btn-small btn-dark", type: "button", onClick: () => run(() => post(`/staff/reviews/${encodeURIComponent(r.reviewId)}/hide`, {}), "Avis masqué.") }, "Masquer"),
        h("button", { class: "btn btn-small", type: "button", onClick: () => run(() => post(`/staff/reviews/${encodeURIComponent(r.reviewId)}/dismiss-reports`, {}), "Signalements écartés.") }, "Écarter"))));
  }
  blocks.push(h("h2", null, `Personnes signalées en messagerie (${trust.userReports.length})`));
  if (!trust.userReports.length) blocks.push(h("p", { class: "card pad muted" }, "Aucune personne signalée."));
  for (const u of trust.userReports) {
    blocks.push(h("article", { class: "card list-item" },
      h("div", { class: "grow stack" },
        h("span", { class: "pill pill-gold" }, `${u.reports} signalement(s)`), h("p", null, h("strong", null, u.name), ` · ${u.lastReason}`),
        u.lastDetails ? h("p", { class: "small" }, `« ${u.lastDetails} »`) : null,
        u.excerpt.length ? h("p", { class: "small muted" }, "Derniers messages transmis par la personne qui signale (seul contexte visible) :") : h("p", { class: "small muted" }, "Signalement visant le profil public de l'annonceur (aucun message joint)."),
        h("ul", { class: "stack" }, u.excerpt.map((m) => h("li", { class: "small" }, h("strong", null, m.from === "reported" ? "Signalé : " : "Signalant : "), m.body))),
        h("p", { class: "small muted" }, "Pour sanctionner : onglet Comptes.")),
      h("div", { class: "row" },
        h("button", { class: "btn btn-small", type: "button", onClick: () => run(() => post(`/staff/user-reports/${encodeURIComponent(u.userId)}/dismiss`, {}), "Signalements écartés.") }, "Écarter"),
        h("button", { class: "btn btn-small", type: "button", onClick: () => { const reason = ask("Motif du masquage des photos de profil, obligatoire :", 3); if (reason) run(() => post(`/staff/profiles/${encodeURIComponent(u.userId)}/images`, { hidden: true, reason }), "Photos de profil masquées."); } }, "Masquer ses photos de profil"))));
  }
  if (isAdmin) {
    blocks.push(h("h2", null, `Liste noire (${blacklist.length})`));
    blocks.push(h("div", { class: "row" },
      h("button", { class: "btn btn-small", type: "button", onClick: () => {
        const kind = window.confirm("OK = numéro de téléphone ; Annuler = adresse e-mail") ? "PHONE" : "EMAIL";
        const value = ask(kind === "PHONE" ? "Numéro (ex. +223 76 12 34 56) :" : "Adresse e-mail :", 6);
        const reason = value ? ask("Motif, obligatoire :") : null;
        if (value && reason) run(() => post("/staff/blacklist", { kind, value, reason }), "Ajouté. Les comptes concernés sont bloqués.");
      } }, "Ajouter à la liste noire")));
    for (const b of blacklist) {
      blocks.push(h("p", { class: "card pad small" }, `${b.kind === "PHONE" ? "Téléphone" : "E-mail"} ${b.value} — ${b.reason} `,
        h("button", { class: "btn btn-small btn-quiet", type: "button", onClick: () => run(() => post(`/staff/blacklist/${encodeURIComponent(b.id)}/remove`, {}), "Retiré de la liste noire.") }, "Retirer")));
    }
  }
  return blocks;
}

function payPanel() {
  if (!recon) return h("p", { class: "card pad muted" }, "Réservé aux administrateurs.");
  const blocks = [h("h2", null, "Offres (tarifs fixés par le propriétaire)"),
    h("p", { class: "small muted" }, "Une offre inactive ou à prix 0 n'est jamais proposée au public.")];
  for (const o of offers) {
    blocks.push(h("article", { class: "card list-item" },
      h("div", { class: "grow" }, h("h2", null, o.label), h("p", { class: "small muted" }, `${o.priceXof.toLocaleString("fr-FR")} FCFA · ${o.active ? "active" : "inactive"}`)),
      h("div", { class: "row" },
        h("button", { class: "btn btn-small", type: "button", onClick: () => { const v = ask("Prix en FCFA (nombre entier) :", 1); if (v) run(() => post(`/staff/offers/${encodeURIComponent(o.code)}`, { priceXof: Number(v), active: o.active }), "Prix enregistré."); } }, "Fixer le prix"),
        h("button", { class: "btn btn-small btn-primary", type: "button", onClick: () => run(() => post(`/staff/offers/${encodeURIComponent(o.code)}`, { priceXof: o.priceXof, active: !o.active }), o.active ? "Offre désactivée." : "Offre activée.") }, o.active ? "Désactiver" : "Activer"))));
  }
  blocks.push(h("h2", null, `À vérifier (${recon.toReview.length})`),
    h("p", { class: "small muted" }, `Payé au total : ${recon.paid.totalXof.toLocaleString("fr-FR")} FCFA en ${recon.paid.count} paiement(s). ${recon.repaired ? `${recon.repaired} paiement(s) réparé(s) à l'ouverture.` : ""}`));
  if (!recon.toReview.length) blocks.push(h("p", { class: "card pad muted" }, "Rien à vérifier."));
  for (const p of recon.toReview) blocks.push(h("p", { class: "card pad small" }, `${p.status} · ${p.amountXof.toLocaleString("fr-FR")} FCFA · annonce ${p.listingId} · ${formatDate(p.createdAt)} · ${p.id}`));
  if (recon.expired) blocks.push(h("p", { class: "small muted" }, `${recon.expired} paiement(s) resté(s) en attente depuis plus de 24 h marqué(s) comme expiré(s).`));
  blocks.push(h("h2", null, `Remboursements à confirmer chez le fournisseur (${recon.refundsToConfirm.length})`),
    h("p", { class: "small muted" }, `Déjà remboursé : ${recon.refunded.totalXof.toLocaleString("fr-FR")} FCFA en ${recon.refunded.count} paiement(s). Un remboursement noté ici n'est « confirmé » que lorsque le fournisseur le signale.`));
  if (!recon.refundsToConfirm.length) blocks.push(h("p", { class: "card pad muted" }, "Rien à rapprocher."));
  for (const p of recon.refundsToConfirm) blocks.push(h("p", { class: "card pad small" }, `${p.amountXof.toLocaleString("fr-FR")} FCFA · annonce ${p.listingId} · noté le ${formatDate(p.refundedAt)} · ${p.refundReason ?? ""} · ${p.id}`));
  blocks.push(h("h2", null, "Noter un remboursement"),
    h("p", { class: "small muted" }, "À faire une fois l'argent rendu chez le fournisseur. Retire de l'annonce les jours que ce paiement avait donnés."));
  if (!recon.refundable.length) blocks.push(h("p", { class: "card pad muted" }, "Aucun paiement confirmé."));
  for (const p of recon.refundable) blocks.push(h("article", { class: "card list-item" },
    h("div", { class: "grow" }, h("p", { class: "small" }, `${p.amountXof.toLocaleString("fr-FR")} FCFA · ${p.days} jours · annonce ${p.listingId}`), h("p", { class: "small muted" }, `${formatDate(p.paidAt ?? p.createdAt)} · ${p.id}`)),
    h("button", { class: "btn btn-small", type: "button", onClick: () => { const reason = ask("Motif du remboursement (obligatoire) :", 3); if (reason && window.confirm("Confirmer : l'argent a bien été rendu chez le fournisseur ?")) run(() => post(`/staff/payments/${encodeURIComponent(p.id)}/refund`, { reason }), "Remboursement noté."); } }, "Rembourser")));
  return blocks;
}

// ---------- Statistiques : lecture des agrégats uniquement (jamais en direct) ----------
async function loadStats() {
  try { [statsView, rankView] = await Promise.all([api(`/staff/stats/overview?days=${statsDays}`), api(`/staff/stats/rankings?days=${statsDays}`)]); statsError = null; } catch (error) { statsError = error.message; }
  draw();
}
const nf = (n) => Number(n).toLocaleString("fr-FR");
function statsPanel() {
  if (sheetView) return sheetPanel();
  if (compareView) return comparePanel();
  if (statsError) return h("p", { class: "card pad notice" }, statsError);
  if (!statsView) return h("p", { class: "card pad muted" }, "Chargement des statistiques…");
  const v = statsView; const c = v.collection;
  const notes = [];
  if (!c.environmentOn || !c.settingOn) notes.push("Collecte des visites non démarrée : seuls les chiffres d'historique (inscriptions, annonces publiées) sont disponibles. Les vues, favoris et contacts apparaîtront après l'activation, qui exige l'avis du juriste.");
  else if (!c.lastAggregatedDay) notes.push("Aucune agrégation n'a encore été faite : lancez « node scripts/aggregate.mjs --apply » sur le serveur.");
  if (c.lastAggregatedDay && c.lastAggregatedDay < v.period.to) notes.push(`Chiffres arrêtés au ${c.lastAggregatedDay} : les jours suivants n'ont pas été agrégés.`);
  if (c.checksFailed7d > 0) notes.push(`${c.checksFailed7d} contrôle(s) de cohérence en écart ces 7 derniers jours : recalculer les jours concernés.`);
  const delta = (key) => {
    const now = v.totals[key]; const before = v.previousTotals[key];
    if (!before) return now ? "pas de période précédente comparable" : "";
    const d = now - before;
    return `${d >= 0 ? "+" : ""}${nf(d)} (${d >= 0 ? "+" : ""}${Math.round((d / before) * 100)} %) par rapport à la période précédente`;
  };
  const kpi = v.definitions.map((d) => h("div", { class: "card stat" }, h("span", { class: "small muted" }, d.label), h("strong", null, nf(v.totals[d.key])), h("span", { class: "small muted" }, delta(d.key))));
  const shown = v.daily.slice(-31);
  const max = Math.max(1, ...shown.map((d) => d.views));
  return [
    h("div", { class: "row", role: "group", "aria-label": "Période" }, [7, 30, 90].map((n) => h("button", { class: `btn btn-small${statsDays === n ? " btn-dark" : ""}`, type: "button", "aria-pressed": String(statsDays === n), onClick: () => { statsDays = n; statsView = null; sheetView = null; compareView = null; compareSel = []; loadStats(); draw(); } }, `${n} jours`)),
      h("span", { class: "small muted" }, `Du ${v.period.from} au ${v.period.to} (jours complets, fuseau UTC = Mali)`)),
    ...notes.map((n) => h("p", { class: "banner" }, n)),
    h("div", { class: "stat-grid" }, kpi),
    h("h2", null, "Jour par jour"),
    h("p", { class: "small muted" }, v.daily.length > shown.length ? `Les ${shown.length} derniers jours sur ${v.daily.length}.` : "Un jour par ligne."),
    h("div", { class: "stack" }, shown.map((d) => h("div", { class: "dist-row dist-wide" }, h("span", { class: "small" }, d.day.slice(5)), h("progress", { class: "dist-bar", max: String(max), value: String(d.views), "aria-label": `${d.day} : ${d.views} vues` }), h("span", { class: "small muted" }, `${nf(d.views)} vues · ${nf(d.contacts)} contacts · ${nf(d.registered)} inscr. · ${nf(d.published)} publ.`)))),
    h("h2", null, "Annonces les plus vues"),
    v.topListings.length ? h("div", { class: "stack" }, v.topListings.map((t) => h("p", { class: "card pad small" }, h("a", { href: `/#/annonce/${encodeURIComponent(t.listingId)}` }, t.title ?? t.listingId), ` — ${nf(t.views)} vues, ${nf(t.contactClicks)} clics de contact`))) : h("p", { class: "card pad muted" }, "Aucune vue comptée sur la période."),
    ...rankingBlocks(),
    h("details", { class: "card pad" }, h("summary", null, "Définitions des indicateurs"), h("ul", { class: "stack" }, v.definitions.map((d) => h("li", null, h("strong", null, d.label), ` : ${d.note}`)))),
    h("p", { class: "small muted" }, v.notice),
  ];
}

function rankingBlocks() {
  const r = rankView; if (!r) return [];
  const rate = (x) => (x.interactionRate == null ? `taux non affiché (moins de ${r.minViewsForRate} vues)` : `taux d'interaction ${String(x.interactionRate).replace(".", ",")} %`);
  const actions = (x) => (x.ownerId && !x.title ? h("span", { class: "row" },
    h("button", { class: "btn btn-small", type: "button", onClick: () => openSheet(x.ownerId) }, "Fiche"),
    h("button", { class: `btn btn-small${compareSel.some((c) => c.id === x.ownerId) ? " btn-dark" : ""}`, type: "button", "aria-pressed": String(compareSel.some((c) => c.id === x.ownerId)), onClick: () => toggleCompare(x.ownerId, x.name) }, compareSel.some((c) => c.id === x.ownerId) ? "Retirer de la comparaison" : "Comparer")) : null);
  const line = (x, label) => h("p", { class: "card pad small" }, h("strong", null, label), ` — indice ${nf(x.score)} · ${nf(x.views)} vues · ${nf(x.favorites)} favoris · ${nf(x.contactClicks)} clics de contact · ${rate(x)} `, actions(x));
  const block = (title, rows, render, empty) => [h("h2", null, title), rows.length ? h("div", { class: "stack" }, rows.map(render)) : h("p", { class: "card pad muted" }, empty)];
  const w = r.weights;
  const change = () => {
    const ask1 = (label, cur) => { const v = window.prompt(`${label} (entier de 0 à ${r.weightMax}) :`, String(cur)); return v == null ? null : v.trim(); };
    const view = ask1("Poids d'une vue", w.view); if (view == null) return;
    const favorite = ask1("Poids d'un favori ajouté", w.favorite); if (favorite == null) return;
    const contactClick = ask1("Poids d'un clic de contact (supérieur à celui d'une vue)", w.contactClick); if (contactClick == null) return;
    const reason = ask("Motif du changement, obligatoire :", 3); if (!reason) return;
    run(() => post("/staff/stats/weights", { view, favorite, contactClick, reason }), "Pondérations enregistrées.").then(() => loadStats());
  };
  return [
    compareSel.length === 1 ? h("p", { class: "banner" }, `Comparaison : ${compareSel[0].name} sélectionné. Choisissez un deuxième annonceur.`) : null,
    h("p", { class: "card pad small" }, `Pondérations de l'indice : vue ${w.view}, favori ${w.favorite}, clic de contact ${w.contactClick} (${r.weightsCustomised ? "réglées par le Superadmin" : "valeurs par défaut"}). `,
      me.staffRole === "SUPERADMIN" ? h("button", { class: "btn btn-small", type: "button", onClick: change }, "Modifier les pondérations") : null),
    ...block("Classement des annonces", r.listings, (x, i) => line(x, `${i + 1}. ${x.title} (${x.ownerName})`), "Aucune activité comptée sur la période."),
    ...block("Classement des agences", r.agencies, (x, i) => line(x, `${i + 1}. ${x.name}${x.agencyVerified ? " · vérifiée" : " · en cours de vérification"} · ${x.listingsCounted} annonce(s)`), "Aucune agence avec activité comptée."),
    ...block("Classement des autres annonceurs (particuliers, démarcheurs)", r.others, (x, i) => line(x, `${i + 1}. ${x.name} · ${x.role} · ${x.listingsCounted} annonce(s)`), "Aucun annonceur avec activité comptée."),
    h("details", { class: "card pad" }, h("summary", null, "Comment lire les classements"), h("ul", { class: "stack" }, r.definitions.map((d) => h("li", null, h("strong", null, d.label), ` : ${d.note}`)))),
  ];
}

// ---------- Fiche détaillée et comparaison d'annonceurs (administrateurs ; chaque consultation est journalisée) ----------
async function openSheet(id) {
  try { sheetView = await api(`/staff/stats/advertisers/${encodeURIComponent(id)}?days=${statsDays}`); pushNav(() => { sheetView = null; }); } catch (error) { fail(error); }
  draw();
}
async function toggleCompare(id, name) {
  compareSel = compareSel.some((c) => c.id === id) ? compareSel.filter((c) => c.id !== id) : [...compareSel, { id, name }].slice(-2);
  if (compareSel.length === 2) {
    try { compareView = await api(`/staff/stats/compare?a=${encodeURIComponent(compareSel[0].id)}&b=${encodeURIComponent(compareSel[1].id)}&days=${statsDays}`); pushNav(() => { compareView = null; compareSel = []; }); } catch (error) { fail(error); }
  }
  draw();
}
const pct = (cur, prev) => (!prev ? "" : ` (${cur - prev >= 0 ? "+" : ""}${Math.round(((cur - prev) / prev) * 100)} % sur la période précédente)`);
const perfLines = (p) => [`Indice ${nf(p.current.score)}${pct(p.current.score, p.previous.score)}`, `${nf(p.current.views)} vues · ${nf(p.current.favorites)} favoris · ${nf(p.current.contactClicks)} clics de contact`, p.current.interactionRate == null ? "Taux d'interaction non affiché (moins de 20 vues)" : `Taux d'interaction ${String(p.current.interactionRate).replace(".", ",")} % (par vue)`];
function sheetPanel() {
  const v = sheetView; const a = v.advertiser;
  const status = Object.entries(v.listingsByStatus).map(([k, n]) => `${n} ${k.toLowerCase()}`).join(" · ") || "aucune annonce";
  return [
    h("button", { class: "btn btn-small", type: "button", onClick: goBack }, "← Retour aux statistiques"),
    h("section", { class: "card pad stack" }, h("h2", null, a.name), h("p", { class: "small muted" }, `${a.role}${a.agencyVerified ? " · agence vérifiée" : ""} · compte ${a.accountStatus}${a.statusReason ? ` (${a.statusReason})` : ""}`),
      h("p", { class: "small" }, `Inscrit le ${a.memberSince ? formatDate(a.memberSince) : "—"} · dernière session enregistrée : ${v.lastSessionAt ? formatDate(v.lastSessionAt) : "aucune"} · ${a.phone ?? "pas de téléphone"}${a.phone ? (a.phoneVerifiedBySms ? " (vérifié par SMS)" : " (non vérifié)") : ""}`),
      h("p", { class: "small" }, `Annonces : ${v.listingsTotal} (${status})`)),
    h("section", { class: "card pad stack" }, h("h2", null, `Performance du ${v.period.from} au ${v.period.to}`), ...perfLines(v.performance).map((t) => h("p", { class: "small" }, t)),
      h("p", { class: "small muted" }, `Pondérations : vue ${v.weights.view}, favori ${v.weights.favorite}, contact ${v.weights.contactClick}.`)),
    h("section", { class: "stack" }, h("h2", null, "Meilleures annonces"), v.bestListings.length ? v.bestListings.map((l) => h("p", { class: "card pad small" }, h("a", { href: `/#/annonce/${encodeURIComponent(l.listingId)}` }, l.title), ` (${l.status.toLowerCase()}) — indice ${nf(l.score)} · ${nf(l.views)} vues · ${nf(l.favorites)} favoris · ${nf(l.contactClicks)} contacts`)) : h("p", { class: "card pad muted" }, "Aucune activité comptée sur la période.")),
    h("section", { class: "card pad stack" }, h("h2", null, "Avis et signalements"),
      h("p", { class: "small" }, v.reviews.count ? `${v.reviews.count} avis visible(s), moyenne ${String(v.reviews.average).replace(".", ",")} / 5` : "Pas encore d'avis"),
      h("p", { class: "small" }, `Signalements d'annonces : ${v.reports.listingOpen} ouvert(s) sur ${v.reports.listingTotal} · signalements du compte : ${v.reports.userOpen} ouvert(s) sur ${v.reports.userTotal}`)),
    h("section", { class: "stack" }, h("h2", null, "Décisions de l'équipe sur ce compte"), v.history.length ? v.history.map((e) => h("p", { class: "card pad small" }, `${formatDate(e.at)} · ${ACTIONS[e.action] ?? e.action} · ${e.note ?? ""}`)) : h("p", { class: "card pad muted" }, "Aucune sanction ni décision enregistrée.")),
    h("p", { class: "small muted" }, v.notice),
  ];
}
function comparePanel() {
  const v = compareView;
  const col = (x) => h("section", { class: "card pad stack" }, h("h2", null, x.name), h("p", { class: "small muted" }, `${x.role}${x.agencyVerified ? " · agence vérifiée" : ""} · ${x.listingsTotal} annonce(s)`),
    ...perfLines({ current: x.current, previous: x.previous }).map((t) => h("p", { class: "small" }, t)),
    ...x.bestListings.map((l) => h("p", { class: "small muted" }, `${l.title} — indice ${nf(l.score)}`)));
  return [
    h("button", { class: "btn btn-small", type: "button", onClick: goBack }, "← Retour (fermer la comparaison)"),
    h("h2", null, `Comparaison du ${v.period.from} au ${v.period.to}`),
    h("div", { class: "grid" }, col(v.a), col(v.b)),
    h("p", { class: "small muted" }, `Pondérations : vue ${v.weights.view}, favori ${v.weights.favorite}, contact ${v.weights.contactClick}. ${v.notice}`),
  ];
}

// Chargement initial du centre de contrôle.
load();
