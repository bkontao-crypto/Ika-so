import test from "node:test";
import assert from "node:assert/strict";
import { createAdvertiserApplications } from "../server/services/advertiser-applications.js";

function mk(status) {
  const log = [], notes = [];
  const q = async (sql, a = []) => {
    if (/select id, status from ika_advertiser_applications/.test(sql)) return status ? [{ id: "app1", status }] : [];
    if (/select user_id from ika_profiles where staff_role/.test(sql)) return [{ user_id: "s1" }];
    log.push(sql); return [];
  };
  const db = { query: q, transaction: async (fn) => fn({ query: q }) };
  const svc = createAdvertiserApplications({ db, accounts: { ensureProfile: async () => ({ account_status: "ACTIVE" }), requireActive: async () => ({}) }, notify: async (u, n) => notes.push([u, n.title]) });
  return { svc, log, notes };
}
test("réponse du candidat : seulement si l'équipe a demandé des informations ; fil + statut + alerte équipe", async () => {
  const { svc, log, notes } = mk("ADDITIONAL_INFO_REQUIRED");
  await assert.rejects(svc.reply("u1", "app1", " "), /Écrivez/);
  const out = await svc.reply("u1", "app1", "Voici mes précisions.");
  assert.equal(out.status, "UNDER_REVIEW");
  assert.ok(log.some((s) => /insert into ika_advertiser_app_messages/.test(s)) && log.some((s) => /update ika_advertiser_applications set status = 'UNDER_REVIEW'/.test(s)));
  assert.deepEqual(notes, [["s1", "Réponse d'un candidat annonceur"]]);
  await assert.rejects(mk("PENDING").svc.reply("u1", "app1", "Bonjour"), /ne vous demande pas/);
  await assert.rejects(mk(null).svc.reply("u1", "app1", "Bonjour"), /introuvable/i);
});
