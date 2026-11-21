import test from "node:test";
import assert from "node:assert/strict";

import { parseVideoLink } from "../server/lib/discover.js";
test("liens vidéo : seuls YouTube et Facebook en https sont acceptés, adresse nettoyée", () => {
  assert.equal(parseVideoLink("https://youtu.be/dQw4w9WgXcQ?si=abc").url, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(parseVideoLink("https://www.facebook.com/watch/?v=1234567890123").provider, "facebook");
  for (const bad of ["http://youtu.be/dQw4w9WgXcQ", "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ", "https://user:pw@youtu.be/dQw4w9WgXcQ", "javascript:alert(1)", "https://evil.com/x", ""]) assert.equal(parseVideoLink(bad), null);
});
