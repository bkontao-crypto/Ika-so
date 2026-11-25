// Android : l'import de photos de « Nouvelle publication » ne doit pas vider le champ avant la lecture des fichiers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../public/js/components/post-composer.js", import.meta.url), "utf8");

test("le champ photos accepte toute image (image/*)", () => assert.match(src, /type: "file", accept: "image\/\*", multiple: true/));
test("le champ n'est vidé qu'après la lecture des photos", () => {
  const body = src.slice(src.indexOf("async function addFiles"), src.indexOf("async function addAll"));
  assert.match(body, /await addAll\(files\)/);
  assert.ok(body.indexOf("await addAll") < body.indexOf('input.value = ""'), "vidage avant lecture");
});
