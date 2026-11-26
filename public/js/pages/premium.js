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
  ["Vues, favoris et contacts par annonce", "Chiffres par annonce sur la période choisie", "basic", true],
  ["Courbe vues / contacts et comparaison", "7, 14, 30 ou 90 jours, variation vs période précédente", false, true],
  ["Carte de toutes vos annonces", "Chargée à la demande, jamais en arrière-plan", false, true],
  ["Alertes importantes", "Signalements reçus, annonces qui expirent, paiements confirmés", false, true],
  ["Échéances", "Renouvellement Premium, mises à la une, expirations", false, true],
  ["Messages récents et visites en un coup d'œil", "Sans quitter le tableau de bord", "basic", true],
];
const FAQ = [
  ["Le Premium me place-t-il en tête de l'annuaire des annonceurs ?", "Non. En tête de l'annuaire, on trouve les annonceurs dont une annonce est « mise à la une ». C'est une option payante distincte, qui s'ajoute au Premium ou s'utilise seule."],
  ["Pourquoi faut-il être certifié ?", "La certification consiste à confirmer votre numéro de téléphone par un code : le centre de contrôle est réservé aux annonceurs joignables et identifiables, ce qui protège les utilisateurs. Le badge agence vérifiée ou titre foncier contrôlé reste facultatif et renforce la confiance."],
  ["Combien coûte le Premium et comment le payer ?", "Les formules et leurs prix s'affichent sur cette page. Le paiement se fait par mobile money sur la page sécurisée du fournisseur ; le Premium s'active automatiquement dès que le paiement est confirmé, et une facture est émise. Si le paiement en ligne n'est pas encore ouvert, vous pouvez demander le Premium à la main sur la page « Devenir Premium » : l'équipe l'approuve pour une durée de 1 à 3 mois."],
];
const mark = (ok, label) => (ok === "basic"
  ? h("span", { class: "pm-mark basic", role: "img", "aria-label": `${label} : version basique`, style: "font-size:.8rem;font-weight:600;opacity:.85" }, "Basique")
  : h("span", { class: `pm-mark ${ok ? "yes" : "no"}`, role: "img", "aria-label": `${label} : ${ok ? "inclus" : "non inclus"}` }, ok ? icon("check") : "—"));

export async function premiumPage() {
  loadCss();
  // Emplacement de l'invitation cliquée (adresse #/premium?from=…). Le clic est compté une fois à l'arrivée sur la page ; une visite directe ou un lien interne à cette page n'en est pas un.
  const from = currentRoute().params.get("from") || "";
  if (from && from !== "page-premium") api("/premium/click", { method: "POST", body: { from } }).catch(() => {});
  const access = S.user ? await api("/me/center/access").catch(() => null) : null;
  const phoneOk = Boolean(access?.phoneVerified); const premium = Boolean(access?.premium);
  // Le numéro n'est exigé avant paiement que si la règle officielle le dit et qu'aucune exception n'a été accordée à ce compte (même règle que le serveur).
  const phoneNeeded = access?.phoneRequiredForPremium !== false;
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
  // Tous les boutons « Devenir Premium » mènent à la page dédiée (conditions, formules, paiement).
  const ctaHref = S.user ? "#/devenir-premium" : "#/connexion?next=%2Fdevenir-premium";
  const ctaLabel = !S.user ? "Me connecter pour devenir Premium" : premium ? "Renouveler le Premium" : "Devenir Premium";
  const step = (n, ok, title, text, cta) => h("li", { class: `pm-step${ok ? " done" : ""}` }, h("span", { class: "pm-num" }, ok ? icon("check") : String(n)), h("div", null, h("strong", null, title), h("p", { class: "small muted" }, text), cta));

  mount(app,
    h("section", { class: "pm-hero" },
      h("p", { class: "eyebrow pm-eyebrow" }, "Compte Premium certifié"),
      h("h1", null, "Pilotez vos annonces comme un professionnel"),
      h("p", { class: "pm-lead" }, "Un centre de contrôle complet réservé aux annonceurs certifiés : statistiques, carte, alertes, messages et échéances au même endroit."),
      h("div", { class: "row" },
        access?.eligible ? h("a", { class: "pc-btn", href: "#/centre" }, "Ouvrir mon centre de contrôle", h("span", { "aria-hidden": "true" }, "→"))
          : h("a", { class: "pc-btn", href: ctaHref }, ctaLabel, h("span", { "aria-hidden": "true" }, "→")),
        h("a", { class: "pm-ghost", href: "#pm-compare", onClick: (e) => { e.preventDefault(); document.getElementById("pm-compare")?.scrollIntoView({ behavior: "smooth" }); } }, "Comparer les comptes")),
      access ? h("p", { class: "pm-status" }, premium ? `Premium actif${access.unlimited ? " sans limite de durée" : access.premiumUntil ? ` jusqu'au ${new Date(access.premiumUntil).toLocaleDateString("fr-FR")}` : ""}` : "Premium : non activé", " · ", phoneOk ? "Numéro confirmé" : "Numéro à confirmer") : null),

    offers.length && !access?.unlimited ? h("section", { class: "card pad stack pm-buy", id: "pm-buy" },
      h("h2", null, premium ? "Renouveler le Premium" : "Choisir ma formule Premium"),
      S.user && !phoneOk && phoneNeeded ? h("p", { class: "small pm-warn" }, "Votre numéro n'est pas encore confirmé : confirmez-le avant de payer (étape 1). Le centre de contrôle s'ouvre dès que le numéro est confirmé et l'abonnement actif.") : null,
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
      h("p", { class: "small muted" }, "Basique : compteurs simples du compte Standard, sans période, sans courbe et sans comparaison (favoris et contacts cumulés par annonce, 3 derniers messages)."),
      h("p", { class: "small muted" }, "La mise à la une d'une annonce (tête de liste, rubrique « annonces sponsorisées », tête de l'annuaire des annonceurs) est une option payante à part, disponible avec ou sans Premium.")),

    h("section", { class: "card pad stack" }, h("h2", null, "Comment l'obtenir"),
      h("ol", { class: "pm-steps" },
        step(1, phoneOk, "Faire certifier votre numéro", "Un code de vérification confirme que le numéro vous appartient. Le badge agence ou titre foncier reste facultatif.", phoneOk ? null : h("a", { class: "btn btn-small", href: "#/devenir-premium" }, "Confirmer mon numéro")),
        step(2, premium, "Devenir Premium", "Vérifiez vos conditions sur la page dédiée ; le paiement en ligne s'ouvre dès que les formules sont activées.", premium ? null : h("a", { class: "btn btn-small btn-gold", href: ctaHref }, "Devenir Premium")),
        step(3, access?.eligible, "Ouvrir votre centre de contrôle", "Il apparaît dans votre profil dès que le numéro est confirmé et l'abonnement actif.", access?.eligible ? h("a", { class: "btn btn-small btn-primary", href: "#/centre" }, "Ouvrir") : null))),

    h("section", { class: "stack" }, h("h2", null, "Questions fréquentes"), FAQ.map(([q, a]) => h("details", { class: "card pad pm-faq" }, h("summary", null, q), h("p", { class: "small" }, a)))),
    premiumCard(access, "page-premium"));
}
