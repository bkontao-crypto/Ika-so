// Bloc « Formulaire » de l'accueil : dépôt public filtré, lecture et traitement réservés au personnel.
import test from "node:test";
import assert from "node:assert/strict";
import { createHomeForms } from "../server/services/home-forms.js";
import { createSiteHeader } from "../server/services/site-header.js";

const make = ({ deny = false, visible = true, type = "form" } = {}) => {
  const rows = []; const kv = new Map();
  const db = { async query(sql, p = []) {
    if (/^select value from ika_settings/.test(sql)) return kv.has(p[0]) ? [{ value: kv.get(p[0]) }] : [];
    if (/^insert into ika_settings/.test(sql)) { kv.set(p[0], p[1]); return []; }
    if (/^insert into ika_home_form_messages/.test(sql)) { rows.push({ id: p[0], block_id: p[1], block_title: p[2], name: p[3], contact: p[4], message: p[5], status: "NEW" }); return []; }
    if (/^select count/.test(sql)) return [{ n: rows.filter((r) => r.status === "NEW").length }];
    if (/^select id, block_title/.test(sql)) return rows.filter((r) => r.status === p[0]);
    if (/^update ika_home_form_messages/.test(sql)) { const r = rows.find((x) => x.id === p[0] && x.status === "NEW"); if (!r) return []; r.status = "HANDLED"; return [{ id: r.id }]; }
    if (/^delete from ika_home_form_messages/.test(sql)) { const i = rows.findIndex((x) => x.id === p[0]); if (i < 0) return []; rows.splice(i, 1); return [{ id: p[0] }]; }
    return [];
  } };
  const accounts = { requirePermission: async () => { if (deny) throw new Error("interdit"); }, audit: async () => {} };
  const siteHeader = createSiteHeader({ db, accounts });
  const forms = createHomeForms({ db, accounts, siteHeader });
  const publish = () => siteHeader.saveLayout("u", { sections: [{ id: "b_form0001", visible, custom: true, block: { type, title: "Écrivez-nous", text: "", buttonLabel: "", successText: "", devices: { desktop: true, tablet: true, mobile: true } } }] });
  return { rows, forms, siteHeader, publish };
};
const ok = { blockId: "b_form0001", name: "Awa Traoré", contact: "+223 70 00 00 00", message: "Bonjour, je cherche un terrain." };

test("bloc formulaire : valeurs par défaut du bouton et de la confirmation, pas de lien", async () => {
  const { publish } = make();
  const out = await publish();
  const b = out.sections[0].block;
  assert.equal(b.buttonLabel, "Envoyer"); assert.equal(b.buttonHref, ""); assert.match(b.successText, /Merci/);
});
test("dépôt : enregistré, téléphone ou e-mail acceptés", async () => {
  const { forms, rows, publish } = make(); await publish();
  assert.equal((await forms.submit(ok)).ok, true);
  assert.equal((await forms.submit({ ...ok, contact: "awa@exemple.ml" })).ok, true);
  assert.equal(rows.length, 2); assert.equal(rows[0].block_title, "Écrivez-nous");
});
test("dépôt : robot (champ piège rempli) ignoré sans erreur ni enregistrement", async () => {
  const { forms, rows, publish } = make(); await publish();
  assert.equal((await forms.submit({ ...ok, website: "http://spam.example" })).ok, true);
  assert.equal(rows.length, 0);
});
test("dépôt : refus des données invalides et des blocs inexistants, masqués ou d'un autre type", async () => {
  const { forms, publish } = make(); await publish();
  const bad = (o, re = /./) => assert.rejects(() => forms.submit({ ...ok, ...o }), re);
  await bad({ name: "" }, /nom/); await bad({ name: "x".repeat(81) }, /nom/);
  await bad({ contact: "abc" }, /téléphone/); await bad({ contact: "<script>@x.ml" }, /téléphone/);
  await bad({ message: "" }, /message/); await bad({ message: "x".repeat(1001) }, /message/);
  await bad({ blockId: "b_autre001" }, /plus disponible/);
  await assert.rejects(async () => { const m = make({ visible: false }); await m.publish(); await m.forms.submit(ok); }, /plus disponible/);
  await assert.rejects(async () => { const m = make({ type: "text" }); await m.publish(); await m.forms.submit(ok); }, /plus disponible/);
});
test("personnel : liste, comptage, traitement et suppression ; refus sans permission", async () => {
  const { forms, publish } = make(); await publish();
  await forms.submit(ok); await forms.submit({ ...ok, name: "Moussa" });
  assert.equal(await forms.count("u"), 2);
  const [first] = await forms.list("u", "NEW");
  await forms.handle("u", first.id);
  assert.equal(await forms.count("u"), 1); assert.equal((await forms.list("u", "HANDLED")).length, 1);
  await assert.rejects(() => forms.handle("u", first.id), /déjà traité/);
  const [second] = await forms.list("u", "NEW");
  await forms.remove("u", second.id); assert.equal(await forms.count("u"), 0);
  await assert.rejects(() => forms.remove("u", "inconnu"), /introuvable/i);
  const d = make({ deny: true });
  await assert.rejects(() => d.forms.list("u"), /interdit/); await assert.rejects(() => d.forms.handle("u", "x"), /interdit/);
});
