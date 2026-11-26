// Owner Center > Personnalisation du site : coque moderne.
// Onglets visibles en entier, enregistrement section par section, suivi des modifications non enregistrées,
// pied de page avec aperçu en direct. Les sections existantes et leurs endpoints (/staff/…) ne changent pas.
import { api, h, ico, act, toast, panel, initials, confirmDialog } from "./ui.js";
import { headerSection, layoutSection } from "./v-header.js";
import { page, settingsSection, appearanceSection, consentServicesSection, homepageSection, seoSection } from "./v-modules.js";
import { brand } from "../core/brand.js";

const TABS = [
  ["identity", "Identité & contact", "Nom du site, e-mail, téléphone et devise affichés au public."],
  ["appearance", "Apparence & modules", "Couleurs du site et modules visibles (CRM, Premium)."],
  ["services", "Services et consentement", "Préférences des visiteurs et pixels marketing (jamais actifs sans leur accord)."],
  ["homepage", "Page d’accueil", "Photo, titre, textes et couleurs du haut de l’accueil."],
  ["header", "En-tête & onglets", "Menu du haut, logo, couleurs, barre du bas sur téléphone."],
  ["layout", "Sections de l’accueil", "Ordre, visibilité et blocs libres sous la recherche, avec brouillon et aperçu."],
  ["footer", "Pied de page", "Présentation, colonnes de liens et mention de droits, avec aperçu en direct."],
  ["seo", "Référencement", "Titre et description vus sur Google."],
  ["logo", "Logo", "Logo du site."],
  ["legal", "Pages légales", "Conditions générales, confidentialité et mentions légales."],
  ["security", "Sécurité", "Journal des connexions."],
];
const IDS = TABS.map(([id]) => id);
const labelOf = (id) => TABS.find(([x]) => x === id)?.[1] ?? id;
// Boutons qui modifient un brouillon sans déclencher d'événement « input » (déplacer, ajouter, retirer…).
const MUTATING = /^(\+|↑|↓|←|→|Supprimer|Retirer|Revenir|Utiliser)/;
const fill = (el, ...nodes) => el.replaceChildren(...nodes.flat(Infinity).filter(Boolean));
const okHref = (v) => /^(#|\/|https:\/\/|mailto:|tel:)/.test(v);

export const customizeView = (ctx, initial = "identity") => {
  let current = IDS.includes(initial) ? initial : "identity"; // survit au rechargement qui suit chaque enregistrement
  const dirty = new Set();
  let ui = null;
  const warn = (e) => { e.preventDefault(); e.returnValue = ""; };

  return page(ctx, {
    eyebrow: "SYSTÈME", title: "Personnalisation du site", desc: "Tout ce qui décrit le site public, au même endroit. Chaque section s’enregistre séparément.",
    load: async () => {
      const [settings, sec, home, seo, logo, legal, main, consent, header, layout, footer, forms] = await Promise.all([
        api("/staff/owner/settings"), api("/staff/owner/security-log"), api("/homepage-settings"),
        api("/staff/owner/seo"), api("/staff/owner/logo"), api("/staff/owner/legal"),
        api("/staff/superadmin-settings/main").then((r) => r.value ?? null).catch(() => null),
        api("/staff/superadmin-settings/consent_services").then((r) => r.value ?? null).catch(() => null),
        api("/staff/site-header"), api("/staff/home-layout"), api("/staff/site-footer"), api("/staff/home-forms").catch(() => ({ items: [], newCount: 0 }))]);
      return { settings, sec, home, seo, logo, legal, main, consent, header, layout: { ...layout, forms }, footer };
    },
    // Barre d'actions : indicateur de modifications, voir le site, enregistrer la section affichée. Créée avant build().
    actions: () => {
      const badgeText = h("span", null, "Modifications non enregistrées");
      const badge = h("span", { class: "cz-dirty", role: "status" }, badgeText);
      const save = h("button", { class: "btn primary", type: "button" }, ico("check"), "Enregistrer la section");
      ui = { badge, badgeText, save };
      return h("div", { class: "cz-actions" }, badge, h("a", { class: "btn", href: "/", target: "_blank", rel: "noopener" }, ico("external"), "Voir le site"), save);
    },
    build({ settings, sec, home, seo, logo, legal, main, consent, header, layout, footer }, reload) {
      dirty.clear();
      window.removeEventListener("beforeunload", warn);
      ctx.onLeave(() => window.removeEventListener("beforeunload", warn));
      const identitySec = settingsSection({ s: settings, sec }, reload);
      const seoParts = seoSection({ seo, logo, legal }, reload);
      const parts = {
        identity: identitySec[0], appearance: appearanceSection({ main }, reload), services: consentServicesSection({ consent }, reload),
        homepage: homepageSection(home, reload), header: headerSection(header, reload), layout: layoutSection(layout, reload),
        footer: footerWorkspace(footer, reload), seo: seoParts.slice(0, 1), logo: seoParts.slice(1, 2), legal: seoParts.slice(2), security: identitySec[1],
      };
      const panes = TABS.map(([id]) => h("section", { class: "ps-pane", "data-pane": id, role: "tabpanel" }, ...[].concat(parts[id])));
      const hint = h("p", { class: "cz-hint" });
      const btns = TABS.map(([id, label]) => h("button", { class: "ps-tab", type: "button", role: "tab", "data-tab": id, "aria-selected": "false", onClick: () => select(id) }, label));
      const wrap = h("div", { class: "cz-wrap" });
      const paneOf = (id) => panes.find((p) => p.dataset.pane === id);
      const primaryOf = (pane) => { const all = [...pane.querySelectorAll("button.btn.primary")]; return all.find((b) => !b.disabled) ?? all[0] ?? null; };

      function paint() {
        btns.forEach((b) => { b.classList.toggle("dirty", dirty.has(b.dataset.tab)); b.setAttribute("aria-selected", b.dataset.tab === current ? "true" : "false"); b.classList.toggle("active", b.dataset.tab === current); b.tabIndex = b.dataset.tab === current ? 0 : -1; });
        panes.forEach((p) => { p.hidden = p.dataset.pane !== current; });
        hint.textContent = TABS.find(([id]) => id === current)?.[2] ?? "";
        ui.save.hidden = !primaryOf(paneOf(current));
        ui.badge.classList.toggle("on", dirty.size > 0);
        ui.badgeText.textContent = dirty.size > 1 ? `${dirty.size} sections modifiées, non enregistrées` : "Modifications non enregistrées";
        if (dirty.size) window.addEventListener("beforeunload", warn); else window.removeEventListener("beforeunload", warn);
      }
      function select(id) { current = id; paint(); }
      const mark = (e) => {
        const pane = e.target.closest?.(".ps-pane"); if (!pane) return;
        dirty.add(pane.dataset.pane); paint();
      };
      wrap.addEventListener("input", mark);
      wrap.addEventListener("change", mark);
      wrap.addEventListener("click", (e) => {
        const b = e.target.closest?.("button"); if (!b || b.classList.contains("primary")) return;
        if (b.closest("article.card")?.querySelector("h2")?.textContent.startsWith("Messages reçus")) return; // actions immédiates, pas un brouillon
        if (MUTATING.test((b.getAttribute("aria-label") || b.textContent || "").trim())) mark(e);
      });
      // Un enregistrement recharge la page : on prévient avant de perdre les brouillons des AUTRES sections.
      wrap.addEventListener("click", async (e) => {
        const b = e.target.closest?.("button.btn.primary"); if (!b || b.dataset.czOk) return;
        const pane = b.closest(".ps-pane"); if (!pane) return;
        const others = [...dirty].filter((id) => id !== pane.dataset.pane);
        if (!others.length) return;
        e.preventDefault(); e.stopImmediatePropagation();
        if (await confirmDialog("Enregistrer cette section ?", `La page se recharge après l’enregistrement : les modifications non enregistrées des autres sections seront perdues (${others.map(labelOf).join(", ")}). Enregistrez-les d’abord pour les garder.`, "Enregistrer quand même")) {
          b.dataset.czOk = "1"; b.click(); delete b.dataset.czOk;
        }
      }, true);
      ui.save.onclick = () => {
        const b = primaryOf(paneOf(current)); if (!b) return;
        if (b.disabled) { toast("Corrigez d’abord les points signalés (texte illisible ou champ invalide).", true); return; }
        b.click();
      };
      const tablist = h("nav", { class: "ps-tabs", role: "tablist", "aria-label": "Sections de personnalisation" }, ...btns);
      tablist.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        const i = IDS.indexOf(current); const next = IDS[(i + (e.key === "ArrowRight" ? 1 : IDS.length - 1)) % IDS.length];
        select(next); btns[IDS.indexOf(next)].focus();
      });
      wrap.append(...panes);
      paint();
      return [tablist, hint, wrap];
    },
  });
};

/** Pied de page : formulaire à gauche, aperçu en direct à droite (ordinateur / téléphone). Même contenu enregistré qu'avant : { intro, copyright, columns:[{ title, links:[{ label, href }] }] }. */
function footerWorkspace(src, reload) {
  const d = JSON.parse(JSON.stringify(src));
  d.columns ??= [];
  let device = "desktop";
  const colsBox = h("div", { class: "stack" });
  const previewBox = h("div");
  const counter = h("span", { class: "cz-count" });
  const seg = h("div", { class: "cz-seg", role: "group", "aria-label": "Appareil de l’aperçu" });

  const swap = (arr, i, dir) => { const j = i + dir; if (j < 0 || j >= arr.length) return false; [arr[i], arr[j]] = [arr[j], arr[i]]; return true; };
  const redraw = () => { drawCols(); drawPreview(); };

  function drawPreview() {
    const mobile = device === "mobile";
    const cols = d.columns.map((c) => h("div", { class: "fp-col" }, h("h4", null, c.title || "Sans titre"),
      h("ul", null, c.links.length ? c.links.map((l) => h("li", null, l.label || "Lien sans nom")) : h("li", { class: "fp-empty" }, "Aucun lien"))));
    fill(previewBox, h("div", { class: `fp-frame${mobile ? " mobile" : ""}` },
      h("div", { class: "fp-bar" }, h("span", { class: "fp-dots", "aria-hidden": "true" }, h("i"), h("i"), h("i")), h("span", { class: "fp-url" }, location.host || brand()), h("span")),
      h("div", { class: "fp" },
        h("div", { class: "fp-top" }, h("div", { class: "fp-brand" }, h("span", { class: "fp-logo" }, initials(brand())), h("b", null, brand())), h("p", null, d.intro || "Le texte de présentation est vide.")),
        h("div", { class: "fp-cols" }, cols),
        h("div", { class: "fp-bottom" }, h("span", null, `© ${new Date().getFullYear()} ${d.copyright || ""}`.trim()), h("span", null, "Mentions légales · Gérer mes choix")))));
    const len = (d.intro ?? "").length;
    counter.textContent = `${len} / 400 caractères`;
    counter.classList.toggle("over", len > 400);
    seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.device === device)));
  }
  [["desktop", "Ordinateur"], ["mobile", "Téléphone"]].forEach(([id, label]) => seg.append(h("button", { type: "button", "data-device": id, "aria-pressed": "false", onClick: () => { device = id; drawPreview(); } }, label)));

  const bindText = (el, obj, key, after) => { el.addEventListener("input", () => { obj[key] = el.value; after?.(); }); return el; };
  function drawCols() {
    fill(colsBox, d.columns.map((c, ci) => h("article", { class: "cz-col" },
      h("div", { class: "cz-colhead" },
        h("button", { type: "button", class: "btn cz-ib", "aria-label": "Colonne vers la gauche", disabled: ci === 0, onClick: () => { swap(d.columns, ci, -1) && redraw(); } }, "←"),
        h("button", { type: "button", class: "btn cz-ib", "aria-label": "Colonne vers la droite", disabled: ci === d.columns.length - 1, onClick: () => { swap(d.columns, ci, 1) && redraw(); } }, "→"),
        bindText(h("input", { class: "input", maxlength: "30", value: c.title, placeholder: "Titre de la colonne", "aria-label": `Titre de la colonne ${ci + 1}` }), c, "title", drawPreview),
        h("button", { type: "button", class: "btn", onClick: () => { d.columns.splice(ci, 1); redraw(); } }, "Supprimer la colonne")),
      ...c.links.map((l, li) => {
        const warnEl = h("span", { class: "cz-warn cz-href" });
        const href = bindText(h("input", { class: "input cz-href", maxlength: "300", value: l.href, placeholder: "#/page, /page ou https://…", "aria-label": "Adresse du lien" }), l, "href", check);
        function check() { warnEl.textContent = l.href && !okHref(l.href) ? "L’adresse doit commencer par #/, / ou https://" : ""; }
        check();
        return h("div", { class: "stack" },
          h("div", { class: "cz-link" },
            h("button", { type: "button", class: "btn cz-ib", "aria-label": "Monter", disabled: li === 0, onClick: () => { swap(c.links, li, -1) && redraw(); } }, "↑"),
            h("button", { type: "button", class: "btn cz-ib", "aria-label": "Descendre", disabled: li === c.links.length - 1, onClick: () => { swap(c.links, li, 1) && redraw(); } }, "↓"),
            bindText(h("input", { class: "input", maxlength: "40", value: l.label, placeholder: "Nom du lien", "aria-label": "Nom du lien" }), l, "label", drawPreview),
            href,
            h("button", { type: "button", class: "btn", onClick: () => { c.links.splice(li, 1); redraw(); } }, "Retirer")),
          warnEl);
      }),
      h("div", null, h("button", { type: "button", class: "btn", disabled: c.links.length >= 10, onClick: () => { c.links.push({ label: "Nouveau lien", href: "#/" }); redraw(); } }, c.links.length >= 10 ? "10 liens au maximum" : "+ Ajouter un lien")))));
  }

  const intro = bindText(h("textarea", { class: "input", maxlength: "400", rows: "4", "aria-label": "Texte de présentation" }), d, "intro", drawPreview); intro.value = d.intro ?? "";
  const copy = bindText(h("input", { class: "input", maxlength: "120", value: d.copyright ?? "", "aria-label": "Mention de droits" }), d, "copyright", drawPreview);
  const addCol = h("button", { type: "button", class: "btn", onClick: () => { if (d.columns.length >= 4) { toast("Maximum : 4 colonnes.", true); return; } d.columns.push({ title: "Nouvelle colonne", links: [] }); redraw(); } }, "+ Ajouter une colonne");
  drawCols(); drawPreview();

  return h("div", { class: "cz-split" },
    h("div", { class: "cz-form" },
      panel("Présentation", "Texte sous le logo, en bas de page.", h("div", { class: "stack" },
        h("label", { class: "field" }, h("span", { class: "cz-fieldhead" }, "Texte de présentation", counter), intro),
        h("label", { class: "field" }, h("span", null, "Mention de droits (après « © année »)"), copy))),
      panel("Colonnes de liens", "Jusqu’à 4 colonnes de 10 liens. « Mentions légales » et « Gérer mes choix » restent toujours affichés en bas de page.", h("div", { class: "stack" }, colsBox, h("div", null, addCol))),
      h("div", { class: "cz-foot" },
        h("button", { class: "btn primary", type: "button", onClick: () => act(() => api("/staff/site-footer", { method: "PUT", body: d }), "Pied de page enregistré.", reload) }, "Enregistrer le pied de page"),
        h("button", { class: "btn", type: "button", onClick: reload }, "Annuler les modifications"))),
    h("aside", { class: "cz-sticky", "aria-label": "Aperçu du pied de page" },
      panel("Aperçu en direct", "Rendu approximatif : il se met à jour pendant que vous écrivez.", previewBox, seg)));
}
