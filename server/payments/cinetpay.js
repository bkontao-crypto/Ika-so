/**
 * CinetPay (agrégateur mobile money : Orange Money, Moov Money…). INACTIF tant que PAYMENT_PROVIDER n'est pas « cinetpay ».
 * D'après la documentation publique (docs.cinetpay.com, novembre 2026) : initialisation POST /v2/payment, notification
 * (formulaire) puis VÉRIFICATION obligatoire par POST /v2/payment/check. On ne croit jamais la notification seule :
 * seul le résultat de la vérification, demandée avec notre clé, décide du statut et du montant.
 * ⚠ Jamais exécuté contre le vrai service : testé avec un faux réseau. Voir docs/fournisseurs.md pour le premier essai réel.
 */
const BASE = "https://api-checkout.cinetpay.com/v2";

/** Identifiant de transaction : lettres et chiffres seulement (le format exact n'est pas précisé par le fournisseur). */
export const transactionId = (paymentId) => String(paymentId).replace(/[^A-Za-z0-9]/g, "");

export function createCinetpayProvider({ apiKey, siteId, publicUrl, channels = "MOBILE_MONEY", fetchImpl = fetch }) {
  const call = async (path, body) => {
    const r = await fetchImpl(`${BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) });
    const data = await r.json().catch(() => null);
    return { ok: r.ok, data };
  };
  return {
    name: "cinetpay",
    async createCheckout(payment) {
      // Règle du fournisseur : le montant doit être un multiple de 5, sinon la transaction échoue.
      if (!Number.isInteger(payment.amountXof) || payment.amountXof % 5 !== 0) throw new Error("Le montant doit être un multiple de 5 FCFA pour CinetPay.");
      const tid = transactionId(payment.id);
      const { data } = await call("/payment", {
        apikey: apiKey, site_id: siteId, transaction_id: tid, amount: payment.amountXof, currency: "XOF",
        description: String(payment.label ?? "Ika So").slice(0, 120), channels,
        notify_url: `${publicUrl}/api/payments/webhook`, return_url: `${publicUrl}/#/paiements`, lang: "fr",
        customer_id: payment.customer?.id ? String(payment.customer.id).slice(0, 60) : undefined,
        customer_name: payment.customer?.name ? String(payment.customer.name).slice(0, 60) : undefined,
      });
      if (data?.code !== "201" || !data?.data?.payment_url) throw new Error("Le paiement n'a pas pu être créé chez le fournisseur.");
      return { providerRef: tid, instructions: "Vous allez être redirigé vers la page de paiement sécurisée de CinetPay.", paymentUrl: String(data.data.payment_url) };
    },
    /** La notification est un formulaire ; son contenu n'est qu'un indice (identifiant de transaction). La vérification fait foi. */
    async parseWebhook(rawBody) {
      const form = new URLSearchParams(String(rawBody ?? ""));
      const tid = String(form.get("cpm_trans_id") ?? "");
      if (!tid || (form.get("cpm_site_id") && form.get("cpm_site_id") !== String(siteId))) throw new Error("notification invalide");
      const { data } = await call("/payment/check", { apikey: apiKey, site_id: siteId, transaction_id: tid });
      const status = data?.data?.status;
      if (!status) throw new Error("vérification impossible");
      if (status === "WAITING_FOR_CUSTOMER") return { ignore: true };
      return {
        eventId: `${tid}:${status}`, providerRef: tid,
        status: status === "ACCEPTED" ? "PAID" : "FAILED",
        amountXof: Number(data.data.amount),
      };
    },
  };
}
