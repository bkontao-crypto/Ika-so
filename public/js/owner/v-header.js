// Owner Center > Personnalisation > En-tête : onglets (ajout, nom, ordre, visibilité), logo, couleurs, bouton Publier.
// Chaque couleur est contrôlée en direct (contraste WCAG) ; la publication est bloquée tant qu'un texte est illisible (le serveur revérifie).
import { api, h, panel, pill, act } from "./ui.js";
import { ratio, level, suggestInk, normalizeHex, MIN_TEXT } from "/js/lib/contrast.js";

const LEVEL_UI = { ok: ["ok", "Lisible"], low: ["warn", "Texte peu lisible"], bad: ["bad", "Texte illisible"] };
const fmt = (r) => (r == null ? "—" : `${String(r).replace(".", ",")}:1`);
const fill = (el, ...nodes) => el.replaceChildren(...nodes.flat().filter(Boolean)); // replaceChildren natif écrirait « null »
const readDataUrl = (file) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(new Error("Lecture impossible.")); r.readAsDataURL(file); });

/** Panneau « lisibilité » : une ligne par paire texte/fond à vérifier ; renvoie aussi le nombre de blocages. */
export function legibilityRows(pairs) {
  let blocking = 0;
  const rows = pairs.filter((p) => p.fg || p.bg).map((p) => {
    const bg = normalizeHex(p.bg), fg = normalizeHex(p.fg);
    const r = bg && fg ? ratio(fg, bg) : null;
    const lv = bg && fg ? level(r) : "bad";
    if (lv !== "ok") blocking += 1;
    const [tone, label] = LEVEL_UI[lv];
    const fix = bg && fg && lv !== "ok" ? suggestInk(fg, bg) : null;
    return h("div", { class: `lisib lisib-${lv}` },
      h("div", { class: "row" }, pill(tone, label), h("b", null, p.name)),
      h("p", { class: "small" }, bg && fg ? `Contraste ${fmt(r)} (minimum ${String(MIN_TEXT).replace(".", ",")}:1). ` : "Indiquez le fond ET le texte. ",
        h("span", { class: "lisib-sample", style: { background: bg || "#ccc", color: fg || "#000" } }, "Texte d'exemple")),
      fix ? h("button", { type: "button", class: "btn", onClick: () => p.apply(fix) }, `Utiliser ${fix}`) : null);
  });
  return { rows, blocking };
}

export function headerSection(src, reload) {
  const d = {
    tabs: src.tabs.map((t) => ({ ...t })), light: { ...src.light }, dark: { ...src.dark },
    publishLabel: src.publishLabel, publishVisible: src.publishVisible, themeToggle: src.themeToggle, logoUrl: src.pendingLogo || src.logoUrl || "",
  };
  const tabsBox = h("div", { class: "stack" }), logoBox = h("div", { class: "stack" }), colorsBox = h("div", { class: "stack" });
  const previewBox = h("div", { class: "stack" }), lisibBox = h("div", { class: "stack" });
  const saveBtn = h("button", { class: "btn primary", type: "button" }, "Publier l'en-tête");
  const note = h("p", { class: "small muted", role: "status" });

  const move = (i, dir) => { const j = i + dir; if (j < 0 || j >= d.tabs.length) return; [d.tabs[i], d.tabs[j]] = [d.tabs[j], d.tabs[i]]; drawTabs(); drawPreview(); };
  function drawTabs() {
    fill(tabsBox, ...d.tabs.map((t, i) => {
      const label = h("input", { class: "input", maxlength: "24", value: t.label, "aria-label": "Nom de l'onglet" });
      label.addEventListener("input", () => { t.label = label.value; drawPreview(); });
      const link = t.custom
        ? (() => { const x = h("input", { class: "input", maxlength: "300", value: t.href, placeholder: "#/annonces ou https://…", "aria-label": "Lien de l'onglet" }); x.addEventListener("input", () => { t.href = x.value; }); return x; })()
        : h("span", { class: "small muted" }, `Page d'origine (${t.href})`);
      const vis = h("input", { type: "checkbox", checked: t.visible !== false, "aria-label": "Afficher cet onglet" });
      vis.addEventListener("change", () => { t.visible = vis.checked; drawPreview(); });
      return h("div", { class: "row", style: { alignItems: "center", gap: "8px", flexWrap: "wrap" } },
        h("button", { type: "button", class: "btn", "aria-label": "Monter", disabled: i === 0, onClick: () => move(i, -1) }, "↑"),
        h("button", { type: "button", class: "btn", "aria-label": "Descendre", disabled: i === d.tabs.length - 1, onClick: () => move(i, 1) }, "↓"),
        label, link, h("label", { class: "small" }, vis, " Affiché"),
        t.custom ? h("button", { type: "button", class: "btn", onClick: () => { d.tabs.splice(i, 1); drawTabs(); drawPreview(); } }, "Supprimer") : null);
    }),
    h("div", null, h("button", { type: "button", class: "btn", disabled: d.tabs.length >= 16, onClick: () => {
      d.tabs.push({ id: `c_${Math.random().toString(36).slice(2, 10)}`, label: "Nouvel onglet", href: "#/", visible: true, custom: true }); drawTabs(); drawPreview();
    } }, "+ Ajouter un onglet")));
  }

  function drawLogo() {
    const status = h("span", { class: "small muted", role: "status" }, "PNG, JPEG ou WebP · 2 Mo maximum. Le logo choisi remplace celui de l'en-tête et le logo du site.");
    const file = h("input", { class: "input", type: "file", accept: "image/png,image/jpeg,image/webp", "aria-label": "Importer un logo" });
    file.addEventListener("change", async () => {
      const f = file.files?.[0]; if (!f) return;
      if (!/^image\/(png|jpeg|webp)$/.test(f.type) || f.size > 2 * 1024 * 1024) { status.textContent = "Format non accepté ou fichier supérieur à 2 Mo."; file.value = ""; return; }
      try { status.textContent = "Envoi…"; d.logoUrl = (await api("/staff/site-header/logo", { method: "POST", body: { dataUrl: await readDataUrl(f) } })).logoUrl; drawLogo(); drawPreview(); }
      catch (error) { status.textContent = error.message || "Envoi impossible."; }
    });
    fill(logoBox, 
      d.logoUrl ? h("img", { src: d.logoUrl, alt: "Logo actuel", style: { maxHeight: "64px", maxWidth: "240px", objectFit: "contain", background: "#fff", padding: "6px", borderRadius: "8px", border: "1px solid #ddd" } }) : h("p", { class: "small muted" }, "Logo d'origine du site."),
      file, status,
      d.logoUrl ? h("div", null, h("button", { type: "button", class: "btn", onClick: () => { d.logoUrl = ""; drawLogo(); drawPreview(); } }, "Revenir au logo d'origine")) : null);
  }

  const colorField = (obj, key, label) => {
    const text = h("input", { class: "input", maxlength: "7", placeholder: "thème", value: obj[key] || "", "aria-label": label });
    const pick = h("input", { type: "color", value: normalizeHex(obj[key]) || "#ffffff", "aria-label": `${label} (sélecteur)` });
    const set = (v) => { obj[key] = v; text.value = v; if (normalizeHex(v)) pick.value = normalizeHex(v); drawPreview(); };
    pick.addEventListener("input", () => set(pick.value));
    text.addEventListener("input", () => { obj[key] = text.value.trim(); drawPreview(); });
    return h("label", { class: "field" }, h("span", null, label), h("div", { class: "row", style: { gap: "8px" } }, pick, text));
  };
  function drawColors() {
    const reset = (o) => h("button", { type: "button", class: "btn", onClick: () => { o.bg = ""; o.ink = ""; drawColors(); drawPreview(); } }, "Couleurs du thème");
    fill(colorsBox, 
      h("div", { class: "form two" }, colorField(d.light, "bg", "Thème clair · fond"), colorField(d.light, "ink", "Thème clair · texte"), h("div", { class: "wide" }, reset(d.light))),
      h("div", { class: "form two" }, colorField(d.dark, "bg", "Thème sombre · fond"), colorField(d.dark, "ink", "Thème sombre · texte"), h("div", { class: "wide" }, reset(d.dark))),
      h("p", { class: "small muted" }, "Champs vides = couleurs d'origine du thème. Fond et texte vont ensemble."));
  }

  function bar(name, pair, fallback) {
    const bg = normalizeHex(pair.bg) || fallback.bg, ink = normalizeHex(pair.ink) || fallback.ink;
    return h("div", null, h("span", { class: "small muted" }, name),
      h("div", { class: "row", style: { alignItems: "center", gap: "14px", padding: "10px 14px", borderRadius: "10px", border: "1px solid #ccc", background: bg, color: ink, flexWrap: "wrap" } },
        d.logoUrl ? h("img", { src: d.logoUrl, alt: "", style: { height: "32px", objectFit: "contain" } }) : h("b", null, "IKA SÔ"),
        ...d.tabs.filter((t) => t.visible !== false).map((t) => h("span", { style: { fontWeight: "600", fontSize: "14px" } }, t.label || "—")),
        d.publishVisible ? h("span", { style: { marginLeft: "auto", border: `1px solid ${ink}`, borderRadius: "999px", padding: "2px 12px", fontSize: "13px" } }, d.publishLabel || "Publier") : null));
  }
  function drawPreview() {
    fill(previewBox, bar("Aperçu · thème clair", d.light, { bg: "#fbf9f4", ink: "#1b1f1d" }), bar("Aperçu · thème sombre", d.dark, { bg: "#14201b", ink: "#f2f2ee" }));
    const { rows, blocking } = legibilityRows([
      { name: "En-tête · thème clair", fg: d.light.ink, bg: d.light.bg, apply: (v) => { d.light.ink = v; drawColors(); drawPreview(); } },
      { name: "En-tête · thème sombre", fg: d.dark.ink, bg: d.dark.bg, apply: (v) => { d.dark.ink = v; drawColors(); drawPreview(); } },
    ]);
    fill(lisibBox, ...(rows.length ? rows : [h("p", { class: "small muted" }, "Couleurs d'origine : rien à contrôler.")]));
    saveBtn.disabled = blocking > 0;
    note.textContent = blocking ? "Publication bloquée : corrigez les textes illisibles ci-dessus." : "";
  }

  saveBtn.addEventListener("click", () => act(() => api("/staff/site-header", { method: "PUT", body: d }), "En-tête publié.", reload));
  drawTabs(); drawLogo(); drawColors(); drawPreview();

  const flags = h("div", { class: "stack" },
    h("label", { class: "field" }, h("span", null, "Texte du bouton principal"), (() => { const i = h("input", { class: "input", maxlength: "24", value: d.publishLabel }); i.addEventListener("input", () => { d.publishLabel = i.value; drawPreview(); }); return i; })()),
    h("label", { class: "small" }, (() => { const c = h("input", { type: "checkbox", checked: d.publishVisible }); c.addEventListener("change", () => { d.publishVisible = c.checked; drawPreview(); }); return c; })(), " Afficher le bouton « Publier » dans l'en-tête"),
    h("label", { class: "small" }, (() => { const c = h("input", { type: "checkbox", checked: d.themeToggle }); c.addEventListener("change", () => { d.themeToggle = c.checked; }); return c; })(), " Afficher le bouton clair / sombre"));

  return [
    panel("Onglets", "Ajoutez, renommez, réordonnez ou masquez. Les onglets d'origine ne se suppriment pas : on les masque.", tabsBox),
    panel("Logo", "Lié au logo du site : il remplace celui de l'en-tête.", logoBox),
    panel("Couleurs de l'en-tête", "Le fond et le texte sont contrôlés : un texte illisible bloque la publication.", h("div", { class: "stack" }, colorsBox, lisibBox)),
    panel("Bouton principal", null, flags),
    panel("Aperçu", "Rendu approximatif de la barre, avant publication.", previewBox),
    h("div", { class: "row" }, saveBtn, h("button", { class: "btn", type: "button", onClick: reload }, "Annuler les modifications"), note),
  ];
}

/** Sections de l'accueil : ordre et visibilité (le héros et la recherche restent en tête). */
export function layoutSection(src, reload) {
  const d = { sections: src.sections.map((x) => ({ ...x })), texts: JSON.parse(JSON.stringify(src.texts ?? {})) };
  const FIELDS = [["kicker", "Petit titre (au-dessus)", 40], ["title", "Titre", 120], ["text", "Texte d'introduction", 300]];
  const box = h("div", { class: "stack" });
  const draw = () => fill(box, d.sections.map((x, i) => {
    const vis = h("input", { type: "checkbox", checked: x.visible !== false, "aria-label": `Afficher ${src.labels[x.id]}` });
    vis.addEventListener("change", () => { x.visible = vis.checked; });
    const move = (dir) => { const j = i + dir; if (j < 0 || j >= d.sections.length) return; [d.sections[i], d.sections[j]] = [d.sections[j], d.sections[i]]; draw(); };
    return h("div", { class: "row", style: { alignItems: "center", gap: "8px", flexWrap: "wrap" } },
      h("button", { type: "button", class: "btn", "aria-label": "Monter", disabled: i === 0, onClick: () => move(-1) }, "↑"),
      h("button", { type: "button", class: "btn", "aria-label": "Descendre", disabled: i === d.sections.length - 1, onClick: () => move(1) }, "↓"),
      h("b", null, src.labels[x.id] ?? x.id), h("label", { class: "small" }, vis, " Affichée"),
      x.id === "download" ? null : h("details", { style: { flexBasis: "100%" } }, h("summary", { class: "small" }, "Modifier les textes"),
        h("div", { class: "form" }, FIELDS.map(([k, label, max]) => {
          const i = h("input", { class: "input", maxlength: String(max), placeholder: "Vide = texte d'origine", value: d.texts[x.id]?.[k] ?? "" });
          i.addEventListener("input", () => { (d.texts[x.id] ??= {})[k] = i.value; });
          return h("label", { class: "field" }, h("span", null, label), i);
        }))));
  }));
  draw();
  return [
    panel("Sections de l'accueil", "Sous la recherche : choisissez l'ordre, ce qui s'affiche et les textes des titres. Une section sans données reste masquée automatiquement.", box),
    h("div", { class: "row" },
      h("button", { class: "btn primary", type: "button", onClick: () => act(() => api("/staff/home-layout", { method: "PUT", body: d }), "Accueil enregistré.", reload) }, "Enregistrer l'accueil"),
      h("button", { class: "btn", type: "button", onClick: reload }, "Annuler les modifications")),
  ];
}

/** Pied de page : texte de présentation, colonnes de liens, mention de droits (les liens légaux et le choix des cookies restent fixes). */
export function footerSection(src, reload) {
  const d = JSON.parse(JSON.stringify(src));
  const box = h("div", { class: "stack" });
  const bind = (el, obj, key) => { el.addEventListener("input", () => { obj[key] = el.value; }); return el; };
  const swap = (arr, i, dir) => { const j = i + dir; if (j < 0 || j >= arr.length) return false; [arr[i], arr[j]] = [arr[j], arr[i]]; return true; };
  const draw = () => fill(box, d.columns.map((c, ci) => h("article", { class: "card panel stack" },
    h("div", { class: "row", style: { alignItems: "center", gap: "8px", flexWrap: "wrap" } },
      h("button", { type: "button", class: "btn", "aria-label": "Colonne à gauche", disabled: ci === 0, onClick: () => { swap(d.columns, ci, -1) && draw(); } }, "←"),
      h("button", { type: "button", class: "btn", "aria-label": "Colonne à droite", disabled: ci === d.columns.length - 1, onClick: () => { swap(d.columns, ci, 1) && draw(); } }, "→"),
      bind(h("input", { class: "input", maxlength: "30", value: c.title, "aria-label": "Titre de la colonne" }), c, "title"),
      h("button", { type: "button", class: "btn", onClick: () => { d.columns.splice(ci, 1); draw(); } }, "Supprimer la colonne")),
    ...c.links.map((l, li) => h("div", { class: "row", style: { alignItems: "center", gap: "8px", flexWrap: "wrap" } },
      h("button", { type: "button", class: "btn", "aria-label": "Monter", disabled: li === 0, onClick: () => { swap(c.links, li, -1) && draw(); } }, "↑"),
      h("button", { type: "button", class: "btn", "aria-label": "Descendre", disabled: li === c.links.length - 1, onClick: () => { swap(c.links, li, 1) && draw(); } }, "↓"),
      bind(h("input", { class: "input", maxlength: "40", value: l.label, "aria-label": "Nom du lien" }), l, "label"),
      bind(h("input", { class: "input", maxlength: "300", value: l.href, placeholder: "#/page, /page ou https://…", "aria-label": "Adresse du lien" }), l, "href"),
      h("button", { type: "button", class: "btn", onClick: () => { c.links.splice(li, 1); draw(); } }, "Retirer"))),
    h("div", null, h("button", { type: "button", class: "btn", disabled: c.links.length >= 10, onClick: () => { c.links.push({ label: "Nouveau lien", href: "#/" }); draw(); } }, "+ Ajouter un lien")))));
  draw();
  const intro = bind(h("textarea", { class: "input", maxlength: "400", rows: "3" }), d, "intro"); intro.value = d.intro;
  const copy = bind(h("input", { class: "input", maxlength: "120", value: d.copyright }), d, "copyright");
  return [
    panel("Présentation", "Texte sous le logo, en bas de page.", h("div", { class: "stack" }, h("label", { class: "field" }, h("span", null, "Texte de présentation"), intro), h("label", { class: "field" }, h("span", null, "Mention de droits (après « © année »)"), copy))),
    panel("Colonnes de liens", "Jusqu'à 4 colonnes de 10 liens. « Mentions légales » et « Gérer mes choix » restent toujours affichés en bas de page.", h("div", { class: "stack" }, box,
      h("div", null, h("button", { type: "button", class: "btn", disabled: false, onClick: () => { if (d.columns.length >= 4) return toastMax(); d.columns.push({ title: "Nouvelle colonne", links: [] }); draw(); } }, "+ Ajouter une colonne")))),
    h("div", { class: "row" },
      h("button", { class: "btn primary", type: "button", onClick: () => act(() => api("/staff/site-footer", { method: "PUT", body: d }), "Pied de page enregistré.", reload) }, "Enregistrer le pied de page"),
      h("button", { class: "btn", type: "button", onClick: reload }, "Annuler les modifications")),
  ];
  function toastMax() { box.append(h("p", { class: "small muted" }, "Maximum : 4 colonnes.")); }
}
