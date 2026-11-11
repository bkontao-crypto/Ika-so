// Version automatique du cache hors connexion : empreinte du contenu des fichiers préchargés + de sw.js lui-même.
// Plus de numéro à changer à la main : si un fichier du site change, la version change.
//   node scripts/stamp-sw.mjs          écrit la version dans public/sw.js (à lancer avant chaque livraison)
//   node scripts/stamp-sw.mjs --check  échoue si la version écrite n'est plus à jour
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const VERSION_LINE = /^const VERSION = "[^"]*";$/m;

/** Calcule la version attendue pour un sw.js donné (la ligne VERSION est neutralisée avant l'empreinte). */
export function computeVersion(publicDir = PUBLIC) {
  const sw = readFileSync(join(publicDir, "sw.js"), "utf8");
  const shellBlock = /const SHELL = \[([\s\S]*?)\];/.exec(sw);
  if (!shellBlock) throw new Error("Liste SHELL introuvable dans sw.js.");
  const paths = [...shellBlock[1].matchAll(/"(\/[^"]*)"/g)].map((m) => m[1]);
  const hash = createHash("sha256");
  hash.update(sw.replace(VERSION_LINE, 'const VERSION = "";'));
  for (const p of paths) {
    hash.update(`\n${p}\n`);
    hash.update(readFileSync(join(publicDir, p === "/" ? "index.html" : p.slice(1))));
  }
  return `ika-so-${hash.digest("hex").slice(0, 10)}`;
}

export function currentVersion(publicDir = PUBLIC) {
  const m = /^const VERSION = "([^"]*)";$/m.exec(readFileSync(join(publicDir, "sw.js"), "utf8"));
  return m ? m[1] : null;
}

// pathToFileURL : un chemin avec espaces ou une lettre de lecteur Windows ne s'écrit pas « file://… » à la main (le script ne faisait alors rien, sans message).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const expected = computeVersion();
  const actual = currentVersion();
  if (process.argv.includes("--check")) {
    if (actual !== expected) {
      console.error(`[sw] version périmée : ${actual} (attendue ${expected}). Lancez « npm run stamp-sw ».`);
      process.exit(1);
    }
    console.log(`[sw] version à jour : ${actual}`);
  } else if (actual === expected) {
    console.log(`[sw] déjà à jour : ${actual}`);
  } else {
    const path = join(PUBLIC, "sw.js");
    writeFileSync(path, readFileSync(path, "utf8").replace(VERSION_LINE, `const VERSION = "${expected}";`));
    console.log(`[sw] ${actual} -> ${expected}`);
  }
}
