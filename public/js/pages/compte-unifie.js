// Compte unifié (#/profil) — Étape 3
// Onglets contextuels selon les rôles. L'affichage n'accorde aucun droit.
import { api, h, mount, toast, formatPrice, fail } from "/js/dom.js";
import { S, refreshSession } from "/js/core/state.js";
import { needLogin } from "/js/core/router.js";

const ALL_TABS = [
  ["apercu", "Aperçu", () => true],
  ["biens", "Mes biens", (u) => u.isAdvertiser || u.isOwner],
  ["annonces", "Annonces", (u) => u.isAdvertiser],
  ["messages", "Messages", () => true],
  ["favoris", "Favoris", () => true],
  ["documents", "Documents", () => true],
  ["abonnement", "Abonnement", (u) => u.isAdvertiser],
  ["pro", "Pro", (u) => u.isPremium || u.isAgency],
  ["reglages", "Réglages", () => true],
];

const STATUS_LABEL = {
  PENDING: "En attente",
  REJECTED: "Refusée",
  EXPIRED: "Expirée",
  SOLD: "Vendue",
  RENTED: "Louée",
  DRAFT: "Brouillon",
  PUBLISHED: "En ligne",
  ARCHIVED: "Archivée",
};

function userFlags() {
  const m = S.meta ?? {};
  const role = S.user?.role || "USER";
  return {
    isStaff: ["MODERATOR", "ADMIN", "SUPERADMIN"].includes(role),
    isSuper: role === "SUPERADMIN",
    isAdmin: role === "ADMIN" || role === "SUPERADMIN",
    isAdvertiser: !!m.advertiserStatus && m.advertiserStatus !== "NONE",
    isOwner: !!m.hasProperties,
    isPremium: !!m.premium,
    isAgency: !!m.agencyVerified,
  };
}

function visibleTabs(flags) {
  return ALL_TABS.filter(([, , pred]) => pred(flags));
}

export async function compteUnifiePage() {
  if (needLogin()) return;
  await refreshSession();
  const flags = userFlags();
  const tabs = visibleTabs(flags);
  const params = new URLSearchParams(location.hash.split("?")[1] ?? "");
  let current = params.get("tab") || "apercu";
  if (!tabs.some(([id]) => id === current)) current = tabs[0][0];

  const root = h("div", { class: "compte-unifie" });
  const tablist = h("div", { class: "tabs", role: "tablist" });
  const panel = h("div", { class: "tab-panel", role: "tabpanel" });

  // Cache des annonces pour éviter de recharger à chaque clic d'onglet
  let listingsCache = null;

  function renderTabs() {
    tablist.replaceChildren(...tabs.map(([id, label]) =>
      h("button", {
        type: "button",
        role: "tab",
        "aria-selected": String(id === current),
        class: id === current ? "active" : "",
        onClick: () => { current = id; history.replaceState(null, "", `#/profil?tab=${id}`); draw(); },
      }, label)
    ));
  }

  function apercu() {
    const m = S.meta ?? {};
    const pills = [];
    if (flags.isAdvertiser) pills.push(h("span", { class: "pill pill-green" }, "Annonceur"));
    if (flags.isPremium) pills.push(h("span", { class: "pill pill-gold" }, "Premium"));
    if (flags.isAgency) pills.push(h("span", { class: "pill" }, "Agence"));
    if (flags.isStaff) pills.push(h("span", { class: "pill" }, flags.isSuper ? "Superadmin" : "Équipe"));
    return h("section", { class: "card" },
      h("h2", null, "Aperçu"),
      h("p", { class: "muted" }, m.fullName || S.user.name),
      pills.length ? h("div", { class: "row wrap gap-sm my-12" }, ...pills) : null,
      h("div", { class: "row wrap gap-sm" },
        flags.isStaff ? h("a", { class: "btn btn-primary", href: "/admin" }, "Console") : null,
        flags.isAdmin ? h("a", { class: "btn", href: "/owner" }, "Owner Center") : null,
        flags.isAdvertiser ? h("a", { class: "btn btn-outline", href: "#/profil?tab=annonces" }, "Mes annonces") : null,
        h("a", { class: "btn btn-outline", href: "#/favoris" }, "Favoris"),
      ),
      h("p", { class: "small muted mt-22" }, "Les onglets affichés dépendent de vos rôles. Chaque action reste contrôlée côté serveur.")
    );
  }

  function listingCard(item) {
    const status = STATUS_LABEL[item.status] || item.status;
    const editable = ["PUBLISHED", "REJECTED", "EXPIRED", "PENDING"].includes(item.status);
    return h("article", { class: "card" },
      item.imageUrl ? h("img", { src: item.imageUrl, alt: "", style: "width:100%;height:140px;object-fit:cover;border-radius:12px" }) : null,
      h("div", { class: "row-between" },
        h("h3", { style: "margin:8px 0 4px" }, item.title),
        h("span", { class: "pill" }, status)
      ),
      h("p", { class: "muted small" }, `${formatPrice(item.price, item.transactionType)}${item.neighborhood ? ` · ${item.neighborhood}` : ""}`),
      item.moderationNote ? h("p", { class: "small" }, `Motif : ${item.moderationNote}`) : null,
      h("div", { class: "row wrap gap-sm", style: "margin-top:12px" },
        item.status === "PUBLISHED" ? h("a", { class: "btn btn-small", href: `#/annonce/${encodeURIComponent(item.id)}` }, "Voir") : null,
        editable ? h("a", { class: "btn btn-small btn-outline", href: `#/modifier/${encodeURIComponent(item.id)}` }, "Modifier") : null,
        h("a", { class: "btn btn-small", href: `#/mes-annonces` }, "Gestion avancée")
      )
    );
  }

  async function annoncesPanel() {
    if (!listingsCache) {
      try { listingsCache = await api("/me/listings"); }
      catch (e) { return h("section", { class: "card" }, h("p", null, "Impossible de charger les annonces.")); }
    }
    const items = listingsCache || [];
    const visible = items.filter((l) => l.status !== "ARCHIVED");
    return h("section", null,
      h("div", { class: "row-between mb-16" },
        h("h2", null, "Mes annonces"),
        h("a", { class: "btn btn-primary", href: "#/publier" }, "Nouvelle annonce")
      ),
      visible.length
        ? h("div", { class: "stack", style: "display:grid;gap:16px" }, ...visible.map(listingCard))
        : h("div", { class: "card empty-state" },
            h("div", { class: "mp-empty-ic" }, "🏠"),
            h("h3", null, "Aucune annonce"),
            h("p", null, "Déposez votre première annonce pour la retrouver ici."),
            h("a", { class: "btn btn-primary", href: "#/publier", style: "margin-top:12px" }, "Publier une annonce")
          )
    );
  }


  // ---------- Favoris ----------
  let favoritesCache = null;
  async function favorisPanel() {
    if (!favoritesCache) {
      try { favoritesCache = await api("/me/favorites"); }
      catch { return h("section", { class: "card" }, h("p", null, "Impossible de charger les favoris.")); }
    }
    const items = favoritesCache || [];
    return h("section", null,
      h("h2", { class: "mb-16" }, "Favoris"),
      items.length
        ? h("div", { class: "stack", style: "display:grid;gap:16px" }, ...items.map(favCard))
        : h("div", { class: "card empty-state" },
            h("div", { class: "mp-empty-ic" }, "⭐"),
            h("h3", null, "Aucun favori"),
            h("p", null, "Ajoutez des annonces à vos favoris depuis les fiches.")
          )
    );
  }
  function favCard(item) {
    return h("article", { class: "card" },
      item.imageUrl ? h("img", { src: item.imageUrl, alt: "", style: "width:100%;height:120px;object-fit:cover;border-radius:12px" }) : null,
      h("h3", { style: "margin:8px 0 4px" }, item.title),
      h("p", { class: "muted small" }, formatPrice(item.price, item.transactionType)),
      h("div", { class: "row wrap gap-sm", style: "margin-top:10px" },
        h("a", { class: "btn btn-small", href: `#/annonce/${encodeURIComponent(item.id)}` }, "Voir"),
        h("a", { class: "btn btn-small btn-outline", href: "#/favoris" }, "Gestion des favoris")
      )
    );
  }

  // ---------- Messages ----------
  let threadsCache = null;
  async function messagesPanel() {
    if (!threadsCache) {
      try { threadsCache = await api("/me/threads"); }
      catch { return h("section", { class: "card" }, h("p", null, "Impossible de charger les messages.")); }
    }
    const threads = threadsCache || [];
    const unread = threads.filter(t => t.unread).length;
    return h("section", null,
      h("div", { class: "row-between mb-16" },
        h("h2", null, `Messages${unread ? ` (${unread})` : ""}`),
        h("a", { class: "btn btn-outline", href: "#/boite" }, "Boîte complète")
      ),
      threads.length
        ? h("ul", { class: "stack", style: "display:grid;gap:12px;list-style:none;padding:0" }, ...threads.map(threadRow))
        : h("div", { class: "card empty-state" },
            h("div", { class: "mp-empty-ic" }, "💬"),
            h("h3", null, "Aucun message"),
            h("p", null, "Écrivez à un annonceur depuis une fiche d'annonce.")
          )
    );
  }
  function threadRow(t) {
    return h("li", { class: "card", style: t.unread ? "border-left:4px solid var(--leaf)" : "" },
      h("div", { class: "row-between" },
        h("strong", null, t.otherName || "Conversation"),
        t.unread ? h("span", { class: "pill pill-green" }, "Non lu") : null
      ),
      h("p", { class: "muted small", style: "margin:6px 0 0" }, t.lastMessage || "—"),
      h("a", { class: "btn btn-small", href: `#/boite/${encodeURIComponent(t.id)}`, style: "margin-top:8px" }, "Ouvrir")
    );
  }


  // ---------- Documents ----------
  let proofsCache = null;
  const PROOF_LABEL = { PENDING: "En cours de contrôle", ACCEPTED: "Acceptée", REFUSED: "Refusée" };
  async function documentsPanel() {
    if (!proofsCache) {
      try { proofsCache = await api("/me/proofs"); }
      catch { return h("section", { class: "card" }, h("p", null, "Impossible de charger les documents.")); }
    }
    const proofs = proofsCache || [];
    return h("section", null,
      h("h2", { class: "mb-16" }, "Documents et confiance"),
      proofs.length
        ? h("ul", { class: "stack", style: "display:grid;gap:12px;list-style:none;padding:0" }, ...proofs.map(proofRow))
        : h("div", { class: "card empty-state" },
            h("div", { class: "mp-empty-ic" }, "📄"),
            h("h3", null, "Aucun document"),
            h("p", null, "Les justificatifs envoyés (titre foncier, RCCM…) apparaîtront ici.")
          ),
      h("p", { class: "small muted mt-22" }, "Pour envoyer un justificatif, utilisez la gestion avancée d'une annonce ou les paramètres.")
    );
  }
  function proofRow(p) {
    return h("li", { class: "card" },
      h("div", { class: "row-between" },
        h("strong", null, p.kind === "AGENCE" ? "RCCM / Agence" : (p.listingTitle || "Titre foncier")),
        h("span", { class: "pill" }, PROOF_LABEL[p.status] || p.status)
      ),
      p.note ? h("p", { class: "small muted", style: "margin:6px 0 0" }, p.note) : null,
      p.createdAt ? h("p", { class: "small muted" }, new Date(p.createdAt).toLocaleDateString("fr-FR")) : null
    );
  }

  // ---------- Réglages ----------
  async function reglagesPanel() {
    let prefs = null, consent = null;
    try { prefs = await api("/me/notify-prefs"); } catch {}
    try { consent = await api("/me/analytics-consent"); } catch {}
    return h("section", { class: "stack", style: "display:grid;gap:16px" },
      h("div", { class: "card" },
        h("h2", null, "Réglages et confidentialité"),
        h("p", { class: "muted small" }, "Préférences de notification et consentement statistiques.")
      ),
      prefs ? h("div", { class: "card" },
        h("h3", null, "Notifications"),
        h("form", { class: "stack", style: "display:grid;gap:6px", onSubmit: async (ev) => {
          ev.preventDefault();
          const fd = new FormData(ev.target);
          try {
            await api("/me/notify-prefs", { method: "PUT", body: {
              email: fd.get("email") === "on",
              sms: fd.get("sms") === "on",
              whatsapp: fd.get("whatsapp") === "on",
            }});
            toast("Préférences enregistrées");
          } catch (e) { fail(e); }
        }},
          h("label", null, h("input", { type: "checkbox", name: "email", checked: prefs.email !== false }), " E-mail"),
          h("label", null, h("input", { type: "checkbox", name: "sms", checked: !!prefs.sms }), " SMS"),
          h("label", null, h("input", { type: "checkbox", name: "whatsapp", checked: !!prefs.whatsapp }), " WhatsApp"),
          h("button", { class: "btn btn-small", type: "submit", style: "margin-top:6px" }, "Enregistrer")
        )
      ) : null,
      consent ? h("div", { class: "card" },
        h("h3", null, "Statistiques"),
        h("p", { class: "small" }, consent.accepted ? "Autorisées" : "Refusées"),
        h("a", { class: "btn btn-outline btn-small", href: "#/profil-legacy?tab=parametres", style: "margin-top:8px" }, "Gérer le consentement")
      ) : null,
      h("div", { class: "card" },
        h("h3", null, "Mes données"),
        h("div", { class: "row wrap gap-sm" },
          h("a", { class: "btn", href: "/api/me/export", download: "mes-donnees-ika-so.json" }, "Télécharger mes données"),
          h("a", { class: "btn btn-outline", href: "#/profil-legacy?tab=parametres" }, "Supprimer mon compte")
        )
      )
    );
  }


  // ---------- Abonnement ----------
  async function abonnementPanel() {
    let access = null, offers = [], payments = [];
    try { access = await api("/me/center/access"); } catch {}
    try { offers = ((await api("/offers")).offers || []).filter(o => o.kind === "PREMIUM"); } catch {}
    try { payments = await api("/me/payments"); } catch {}
    const premium = Boolean(access?.premium);
    const until = access?.premiumUntil ? new Date(access.premiumUntil).toLocaleDateString("fr-FR") : null;
    return h("section", { class: "stack", style: "display:grid;gap:16px" },
      h("div", { class: "card" },
        h("h2", null, "Abonnement"),
        h("p", null, premium
          ? `Premium actif${until ? ` jusqu'au ${until}` : ""}.`
          : "Aucun abonnement Premium actif."),
        h("div", { class: "row wrap gap-sm", style: "margin-top:12px" },
          h("a", { class: "btn btn-primary", href: "#/premium" }, premium ? "Renouveler" : "Découvrir le Premium"),
          h("a", { class: "btn btn-outline", href: "#/paiements" }, "Mes paiements")
        )
      ),
      offers.length ? h("div", { class: "card" },
        h("h3", null, "Formules disponibles"),
        h("ul", { style: "list-style:none;padding:0;margin:8px 0 0" }, ...offers.map(o =>
          h("li", { class: "row-between", style: "padding:8px 0;border-bottom:1px solid var(--line)" },
            h("span", null, o.label),
            h("strong", null, `${o.priceXof.toLocaleString("fr-FR")} FCFA`)
          )
        ))
      ) : null,
      payments.length ? h("div", { class: "card" },
        h("h3", null, "Derniers paiements"),
        h("ul", { style: "list-style:none;padding:0;margin:8px 0 0" }, ...payments.slice(0, 5).map(pay =>
          h("li", { class: "small", style: "padding:6px 0" },
            `${pay.offerLabel || pay.offerCode || "Paiement"} — ${pay.amountXof ? pay.amountXof.toLocaleString("fr-FR") + " FCFA" : ""} (${pay.status || ""})`
          )
        ))
      ) : null
    );
  }


  // ---------- Pro (squelette) ----------
  async function proPanel() {
    let agency = null;
    try { agency = await api("/me/agency"); } catch {}
    const verified = Boolean(agency?.agencyVerified);
    return h("section", { class: "stack", style: "display:grid;gap:16px" },
      h("div", { class: "card" },
        h("h2", null, "Espace professionnel"),
        h("p", null, verified
          ? `Agence vérifiée${agency.agencyName ? ` : ${agency.agencyName}` : ""}.`
          : "Espace Pro disponible pour les agences vérifiées et les comptes Premium."),
        h("div", { class: "row wrap gap-sm", style: "margin-top:12px" },
          h("a", { class: "btn btn-primary", href: "#/agence" }, "Page agence"),
          h("a", { class: "btn btn-outline", href: "#/premium", "data-module": "premium" }, "Premium"),
          h("a", { class: "btn btn-outline", href: "#/centre" }, "Centre annonceur")
        )
      ),
      h("div", { class: "card" },
        h("h3", null, "CRM et leads"),
        h("p", { class: "muted small" }, "Gérez vos contacts, suivez les scores et avancez dans le pipeline."),
        h("a", { class: "btn btn-primary", href: "/crm-leads.html", "data-module": "crm", style: "margin-top:8px" }, "Ouvrir mes leads")
      )
    );
  }


  // ---------- Mes biens ----------
  let propertiesCache = null;
  async function biensPanel() {
    const detailId = new URLSearchParams(location.hash.split("?")[1] || "").get("id");
    if (detailId) {
      try {
        const b = await api(`/me/properties/${encodeURIComponent(detailId)}`);
        if (!b) return h("section", { class: "card" }, h("p", null, "Bien introuvable."), h("a", { href: "#/profil?tab=biens", class: "btn btn-outline" }, "Retour"));
        const listings = b.listings || [];
        return h("section", { class: "stack", style: "display:grid;gap:16px" },
          h("div", { class: "row-between" },
            h("h2", null, b.title)
          ),
          h("div", { class: "card" },
            h("p", { class: "muted small" }, [b.category, b.neighborhood, b.address, b.surface_m2 ? `${b.surface_m2} m²` : null].filter(Boolean).join(" · ") || "—"),
            b.notes ? h("p", null, b.notes) : null
          ),
          h("div", { class: "card" },
            h("h3", null, `Annonces liées (${listings.length})`),
            listings.length
              ? h("ul", { class: "stack", style: "list-style:none;padding:0" }, ...listings.map(l =>
                  h("li", null, h("a", { href: `#/annonce/${encodeURIComponent(l.id)}` }, l.title || l.id))
                ))
              : h("p", { class: "muted" }, "Aucune annonce liée pour le moment.")
          )
        );
      } catch (e) {
        return h("section", { class: "card" }, h("p", null, "Impossible de charger le bien."), h("a", { href: "#/profil?tab=biens", class: "btn btn-outline" }, "Retour"));
      }
    }
    if (!propertiesCache) {
      try { propertiesCache = await api("/me/properties"); }
      catch { propertiesCache = []; }
    }
    const items = propertiesCache || [];
    return h("section", null,
      h("div", { class: "row-between mb-16" },
        h("h2", null, "Mes biens"),
        h("button", { class: "btn btn-primary", type: "button", onClick: () => createBien() }, "Nouveau bien")
      ),
      items.length
        ? h("div", { class: "stack", style: "display:grid;gap:16px" }, ...items.map(bienCard))
        : h("div", { class: "card empty-state" },
            h("div", { class: "mp-empty-ic" }, "🏠"),
            h("h3", null, "Aucun bien"),
            h("p", null, "Créez un bien pour regrouper vos annonces, documents et collaborateurs.")
          )
    );
  }
  function bienCard(b) {
    return h("article", { class: "card" },
      h("h3", null, b.title),
      h("p", { class: "muted small" }, [b.category, b.neighborhood, b.surface_m2 ? `${b.surface_m2} m²` : null].filter(Boolean).join(" · ") || "—"),
      h("p", { class: "small" }, `${b.listing_count || 0} annonce(s) liée(s)`),
      h("a", { class: "btn btn-small", href: `#/profil?tab=biens&id=${b.id}`, style: "margin-top:8px" }, "Détails")
    );
  }
  async function createBien() {
    const title = prompt("Titre du bien :");
    if (!title || !title.trim()) return;
    try {
      await api("/me/properties", { method: "POST", body: { title: title.trim() } });
      propertiesCache = null;
      toast("Bien créé.");
      draw();
    } catch (e) { fail(e); }
  }

  function placeholder(title, note) {
    return h("section", { class: "card empty-state" },
      h("h2", null, title),
      h("p", null, note || "Contenu à brancher sur les écrans existants.")
    );
  }

  async function draw() {
    renderTabs();
    let content;
    if (current === "apercu") content = apercu();
    else if (current === "annonces") content = await annoncesPanel();
    else if (current === "favoris") content = await favorisPanel();
    else if (current === "messages") content = await messagesPanel();
    else if (current === "documents") content = await documentsPanel();
    else if (current === "reglages") content = await reglagesPanel();
    else if (current === "abonnement") content = await abonnementPanel();
    else if (current === "pro") content = await proPanel();
    else if (current === "biens") content = await biensPanel();
    else content = placeholder(current);
    panel.replaceChildren(content);
  }

  await draw();
  root.append(tablist, panel);
  mount(document.getElementById("app"), root);
}
