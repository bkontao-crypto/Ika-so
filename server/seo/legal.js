/**
 * Pages juridiques publiques, rendues depuis les textes de docs/juridique (une seule source de vérité).
 * Les textes sont des PROJETS tant qu'un juriste malien ne les a pas validés : la bannière reste affichée
 * tant que LEGAL_VALIDATED est faux (à passer à vrai par le propriétaire après validation, dans lib/legal.js).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { esc, layout } from "./render.js";
import { LEGAL_VALIDATED, LEGAL_VERSION } from "../lib/legal.js";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "docs", "juridique");

export const LEGAL_PAGES = [
  { path: "/confidentialite", file: "projet-confidentialite.md", title: "Politique de confidentialité" },
  { path: "/conditions", file: "projet-conditions.md", title: "Conditions d'utilisation" },
];

const inline = (text) => esc(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`(.+?)`/g, "<code>$1</code>");

/** Mini convertisseur Markdown : titres, listes, tableaux, citations, gras. Tout est échappé avant mise en forme. */
export function renderMarkdown(md) {
  const out = [];
  const lines = String(md).split(/\r?\n/);
  let list = null; let table = null;
  const close = () => { if (list) { out.push("</ul>"); list = null; } if (table) { out.push("</tbody></table></div>"); table = null; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\|/.test(line)) {
      const cells = line.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
      if (!table) { if (list) close(); out.push(`<div class="table-wrap"><table><thead><tr>${cells.map((c) => `<th scope="col">${inline(c)}</th>`).join("")}</tr></thead><tbody>`); table = true; continue; }
      out.push(`<tr>${cells.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`); continue;
    }
    if (table) close();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const item = /^\s*[-*]\s+(.*)$/.exec(line);
    if (heading) { close(); const n = heading[1].length + 1; out.push(`<h${n}>${inline(heading[2])}</h${n}>`); }
    else if (item) { if (!list) { out.push("<ul>"); list = true; } out.push(`<li>${inline(item[1])}</li>`); }
    else if (/^>\s?/.test(line)) { close(); out.push(`<p class="notice">${inline(line.replace(/^>\s?/, ""))}</p>`); }
    else if (line.trim() === "") close();
    else { close(); out.push(`<p>${inline(line)}</p>`); }
  }
  close();
  return out.join("\n");
}

/** Texte saisi par le propriétaire (Owner Control) : s'il existe, il remplace le projet de docs/juridique pour cette page. */
const customText = (page, site) => String(({ "/confidentialite": site?.privacy, "/conditions": site?.cgu })[page.path] ?? "").trim();

export function legalPage({ base, page, site = null }) {
  const custom = customText(page, site);
  let md;
  if (custom) md = /^#\s/.test(custom) ? custom : `# ${page.title}\n\n${custom}`;
  else { try { md = readFileSync(join(DIR, page.file), "utf8"); } catch { return null; } }
  // Le premier titre (# ...) devient le <h1> de la page ; le texte est rendu tel quel, sans embellissement.
  const banner = custom || LEGAL_VALIDATED ? "" : `<p class="notice"><strong>Texte provisoire.</strong> Ce document n'a pas encore été relu par un juriste. Il décrit ce que le service fait réellement. Version ${esc(LEGAL_VERSION)}.</p>`;
  const body = `<article class="stack legal">${banner}${renderMarkdown(md).replace("<h2>", '<h1 class="title">').replace("</h2>", "</h1>")}</article>`;
  return layout({ base, path: page.path, title: `${page.title} | Ika So`, description: `${page.title} du service Ika So (Mali).`, body });
}
