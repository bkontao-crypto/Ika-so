// Page « Devenir Premium » : conditions à remplir, puis paiement en ligne (si ouvert par le superadmin)
// ou demande approuvée à la main par l'équipe pour 1 à 3 mois (pendant ce temps, tous les avantages Premium).
import { api, fail, h, mount, toast } from "/js/dom.js";
import { S, app } from "/js/core/state.js";
import { icon } from "/js/icons.js";
import { loadCss } from "/js/components/espace.js";

const fcfa = (n) => `${Number(n).toLocaleString("fr-FR")} FCFA`;
const day = (d) => new Date(d).toLocaleDateString("fr-FR");
const BENEFITS = [
  ["chart", "Statistiques détaillées", "Vues et contacts sur 7, 14, 30 ou 90 jours."],
  ["pin", "Carte de vos annonces", "Toutes vos annonces localisées au même endroit."],
  ["bell", "Alertes et échéances", "Signalements, expirations et renouvellement en un coup d'œil."],
];
const ACCOUNT_LABEL = { AGENCY: "Agence immobilière", INDIVIDUAL: "Particulier / propriétaire", OTHER: "Autre professionnel" };
const REQUEST_STATUS = {
  PENDING: "Demande en attente de l'équipe.",
  APPROVED: "Demande approuvée.",
  REJECTED: "Demande non retenue.",
};

export async function devenirPremiumPage() {
  loadCss();
  if (!S.user) {
    mount(app, h("section", { class: "dp" },
      h("header", { class: "dp-hero" }, h("p", { class: "eyebrow" }, "Premium certifié"), h("h1", null, "Devenir Premium"),
        h("p", { class: "dp-lead" }, "Connectez-vous pour vérifier vos conditions et choisir votre formule.")),
      h("a", { class: "btn btn-primary", href: "#/connexion?next=%2Fdevenir-premium" }, "Me connecter")));
    return;
  }

  const [access, offersRes, mine] = await Promise.all([
    api("/me/center/access").catch(() => null),
    api("/offers").catch(() => ({ enabled: false, offers: [], manualMaxMonths: 3 })),
    api("/premium/requests/mine").catch(() => ({ request: null, policy: null })),
  ]);
  const certified = Boolean(access?.certified);
  const premium = Boolean(access?.premium);
  const eligible = Boolean(access?.eligible);
  const offers = (offersRes.offers ?? []).filter((o) => o.kind === "PREMIUM");
  const online = Boolean(offersRes.enabled) && offers.length > 0;
  const maxMonths = offersRes.manualMaxMonths ?? 3;
  const request = mine?.request ?? null;

  let paying = false;
  async function pay(offer, btn) {
    if (paying) return;
    paying = true; btn.disabled = true;
    try {
      const { instructions, paymentUrl } = await api("/payments/checkout", { method: "POST", body: { offerCode: offer.code, from: "devenir-premium" } });
      if (paymentUrl) { toast("Redirection vers la page de paiement…"); location.href = paymentUrl; return; }
      toast(instructions);
      location.hash = "#/paiements";
    } catch (error) { fail(error); } finally { paying = false; btn.disabled = false; }
  }

  async function askManual(body, btn) {
    btn.disabled = true;
    try {
      await api("/premium/requests", { method: "POST", body });
      toast("Demande envoyée à l'équipe.");
      devenirPremiumPage();
    } catch (error) { fail(error); btn.disabled = false; }
  }

  async function cancelRequest(id, btn) {
    if (!window.confirm("Retirer cette demande Premium ?")) return;
    btn.disabled = true;
    try { await api(`/premium/requests/${encodeURIComponent(id)}/cancel`, { method: "POST", body: {} }); toast("Demande retirée."); devenirPremiumPage(); } catch (error) { fail(error); btn.disabled = false; }
  }
  const history = (mine?.history ?? []).filter((r) => r.status !== "PENDING");

  const status = premium
    ? `Premium actif${access.premiumUntil ? ` jusqu'au ${day(access.premiumUntil)}` : ""}`
    : "Premium non activé";

  // Conditions : chacune affiche son état réel et l'action qui la fait avancer.
  const conditions = [
    { ok: certified, title: "Profil certifié", text: "Agence : registre de commerce vérifié. Particulier : titre foncier contrôlé sur une annonce.",
      cta: certified ? null : h("a", { class: "btn btn-small", href: "#/profil" }, "Envoyer mes justificatifs") },
    { ok: premium, title: "Abonnement Premium actif",
      text: premium ? (certified ? "Abonnement actif : tous les avantages Premium sont ouverts." : "Abonnement actif. Il manque encore la certification du profil pour ouvrir les avantages.") : online ? "Choisissez une formule ci-dessous et payez par mobile money." : `Demandez le Premium ci-dessous : l'équipe l'approuve pour 1 à ${maxMonths} mois.`,
      cta: !premium && online ? h("a", { class: "btn btn-small btn-gold", href: "#dp-formules" }, "Voir les formules") : null },
    { ok: eligible, title: "Centre de contrôle ouvert", text: "Il s'ouvre dès que le profil est certifié et l'abonnement actif.",
      cta: eligible ? h("a", { class: "btn btn-small btn-primary", href: "#/centre" }, "Ouvrir mon centre") : null },
  ];

  const formules = online
    ? h("section", { class: "card pad stack dp-block", id: "dp-formules" },
        h("h2", null, premium ? "Renouveler le Premium" : "Choisir ma formule"),
        !certified ? h("p", { class: "small dp-warn" }, "Vous pouvez payer dès maintenant. Le centre de contrôle s'ouvrira après certification de votre profil ; les jours payés commencent à courir tout de suite.") : null,
        premium && access?.premiumUntil ? h("p", { class: "small muted" }, `Votre Premium court jusqu'au ${day(access.premiumUntil)} ; les nouveaux jours s'ajoutent à la suite.`) : null,
        h("ul", { class: "dp-offers" }, offers.map((o) => h("li", { class: "dp-offer" },
          h("div", null, h("strong", null, o.label), h("p", { class: "small muted" }, `${o.days} jours`)),
          h("button", { class: "btn btn-gold", type: "button", onClick: (e) => pay(o, e.currentTarget) }, `Payer ${fcfa(o.priceXof)}`)))),
        h("p", { class: "small muted" }, "Paiement sécurisé. Vous êtes redirigé vers la page du fournisseur puis ramené sur Ika So. Factures dans « Mes paiements »."))
    : h("section", { class: "card pad stack dp-block", id: "dp-formules" },
        h("h2", null, premium ? "Renouveler le Premium" : "Demander le Premium"),
        h("p", { class: "small muted" }, `Le paiement en ligne n'est pas encore ouvert. Demandez la durée souhaitée : l'équipe l'approuve, et pendant cette durée vous bénéficiez de tous les avantages Premium.`),
        request?.status === "PENDING"
          ? h("div", { class: "stack" },
              h("p", { class: "dp-request pending" }, `${REQUEST_STATUS.PENDING} ${request.months} mois demandés le ${day(request.createdAt)}.`),
              h("p", { class: "small muted" }, `${ACCOUNT_LABEL[request.accountType] ?? "Compte"} · ${request.phone || "téléphone non renseigné"}${request.message ? ` · « ${request.message} »` : ""}`),
              h("div", { class: "row" }, h("button", { class: "btn btn-small", type: "button", onClick: (e) => cancelRequest(request.id, e.currentTarget) }, "Retirer ma demande")))
          : requestForm(request),
        history.length ? h("div", { class: "stack dp-history" }, h("h3", null, "Mes demandes précédentes"),
          h("ul", { class: "dp-hist" }, history.map((r) => h("li", null, h("b", null, `${r.months} mois · ${day(r.createdAt)}`), " — ",
            r.status === "APPROVED" ? `approuvée (${r.grantedMonths} mois accordés)` : r.status === "CANCELLED" ? "retirée" : `non retenue${r.decidedNote ? ` : ${r.decidedNote}` : ""}`)))) : null);

  function requestForm(last) {
    const type = h("select", { id: "dp-type", required: true }, h("option", { value: "" }, "Choisir…"), ...Object.entries(ACCOUNT_LABEL).map(([v, l]) => h("option", { value: v }, l)));
    const phone = h("input", { id: "dp-phone", class: "input", type: "tel", inputmode: "tel", autocomplete: "tel", placeholder: "Ex. : 76 00 00 00", maxlength: "20", required: true });
    const months = h("select", { id: "dp-months" }, ...Array.from({ length: maxMonths }, (_, i) => h("option", { value: String(i + 1) }, `${i + 1} mois`)));
    const msg = h("textarea", { id: "dp-msg", class: "input", rows: "3", maxlength: "500", placeholder: "Votre activité, le nombre d'annonces, ce que vous attendez du Premium (facultatif)." });
    const terms = h("input", { id: "dp-terms", type: "checkbox" });
    const send = h("button", { class: "btn btn-primary", type: "submit" }, "Envoyer ma demande");
    return h("form", { class: "stack dp-form", onSubmit: (e) => { e.preventDefault(); askManual({ months: Number(months.value), accountType: type.value, phone: phone.value, message: msg.value, acceptTerms: terms.checked }, send); } },
      last?.status === "REJECTED" ? h("p", { class: "small dp-warn" }, `${REQUEST_STATUS.REJECTED}${last.decidedNote ? ` Motif : ${last.decidedNote}` : ""}`) : null,
      last?.status === "APPROVED" ? h("p", { class: "small muted" }, `${REQUEST_STATUS.APPROVED} ${last.grantedMonths} mois accordés le ${day(last.decidedAt)}.`) : null,
      !certified ? h("p", { class: "small dp-warn" }, "Votre profil n'est pas encore certifié : vous pouvez demander le Premium, mais le centre de contrôle ne s'ouvrira qu'après certification.") : null,
      h("div", { class: "dp-ask" }, h("label", { class: "dp-label", for: "dp-type" }, "Type de compte"), type),
      h("div", { class: "dp-ask" }, h("label", { class: "dp-label", for: "dp-phone" }, "Téléphone de contact"), phone),
      h("div", { class: "dp-ask" }, h("label", { class: "dp-label", for: "dp-months" }, "Durée souhaitée"), months),
      h("div", { class: "dp-ask" }, h("label", { class: "dp-label", for: "dp-msg" }, "Message (facultatif)"), msg),
      h("label", { class: "dp-terms", for: "dp-terms" }, terms, h("span", null, "Je confirme que les informations sont exactes et j'accepte que l'équipe Ika So vérifie mon profil et me contacte avant d'activer le Premium.")),
      send);
  }

  mount(app,
    h("section", { class: "dp" },
      h("header", { class: "dp-hero" },
        h("p", { class: "eyebrow" }, "Premium certifié"),
        h("h1", null, premium ? "Votre Premium" : "Devenir Premium"),
        h("p", { class: "dp-lead" }, "Un centre de contrôle complet pour les annonceurs certifiés. Vérifiez les conditions, puis activez votre abonnement."),
        h("p", { class: "dp-status" }, status, " · ", certified ? "Profil certifié" : "Profil non certifié")),
      premium && !certified ? h("section", { class: "card pad stack dp-block", role: "status" },
        h("h2", null, "Dernière étape : faire certifier votre profil"),
        h("p", null, "Votre abonnement Premium est bien actif, mais le centre de contrôle (statistiques, carte, alertes) ne s'ouvre qu'après la certification de votre profil."),
        h("ul", { class: "small" }, h("li", null, "Agence : envoyez votre registre de commerce depuis « Mon profil » ; l'équipe le vérifie."), h("li", null, "Particulier : joignez le titre foncier à l'une de vos annonces ; l'équipe le contrôle.")),
        h("a", { class: "btn btn-primary", href: "#/profil" }, "Envoyer mes justificatifs")) : null,
      eligible ? h("section", { class: "card pad stack dp-block", role: "status" }, h("h2", null, "Votre centre de contrôle est ouvert"), h("a", { class: "btn btn-primary", href: "#/centre" }, "Ouvrir mon centre")) : null,

      h("section", { class: "card pad stack dp-block" },
        h("h2", null, "Vos conditions"),
        h("ol", { class: "pm-steps dp-steps" }, conditions.map((c, i) =>
          h("li", { class: `pm-step${c.ok ? " done" : ""}` },
            h("span", { class: "pm-num" }, c.ok ? icon("check") : String(i + 1)),
            h("div", null, h("strong", null, c.title), h("p", { class: "small muted" }, c.text), c.cta))))),

      formules,

      h("section", { class: "dp-benefits" }, BENEFITS.map(([ic, t, d]) =>
        h("article", { class: "pm-keycard" }, h("span", { class: "pm-kic" }, icon(ic)), h("h2", null, t), h("p", { class: "small muted" }, d)))),

      h("p", { class: "small muted dp-foot" }, "Le Premium est activé après paiement confirmé ou approbation de l'équipe. Pour la mise à la une d'une annonce, voir la page Premium.", " ", h("a", { href: "#/premium" }, "En savoir plus")),
    ));
}
