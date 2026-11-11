// Abonnés : un abonnement anonyme n'expose ni identifiant, ni nom, ni photo.
import test from "node:test";
import assert from "node:assert/strict";
import { followerView } from "../server/services/reviews.js";

const row = { id: "u9", name: "Aminata Diallo", display_role: "Particulier", city: "Bamako", avatar_url: "/api/media/x", images_hidden: false, created_at: new Date("2026-05-01T10:00:00Z") };

test("abonné visible : identité complète", () => {
  const v = followerView({ ...row, anonymous: false });
  assert.equal(v.anonymous, false); assert.equal(v.id, "u9"); assert.equal(v.name, "Aminata Diallo"); assert.equal(v.avatarUrl, "/api/media/x");
});
test("abonné anonyme : rien d'identifiant", () => {
  const v = followerView({ ...row, anonymous: true });
  assert.deepEqual(Object.keys(v).sort(), ["anonymous", "name", "since"]);
  assert.equal(v.name, "Abonné anonyme");
  assert.doesNotMatch(JSON.stringify(v), /u9|Aminata|Bamako|media/);
});
test("photo masquée par la modération : pas d'avatar", () => {
  assert.equal(followerView({ ...row, anonymous: false, images_hidden: true }).avatarUrl, null);
});
