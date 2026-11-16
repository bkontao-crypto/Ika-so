// Garde-fou : les routes de session, de mot de passe et de vérification ne doivent jamais disparaître d'un commit.
// (Régression constatée : le commit dfeaf61 avait supprimé GET /me, POST /auth/logout, /auth/forgot, /auth/reset, /me/otp, /me/otp/verify.)
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../server/routes/index.js", import.meta.url), "utf8");
const ESSENTIELLES = [
  ["get", "/me"],
  ["post", "/auth/register"],
  ["post", "/auth/login"],
  ["post", "/auth/logout"],
  ["post", "/auth/forgot"],
  ["post", "/auth/reset"],
  ["post", "/me/otp"],
  ["post", "/me/otp/verify"],
  ["post", "/staff/accounts/:id/reset-link"],
  ["get", "/auth/google"],
  ["get", "/auth/google/callback"],
  ["get", "/auth/app-handoff"],
  ["get", "/config/auth"],
  ["get", "/staff/owner/dashboard"],
  ["get", "/staff/owner/activity"],
];

for (const [method, path] of ESSENTIELLES) {
  test(`route présente : ${method.toUpperCase()} /api${path}`, () => {
    const re = new RegExp(`router\\.${method}\\(\\s*"${path.replace(/[/:]/g, (c) => (c === ":" ? ":" : "\\/")).replace(/\\\//g, "\\/")}"`);
    assert.match(source, re);
  });
}
