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

  async function askManual(months, btn) {
    btn.disabled = true;
    try {
      await api("/premium/requests", { method: "POST", body: { months: Number(months) } });
      toast("Demande envoyée à l'équipe.");
      devenirPremiumPage();
    } catch (error) { fail(error); btn.disabled = false; }
  }

  const status = premium
    ? `Premium actif${access.premiumUntil ? ` jusqu'au ${day(access.premiumUntil)}` : ""}`
    : "Premium non activé";

  // Conditions : chacune affiche son état réel et l'action qui la fait avancer.
  const conditions = [
    { ok: certified, title: "Profil certifié", text: "Agence : registre de commerce vérifié. Particulier : titre foncier contrôlé sur une annonce.",
      cta: certified ? null : h("a", { class: "btn btn-small", href: "#/profil" }, "Envoyer mes justificatifs") },
    { ok: premium, title: "Abonnement Premium actif",
      text: premium ? "Tous les avantages Premium sont ouverts." : online ? "Choisissez une formule ci-dessous et payez par mobile money." : `Demandez le Premium ci-dessous : l'équipe l'approuve pour 1 à ${maxMonths} mois.`,
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
          ? h("p", { class: "dp-request pending" }, `${REQUEST_STATUS.PENDING} ${request.months} mois demandés le ${day(request.createdAt)}.`)
          : h("div", { class: "stack" },
              request?.status === "REJECTED" ? h("p", { class: "small dp-warn" }, `${REQUEST_STATUS.REJECTED}${request.decidedNote ? ` Motif : ${request.decidedNote}` : ""}`) : null,
              request?.status === "APPROVED" ? h("p", { class: "small muted" }, `${REQUEST_STATUS.APPROVED} ${request.grantedMonths} mois accordés le ${day(request.decidedAt)}.`) : null,
              h("div", { class: "dp-ask" },
                h("label", { class: "dp-label", for: "dp-months" }, "Durée souhaitée"),
                h("select", { id: "dp-months" }, ...Array.from({ length: maxMonths }, (_, i) => h("option", { value: String(i + 1) }, `${i + 1} mois`))),
                h("button", { class: "btn btn-primary", type: "button", onClick: (e) => askManual(document.getElementById("dp-months").value, e.currentTarget) }, "Demander le Premium"))));

  mount(app,
    h("section", { class: "dp" },
      h("header", { class: "dp-hero" },
        h("p", { class: "eyebrow" }, "Premium certifié"),
        h("h1", null, premium ? "Votre Premium" : "Devenir Premium"),
        h("p", { class: "dp-lead" }, "Un centre de contrôle complet pour les annonceurs certifiés. Vérifiez les conditions, puis activez votre abonnement."),
        h("p", { class: "dp-status" }, status, " · ", certified ? "Profil certifié" : "Profil non certifié")),

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
