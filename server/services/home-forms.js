// Messages envoyés par les blocs « Formulaire » de l'accueil : dépôt public limité et filtré, lecture et traitement par le personnel.
import { randomUUID } from "node:crypto";
import { badRequest, notFound } from "../lib/errors.js";

const PHONE = /^\+?[0-9][0-9 .\-()]{5,19}$/;
const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/;

export function createHomeForms({ db, accounts, siteHeader }) {
  const clean = (v) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim();
  return {
    /** Dépôt public. Le champ piège « website » rempli = robot : on répond « ok » sans rien enregistrer. */
    async submit({ blockId, name, contact, message, website }) {
      if (clean(website)) return { ok: true, successText: "" };
      const sec = (await siteHeader.getLayout()).sections.find((x) => x.id === blockId && x.custom && x.block?.type === "form" && x.visible !== false);
      if (!sec) throw notFound("Ce formulaire n'est plus disponible.");
      const n = clean(name), c = clean(contact), m = clean(message);
      if (!n || n.length > 80) throw badRequest("Indiquez votre nom (80 caractères maximum).");
      if (!(PHONE.test(c) || EMAIL.test(c)) || c.length > 120) throw badRequest("Indiquez un numéro de téléphone ou une adresse e-mail valide.");
      if (!m || m.length > 1000) throw badRequest("Écrivez votre message (1000 caractères maximum).");
      await db.query("insert into ika_home_form_messages (id, block_id, block_title, name, contact, message) values ($1, $2, $3, $4, $5, $6)", [randomUUID(), blockId, sec.block.title || "", n, c, m]);
      return { ok: true, successText: sec.block.successText || "" };
    },
    async list(userId, status = "NEW") {
      await accounts.requirePermission(userId, "contenu.gerer");
      const st = status === "HANDLED" ? "HANDLED" : "NEW";
      return db.query("select id, block_title, name, contact, message, status, created_at, handled_at from ika_home_form_messages where status = $1 order by created_at desc limit 200", [st]);
    },
    async count(userId) {
      await accounts.requirePermission(userId, "contenu.gerer");
      return (await db.query("select count(*)::int as n from ika_home_form_messages where status = 'NEW'"))[0]?.n ?? 0;
    },
    async handle(userId, id) {
      await accounts.requirePermission(userId, "contenu.gerer");
      const rows = await db.query("update ika_home_form_messages set status = 'HANDLED', handled_by = $2, handled_at = now() where id = $1 and status = 'NEW' returning id", [String(id), userId]);
      if (!rows.length) throw notFound("Message introuvable ou déjà traité.");
      await accounts.audit(userId, "HOME_FORM_HANDLED", null, `message ${String(id)} marqué traité`);
      return { ok: true };
    },
    async remove(userId, id) {
      await accounts.requirePermission(userId, "contenu.gerer");
      const rows = await db.query("delete from ika_home_form_messages where id = $1 returning id", [String(id)]);
      if (!rows.length) throw notFound("Message introuvable.");
      await accounts.audit(userId, "HOME_FORM_DELETED", null, `message ${String(id)} supprimé`);
      return { ok: true };
    },
  };
}
