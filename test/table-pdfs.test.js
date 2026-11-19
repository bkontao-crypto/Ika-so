import test from "node:test";
import assert from "node:assert/strict";
import { leadsToPdf, moderationAuditToPdf } from "../server/lib/table-pdfs.js";

const ok = (b) => { const s = Buffer.from(b).toString("latin1"); assert.ok(s.startsWith("%PDF-1.4")); assert.ok(s.trimEnd().endsWith("%%EOF")); return s; };

test("leadsToPdf : PDF valide, vide et rempli", () => {
  ok(leadsToPdf([]));
  ok(leadsToPdf(Array.from({ length: 700 }, (_, i) => ({ contact_name: `Contact é ${i}`, score: i % 100, status: "NEW", created_at: "2026-11-01T10:00:00Z" }))));
});
test("moderationAuditToPdf : PDF valide, vide et rempli", () => {
  ok(moderationAuditToPdf(undefined));
  ok(moderationAuditToPdf([{ action: "APPROVE", target_type: "listing", target_id: "abcdef123456", actor_id: "u1", details: { a: "é" }, created_at: "2026-11-01T10:00:00Z" }]));
});
