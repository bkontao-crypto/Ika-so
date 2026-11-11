// Page « Avantages Premium » : ce que le compte Premium certifié apporte par rapport aux autres comptes.
// Seuls des avantages réellement présents dans le site sont listés ; la mise à la une reste une option payante distincte.
import { api, fail, h, mount, toast } from "/js/dom.js";
import { S, app } from "/js/core/state.js";
import { currentRoute } from "/js/core/router.js";
import { icon } from "/js/icons.js";
import { loadCss, premiumCard } from "/js/components/espace.js";

const KEY = [
  ["chart", "Statistiques détaillées", "Courbes de vues et de contacts sur 7, 14, 30 ou 90 jours, avec la variation par rapport à la période précédente."],
  ["pin", "Carte de vos annonces", "Toutes vos annonces localisées sur une carte, ouverte à la demande dans un petit cadre."],
  ["bell", "Alertes et échéances", "Signalements, annonces qui expirent, mises à la une et renouvellement Premium : rien ne vous échappe."],
  ["shield-check", "Centre de contrôle dédié", "Un seul écran pour vos annonces, messages, demandes de visite et notifications."],
];
// [libellé, détail, gratuit, premium]
const ROWS = [
  ["Publier et gérer vos annonces", "Dépôt, modification, prolongation, localisation", true, true],
  ["Messagerie, demandes de visite, avis clients", "Réponses aux messages, aux visites et aux avis", true, true],
  ["Profil public et badges de confiance", "Agence vérifiée ou titre foncier contrôlé, selon vos justificatifs", true, true],
  ["Centre de contrôle dédié", "Vue d'ensemble de votre activité en un écran", false, true],
  ["Vues, favoris et contacts par annonce", "Chiffres par annonce sur la période choisie", false, true],
  ["Courbe vues / contacts et comparaison", "7, 14, 30 ou 90 jours, variation vs période précédente", false, true],
  ["Carte de toutes vos annonces", "Chargée à la demande, jamais en arrière-plan", false, true],
  ["Alertes importantes", "Signalements reçus, annonces qui expirent, paiements confirmés", false, true],
  ["Échéances", "Renouvellement Premium, mises à la une, expirations", false, true],
  ["Messages récents et visites en un coup d'œil", "Sans quitter le tableau de bord", false, true],
];
const FAQ = [
  ["Le Premium me place-t-il en tête de l'annuaire des annonceurs ?", "Non. En tête de l'annuaire, on trouve les annonceurs dont une annonce est « mise à la une ». C'est une option payante distincte, qui s'ajoute au Premium ou s'utilise seule."],
  ["Pourquoi faut-il être certifié ?", "Le centre de contrôle est réservé aux annonceurs dont l'identité professionnelle a été contrôlée : agence vérifiée (registre de commerce) ou annonce avec titre foncier contrôlé par l'équipe."],
  ["Combien coûte le Premium et comment le payer ?", "Les formules et leurs prix s'affichent sur cette page. Le paiement se fait par mobile money sur la page sécurisée du fournisseur ; le Premium s'active automatiquement dès que le paiement est confirmé, et une facture est émise. Si les paiements ne sont pas encore ouverts, contactez un conseiller."],
];
const mark = (ok, label) => h("span", { class: `pm-mark ${ok ? "yes" : "no"}`, role: "img", "aria-label": `${label} : ${ok ? "inclus" : "non inclus"}` }, ok ? icon("check") : "—");

export async function premiumPage() {
  loadCss();
  // Emplacement de l'invitation cliquée (adresse #/premium?from=…). Le clic est compté une fois à l'arrivée sur la page ; une visite directe ou un lien interne à cette page n'en est pas un.
  const from = currentRoute().params.get("from") || "";
  if (from && from !== "page-premium") api("/premium/click", { method: "POST", body: { from } }).catch(() => {});
  const access = S.user ? await api("/me/center/access").catch(() => null) : null;
  const certified = Boolean(access?.certified); const premium = Boolean(access?.premium);
  // Formules Premium payables en ligne (vide si les paiements ne sont pas ouverts ou si aucun prix n'est fixé).
  const offers = S.user ? ((await api("/offers").catch(() => ({ offers: [] }))).offers ?? []).filter((o) => o.kind === "PREMIUM") : [];
  const fcfa = (n) => `${Number(n).toLocaleString("fr-FR")} FCFA`;
  let paying = false;
  async function pay(offer, btn) {
    if (paying) return;
    paying = true; btn.disabled = true;
    try {
      const { instructions, paymentUrl } = await api("/payments/checkout", { method: "POST", body: { offerCode: offer.code, from: from || "page-premium" } });
      if (paymentUrl) { toast("Redirection vers la page de paiement…"); location.href = paymentUrl; return; }
      toast(instructions);
      location.hash = "#/paiements";
    } catch (error) { fail(error); } finally { paying = false; btn.disabled = false; }
  }
  const goBuy = (e) => { e.preventDefault(); document.getElementById("pm-buy")?.scrollIntoView({ behavior: "smooth" }); };
  // Bouton principal : paiement en ligne si une formule est ouverte, sinon demande à un conseiller (comme avant).
  const ctaHref = S.user ? (offers.length ? "#pm-buy" : "#/reclamations") : "#/connexion?next=%2Fpremium";
  const ctaLabel = !S.user ? "Me connecter pour demander" : premium ? "Renouveler le Premium" : "Demander le Premium";
  const ctaClick = S.user && offers.length ? goBuy : undefined;
  const step = (n, ok, title, text, cta) => h("li", { class: `pm-step${ok ? " done" : ""}` }, h("span", { class: "pm-num" }, ok ? icon("check") : String(n)), h("div", null, h("strong", null, title), h("p", { class: "small muted" }, text), cta));

  mount(app,
    h("section", { class: "pm-hero" },
      h("p", { class: "eyebrow pm-eyebrow" }, "Compte Premium certifié"),
      h("h1", null, "Pilotez vos annonces comme un professionnel"),
      h("p", { class: "pm-lead" }, "Un centre de contrôle complet réservé aux annonceurs certifiés : statistiques, carte, alertes, messages et échéances au même endroit."),
      h("div", { class: "row" },
        access?.eligible ? h("a", { class: "pc-btn", href: "#/centre" }, "Ouvrir mon centre de contrôle", h("span", { "aria-hidden": "true" }, "→"))
          : h("a", { class: "pc-btn", href: ctaHref, onClick: ctaClick }, ctaLabel, h("span", { "aria-hidden": "true" }, "→")),
        h("a", { class: "pm-ghost", href: "#pm-compare", onClick: (e) => { e.preventDefault(); document.getElementById("pm-compare")?.scrollIntoView({ behavior: "smooth" }); } }, "Comparer les comptes")),
      access ? h("p", { class: "pm-status" }, premium ? `Premium actif${access.premiumUntil ? ` jusqu'au ${new Date(access.premiumUntil).toLocaleDateString("fr-FR")}` : ""}` : "Premium : non activé", " · ", certified ? "Profil certifié" : "Profil non certifié") : null),

    offers.length ? h("section", { class: "card pad stack pm-buy", id: "pm-buy" },
      h("h2", null, premium ? "Renouveler le Premium" : "Choisir ma formule Premium"),
      S.user && !certified ? h("p", { class: "small pm-warn" }, "Votre profil n'est pas encore certifié : le centre de contrôle s'ouvrira dès que vos justificatifs seront validés (étape 1). Les jours Premium payés commencent à courir tout de suite.") : null,
      premium && access?.premiumUntil ? h("p", { class: "small muted" }, `Votre Premium actuel court jusqu'au ${new Date(access.premiumUntil).toLocaleDateString("fr-FR")} ; les nouveaux jours s'ajoutent à la suite.`) : null,
      h("ul", { class: "pm-offers" }, offers.map((o) => h("li", { class: "pm-offer" },
        h("div", null, h("strong", null, o.label), h("p", { class: "small muted" }, `${o.days} jours · ${fcfa(o.priceXof)}`)),
        h("button", { class: "btn btn-gold", type: "button", onClick: (e) => pay(o, e.currentTarget) }, `Payer ${fcfa(o.priceXof)}`)))),
      h("p", { class: "small muted" }, "Paiement sécurisé par mobile money. Vous serez redirigé vers la page du fournisseur puis ramené sur Ika So. Retrouvez vos paiements et factures dans « Mes paiements ».")) : null,

    h("div", { class: "pm-key" }, KEY.map(([ic, t, d]) => h("article", { class: "pm-keycard" }, h("span", { class: "pm-kic" }, icon(ic)), h("h2", null, t), h("p", { class: "small muted" }, d)))),

    h("section", { class: "card pad stack", id: "pm-compare" },
      h("h2", null, "Compte standard ou Premium certifié ?"),
      h("div", { class: "table-wrap" }, h("table", { class: "pm-table" },
        h("thead", null, h("tr", null, h("th", { scope: "col" }, "Fonctionnalité"), h("th", { scope: "col" }, "Standard"), h("th", { scope: "col", class: "pm-prem" }, icon("star"), "Premium certifié"))),
        h("tbody", null, ROWS.map(([label, detail, free, prem]) => h("tr", null, h("th", { scope: "row" }, h("strong", null, label), h("small", { class: "muted" }, detail)), h("td", null, mark(free, `${label}, Standard`)), h("td", { class: "pm-prem" }, mark(prem, `${label}, Premium`))))))),
      h("p", { class: "small muted" }, "La mise à la une d'une annonce (tête de liste, rubrique « annonces sponsorisées », tête de l'annuaire des annonceurs) est une option payante à part, disponible avec ou sans Premium.")),

    h("section", { class: "card pad stack" }, h("h2", null, "Comment l'obtenir"),
      h("ol", { class: "pm-steps" },
        step(1, certified, "Faire certifier votre profil", "Agence : envoyez votre registre de commerce. Particulier : joignez le titre foncier d'une annonce.", certified ? null : h("a", { class: "btn btn-small", href: "#/profil" }, "Envoyer mes justificatifs")),
        step(2, premium, "Demander le Premium", offers.length ? "Choisissez une formule et payez par mobile money : l'abonnement s'active dès que le paiement est confirmé." : "L'équipe vous communique le tarif et active l'abonnement sur votre compte.", premium ? null : h("a", { class: "btn btn-small btn-gold", href: ctaHref, onClick: ctaClick }, offers.length ? "Choisir une formule" : "Contacter un conseiller")),
        step(3, access?.eligible, "Ouvrir votre centre de contrôle", "Il apparaît dans votre profil dès que les deux conditions sont réunies.", access?.eligible ? h("a", { class: "btn btn-small btn-primary", href: "#/centre" }, "Ouvrir") : null))),

    h("section", { class: "stack" }, h("h2", null, "Questions fréquentes"), FAQ.map(([q, a]) => h("details", { class: "card pad pm-faq" }, h("summary", null, q), h("p", { class: "small" }, a)))),
    premiumCard(access, "page-premium"));
}
