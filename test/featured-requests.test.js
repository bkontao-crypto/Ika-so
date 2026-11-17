// Validation des demandes de mise à la une (sans base : le contrôle a lieu avant toute écriture).
import test from "node:test";
import assert from "node:assert/strict";
import { createFeaturedRequests } from "../server/services/featured-requests.js";

const allowAll = { requireActive: async () => {}, requirePermission: async () => {}, audit: async () => {} };
const emptyDb = { query: async () => [] };

test("demande : annonce introuvable ou non possédée → 404", async () => {
  const svc = createFeaturedRequests({ db: emptyDb, accounts: allowAll });
  await assert.rejects(svc.create("u1", { listingId: "x" }), (e) => e.status === 404);
});

test("décision : action inconnue → 400", async () => {
  const svc = createFeaturedRequests({ db: emptyDb, accounts: allowAll });
  await assert.rejects(svc.decide("staff1", "fr_1", { action: "PEUT_ETRE" }), (e) => e.status === 400);
});

test("refus : motif obligatoire → 400 avant toute écriture", async () => {
  let touched = false;
  const db = { query: async () => { touched = true; return []; } };
  const svc = createFeaturedRequests({ db, accounts: allowAll });
  await assert.rejects(svc.decide("staff1", "fr_1", { action: "REJECT", note: "" }), (e) => e.status === 400);
  assert.equal(touched, false);
});

test("liste : le modérateur sans permission est refusé", async () => {
  const deny = { requirePermission: async () => { const e = new Error("Réservé à la modération."); e.status = 403; throw e; } };
  const svc = createFeaturedRequests({ db: emptyDb, accounts: deny });
  await assert.rejects(svc.listForStaff("u9"), (e) => e.status === 403);
});
