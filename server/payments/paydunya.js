/**
 * PayDunya (agrégateur mobile money). INACTIF tant que PAYMENT_PROVIDER n'est pas « paydunya ».
 * D'après la documentation publique (developers.paydunya.com) : création POST /checkout-invoice/create, callback (IPN)
 * en formulaire avec `data[hash]` = SHA-512 de la clé maître, puis confirmation GET /checkout-invoice/confirm/<token>.
 * On vérifie le hash ET on redemande le statut au fournisseur : seule la confirmation décide.
 * ⚠ Jamais exécuté contre le vrai service : testé avec un faux réseau. Voir docs/fournisseurs.md.
 */
import { createHash } from "node:crypto";
import { sameHash } from "../lib/security.js";

const HOSTS = { test: "https://app.paydunya.com/sandbox-api/v1", live: "https://app.paydunya.com/api/v1" };

/** Lit les champs « data[invoice][token] » d'un formulaire PHP. */
export function readIpn(rawBody) {
  const form = new URLSearchParams(String(rawBody ?? ""));
  const out = {};
  for (const [key, value] of form) {
    const m = /^data\[([^\]]+)\](?:\[([^\]]+)\])?/.exec(key);
    if (!m) continue;
    if (m[2]) (out[m[1]] ??= {})[m[2]] = value; else out[m[1]] = value;
  }
  return out;
}

export function createPaydunyaProvider({ masterKey, privateKey, token, mode = "test", publicUrl, storeName = "Ika So", fetchImpl = fetch }) {
  const base = HOSTS[mode === "live" ? "live" : "test"];
  const headers = { "Content-Type": "application/json", "PAYDUNYA-MASTER-KEY": masterKey, "PAYDUNYA-PRIVATE-KEY": privateKey, "PAYDUNYA-TOKEN": token };
  const masterHash = createHash("sha512").update(masterKey).digest("hex");
  return {
    name: "paydunya",
    async createCheckout(payment) {
      const r = await fetchImpl(`${base}/checkout-invoice/create`, {
        method: "POST", headers, signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({
          invoice: { total_amount: payment.amountXof, description: String(payment.label ?? "Ika So").slice(0, 120), customer: payment.customer ? { name: payment.customer.name ?? "", email: payment.customer.email ?? "", phone: payment.customer.phone ?? "" } : undefined },
          store: { name: storeName },
          custom_data: { payment_id: payment.id },
          actions: { return_url: `${publicUrl}/#/paiements`, cancel_url: `${publicUrl}/#/paiements`, callback_url: `${publicUrl}/api/payments/webhook` },
        }),
      });
      const data = await r.json().catch(() => null);
      if (data?.response_code !== "00" || !data?.token) throw new Error("Le paiement n'a pas pu être créé chez le fournisseur.");
      return { providerRef: String(data.token), instructions: "Vous allez être redirigé vers la page de paiement sécurisée de PayDunya.", paymentUrl: String(data.response_text) };
    },
    async parseWebhook(rawBody) {
      const ipn = readIpn(rawBody);
      const tok = String(ipn.invoice?.token ?? "");
      if (!tok || !sameHash(String(ipn.hash ?? ""), masterHash)) throw new Error("hash invalide");
      const r = await fetchImpl(`${base}/checkout-invoice/confirm/${encodeURIComponent(tok)}`, { headers, signal: AbortSignal.timeout(15_000) });
      const data = await r.json().catch(() => null);
      if (data?.response_code !== "00" || !data?.status) throw new Error("confirmation impossible");
      if (data.status === "pending") return { ignore: true };
      const paid = data.status === "completed";
      return { eventId: `${tok}:${data.status}`, providerRef: tok, status: paid ? "PAID" : "FAILED", amountXof: Number(data.invoice?.total_amount) };
    },
  };
}
