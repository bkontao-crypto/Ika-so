// Correction 3 : le nom de plateforme (réglage modifiable) ne doit jamais être interprété comme du HTML.
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { installDom } from "./helpers/fake-dom.mjs";

register("./helpers/public-resolver.mjs", import.meta.url);
installDom();
const { replaceTextIn } = await import("/js/dom.js");

// Mini arbre de nœuds : 3 = texte, 1 = élément (seuls les champs lus par replaceTextIn).
const text = (value) => ({ nodeType: 3, nodeValue: value });
const el = (...kids) => ({ nodeType: 1, childNodes: kids });

test("remplace le nom dans les nœuds texte, y compris imbriqués", () => {
  const a = text("© "), year = el(text("2026")), b = text(" IKA SO Immobilier. Tous droits réservés.");
  const root = el(a, year, b);
  replaceTextIn(root, "IKA SO Immobilier", "Maison Bamako");
  assert.equal(b.nodeValue, " Maison Bamako. Tous droits réservés.");
  assert.equal(a.nodeValue, "© ");
  assert.equal(year.childNodes[0].nodeValue, "2026");
});

test("une balise saisie dans le nom reste du texte : aucun nœud créé", () => {
  const t = text("IKA SO Immobilier");
  const root = el(t);
  const payload = '<img src=x onerror="alert(1)">';
  replaceTextIn(root, "IKA SO Immobilier", payload);
  assert.equal(root.childNodes.length, 1, "aucun élément ajouté");
  assert.equal(root.childNodes[0], t);
  assert.equal(t.nodeValue, payload, "le texte est conservé tel quel (affiché, pas interprété)");
});

test("les motifs spéciaux de replace() (« $& », « $1 ») sont gardés littéralement", () => {
  const t = text("IKA SO Immobilier / IKA SO Immobilier");
  replaceTextIn(el(t), "IKA SO Immobilier", "A$&B$1");
  assert.equal(t.nodeValue, "A$&B$1 / A$&B$1");
});

test("racine absente ou motif vide : rien ne casse", () => {
  assert.doesNotThrow(() => replaceTextIn(null, "x", "y"));
  const t = text("abc");
  replaceTextIn(el(t), "", "y");
  assert.equal(t.nodeValue, "abc");
});

test("app.js n'utilise plus innerHTML (verrou de non-régression)", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../public/js/app.js", import.meta.url), "utf8");
  assert.ok(!/innerHTML/.test(src));
  assert.match(src, /replaceTextIn\(foot,/);
});
