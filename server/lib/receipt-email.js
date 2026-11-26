// Formatage de l'email de reçu de paiement (E08)

// Le nom vient du profil de l'utilisateur : il est échappé avant d'entrer dans le HTML du courriel.
const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export function formatReceiptEmail({ reference, amountXof, offerName, date, invoiceUrl, userName }) {
  const amount = Number(amountXof || 0).toLocaleString("fr-FR");
  const when = date ? new Date(date).toLocaleString("fr-FR") : new Date().toLocaleString("fr-FR");
  const subject = `Paiement confirmé — ${amount} XOF — Ika So`;
  const text = [
    userName ? `Bonjour ${userName},` : "Bonjour,",
    "",
    "Votre paiement a été confirmé.",
    "",
    `Référence : ${reference || "—"}`,
    `Montant : ${amount} XOF`,
    `Offre : ${offerName || "—"}`,
    `Date : ${when}`,
    invoiceUrl ? `Facture : ${invoiceUrl}` : "",
    "",
    "Merci d'utiliser Ika So.",
  ].filter(Boolean).join("\n");

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px">
      <h2 style="color:#1a7f4b">Paiement confirmé</h2>
      <p>${userName ? `Bonjour ${esc(userName)},` : "Bonjour,"}</p>
      <p>Votre paiement a été confirmé.</p>
      <table style="border-collapse:collapse;width:100%">
        <tr><td style="padding:4px 0"><strong>Référence</strong></td><td>${esc(reference) || "—"}</td></tr>
        <tr><td style="padding:4px 0"><strong>Montant</strong></td><td>${amount} XOF</td></tr>
        <tr><td style="padding:4px 0"><strong>Offre</strong></td><td>${esc(offerName) || "—"}</td></tr>
        <tr><td style="padding:4px 0"><strong>Date</strong></td><td>${when}</td></tr>
      </table>
      ${invoiceUrl ? `<p><a href="${esc(invoiceUrl)}">Voir la facture</a></p>` : ""}
      <p style="color:#666;font-size:13px">Merci d'utiliser Ika So.</p>
    </div>`;

  return { subject, text, html };
}
