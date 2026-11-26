// Owner Center > Personnalisation > En-tête : onglets (ajout, nom, ordre, visibilité), logo, couleurs, bouton Publier.
// Chaque couleur est contrôlée en direct (contraste WCAG) ; la publication est bloquée tant qu'un texte est illisible (le serveur revérifie).
import { api, h, panel, pill, act } from "./ui.js";
import { ratio, level, suggestInk, normalizeHex, MIN_TEXT } from "/js/lib/contrast.js";
import { brandUpper } from "../core/brand.js";

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
    mobile: [...src.mobile], tabs: src.tabs.map((t) => ({ ...t })), light: { ...src.light }, dark: { ...src.dark },
    publishLabel: src.publishLabel, publishVisible: src.publishVisible, themeToggle: src.themeToggle, logoUrl: src.pendingLogo || src.logoUrl || "",
  };
  const tabsBox = h("div", { class: "stack" }), logoBox = h("div", { class: "stack" }), colorsBox = h("div", { class: "stack" });
  const previewBox = h("div", { class: "stack" }), lisibBox = h("div", { class: "stack" });
  const mobileBox = h("div", { class: "stack" });
  const labelOf = (id) => src.mobileCatalog.find((c) => c.id === id)?.label ?? id;
  function drawMobile() {
    const free = src.mobileCatalog.filter((c) => !d.mobile.includes(c.id));
    const pick = h("select", { class: "input", "aria-label": "Ajouter un accès" }, h("option", { value: "" }, "+ Ajouter un accès…"), ...free.map((c) => h("option", { value: c.id }, c.label)));
    pick.addEventListener("change", () => { if (pick.value && d.mobile.length < 5) { d.mobile.push(pick.value); drawMobile(); } });
    fill(mobileBox, d.mobile.map((id, i) => h("div", { class: "row", style: { alignItems: "center", gap: "8px" } },
      h("button", { type: "button", class: "btn", "aria-label": "Monter", disabled: i === 0, onClick: () => { [d.mobile[i - 1], d.mobile[i]] = [d.mobile[i], d.mobile[i - 1]]; drawMobile(); } }, "↑"),
      h("button", { type: "button", class: "btn", "aria-label": "Descendre", disabled: i === d.mobile.length - 1, onClick: () => { [d.mobile[i + 1], d.mobile[i]] = [d.mobile[i], d.mobile[i + 1]]; drawMobile(); } }, "↓"),
      h("b", null, labelOf(id)), id === "publish" ? h("span", { class: "small muted" }, "(bouton central mis en valeur)") : null,
      id === "account" ? h("span", { class: "small muted" }, "(obligatoire)") : h("button", { type: "button", class: "btn", disabled: d.mobile.length <= 3, onClick: () => { d.mobile.splice(i, 1); drawMobile(); } }, "Retirer"))),
      d.mobile.length < 5 && free.length ? pick : null,
      h("p", { class: "small muted" }, "3 à 5 accès. « Compte » reste affiché pour que chacun puisse se connecter."));
  }
  drawMobile();
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
        d.logoUrl ? h("img", { src: d.logoUrl, alt: "", style: { height: "32px", objectFit: "contain" } }) : h("b", null, brandUpper()),
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
    panel("Barre du bas (téléphone)", "Les accès affichés en bas de l'écran sur mobile.", mobileBox),
    panel("Bouton principal", null, flags),
    panel("Aperçu", "Rendu approximatif de la barre, avant publication.", previewBox),
    h("div", { class: "row" }, saveBtn, h("button", { class: "btn", type: "button", onClick: reload }, "Annuler les modifications"), note),
  ];
}

/** Sections de l'accueil : ordre et visibilité (le héros et la recherche restent en tête). */
export function layoutSection(src, reload) {
  const base = src.draft ?? src; // un brouillon existant est repris tel quel
  const d = { sections: JSON.parse(JSON.stringify(base.sections)), texts: JSON.parse(JSON.stringify(base.texts ?? {})), cards: JSON.parse(JSON.stringify(base.cards ?? {})) };
  const FIELDS = [["kicker", "Petit titre (au-dessus)", 40], ["title", "Titre", 120], ["text", "Texte d'introduction", 300]];
  const box = h("div", { class: "stack" });
  const TYPES = { text: "Texte", image: "Texte + image", gallery: "Galerie", form: "Formulaire", cta: "Appel à l'action" };
  const lisib = h("div", { class: "stack" });
  const saveBtn = h("button", { class: "btn primary", type: "button" }, "Publier l'accueil");
  const draftBtn = h("button", { class: "btn", type: "button" }, "Enregistrer le brouillon");
  const previewBtn = h("button", { class: "btn", type: "button" }, "Aperçu (nouvel onglet)");
  const discardBtn = h("button", { class: "btn", type: "button" }, "Abandonner le brouillon");
  const status = h("span", { class: "small muted", role: "status" });
  function refreshLisib() {
    const pairs = d.sections.filter((x) => x.custom && (x.block.bg || x.block.ink)).map((x) => ({
      name: `Bloc « ${x.block.title || TYPES[x.block.type]} »`, fg: x.block.ink, bg: x.block.bg, apply: (v) => { x.block.ink = v; draw(); },
    }));
    const { rows, blocking } = legibilityRows(pairs);
    fill(lisib, rows);
    saveBtn.disabled = blocking > 0; draftBtn.disabled = blocking > 0; previewBtn.disabled = blocking > 0;
  }
  const newId = () => `b_${Math.random().toString(36).slice(2, 10).padEnd(8, "0")}`;
  const addBlock = (type) => {
    if (d.sections.filter((x) => x.custom).length >= 12) return;
    d.sections.push({ id: newId(), visible: true, custom: true, block: { type, title: type === "cta" ? "Votre titre" : type === "form" ? "Écrivez-nous" : "Titre du bloc", text: "", imageUrl: "", alt: "", images: [], successText: "", buttonLabel: "", buttonHref: "", bg: "", ink: "", devices: { desktop: true, tablet: true, mobile: true } } });
    draw();
  };
  function galleryEditor(b) {
    b.images ??= [];
    const status = h("span", { class: "small muted", role: "status" }, `${b.images.length}/6 images · PNG, JPEG ou WebP, 2 Mo maximum chacune.`);
    const file = h("input", { class: "input", type: "file", accept: "image/png,image/jpeg,image/webp", multiple: true, "aria-label": "Ajouter des images" });
    file.addEventListener("change", async () => {
      for (const f of [...(file.files ?? [])]) {
        if (b.images.length >= 6) break;
        if (!/^image\/(png|jpeg|webp)$/.test(f.type) || f.size > 2 * 1024 * 1024) { status.textContent = `« ${f.name} » : format non accepté ou supérieur à 2 Mo.`; continue; }
        try { status.textContent = "Envoi…"; b.images.push({ url: (await api("/staff/home-block-image", { method: "POST", body: { dataUrl: await readDataUrl(f) } })).imageUrl, alt: "" }); }
        catch (error) { status.textContent = error.message || "Envoi impossible."; }
      }
      draw();
    });
    return h("div", { class: "stack" }, file, status, ...b.images.map((im, n) => h("div", { class: "row", style: { alignItems: "center", gap: "8px" } },
      h("img", { src: im.url, alt: "", style: { height: "48px", borderRadius: "6px" } }),
      (() => { const a = h("input", { class: "input", maxlength: "120", placeholder: "Description de l'image", value: im.alt, "aria-label": "Description de l'image" }); a.addEventListener("input", () => { im.alt = a.value; }); return a; })(),
      h("button", { type: "button", class: "btn", onClick: () => { b.images.splice(n, 1); draw(); } }, "Retirer"))));
  }
  // Glisser-déposer : on saisit la poignée ⠿ et on dépose sur une autre ligne (les boutons ↑↓ restent disponibles, y compris au clavier).
  let dragFrom = null;
  function dragRow(el, i) {
    const handle = h("span", { class: "small muted", title: "Glisser pour déplacer", "aria-hidden": "true", style: { cursor: "grab", userSelect: "none", padding: "0 6px" } }, "⠿");
    handle.setAttribute("draggable", "true"); // h() écrit un attribut vide pour true : le navigateur veut la valeur "true"
    handle.addEventListener("dragstart", (e) => { dragFrom = i; e.dataTransfer?.setData("text/plain", String(i)); if (e.dataTransfer) e.dataTransfer.effectAllowed = "move"; });
    el.addEventListener("dragover", (e) => { if (dragFrom !== null) { e.preventDefault(); el.style.outline = "2px dashed #0b6b4f"; } });
    el.addEventListener("dragleave", () => { el.style.outline = ""; });
    el.addEventListener("drop", (e) => {
      e.preventDefault(); el.style.outline = "";
      if (dragFrom === null || dragFrom === i) { dragFrom = null; return; }
      const [moved] = d.sections.splice(dragFrom, 1); d.sections.splice(i, 0, moved); dragFrom = null; draw();
    });
    el.addEventListener("dragend", () => { dragFrom = null; });
    el.prepend(handle);
    return el;
  }
  function blockRow(x, i, vis, move) {
    const b = x.block;
    const bind = (el, key) => { el.addEventListener("input", () => { b[key] = el.value; refreshLisib(); }); return el; };
    const field = (label, el) => h("label", { class: "field" }, h("span", null, label), el);
    const text = bind(h("textarea", { class: "input", rows: "3", maxlength: "600" }), "text"); text.value = b.text;
    const status = h("span", { class: "small muted", role: "status" }, "PNG, JPEG ou WebP · 2 Mo maximum.");
    const file = h("input", { class: "input", type: "file", accept: "image/png,image/jpeg,image/webp", "aria-label": "Importer une image" });
    file.addEventListener("change", async () => {
      const f = file.files?.[0]; if (!f) return;
      if (!/^image\/(png|jpeg|webp)$/.test(f.type) || f.size > 2 * 1024 * 1024) { status.textContent = "Format non accepté ou fichier supérieur à 2 Mo."; file.value = ""; return; }
      try { status.textContent = "Envoi…"; b.imageUrl = (await api("/staff/home-block-image", { method: "POST", body: { dataUrl: await readDataUrl(f) } })).imageUrl; draw(); }
      catch (error) { status.textContent = error.message || "Envoi impossible."; }
    });
    const dev = (key, label) => { const c = h("input", { type: "checkbox", checked: b.devices[key] !== false }); c.addEventListener("change", () => { b.devices[key] = c.checked; }); return h("label", { class: "small" }, c, ` ${label}`); };
    return h("div", { class: "row", style: { alignItems: "center", gap: "8px", flexWrap: "wrap" } },
      h("button", { type: "button", class: "btn", "aria-label": "Monter", disabled: i === 0, onClick: () => move(-1) }, "↑"),
      h("button", { type: "button", class: "btn", "aria-label": "Descendre", disabled: i === d.sections.length - 1, onClick: () => move(1) }, "↓"),
      h("b", null, `${TYPES[b.type]} · ${b.title || "sans titre"}`), h("label", { class: "small" }, vis, " Affiché"),
      h("button", { type: "button", class: "btn", onClick: () => { d.sections.splice(i, 1); draw(); } }, "Supprimer le bloc"),
      h("details", { style: { flexBasis: "100%" } }, h("summary", { class: "small" }, "Modifier le bloc"),
        h("div", { class: "form" },
          field("Titre", bind(h("input", { class: "input", maxlength: "120", value: b.title }), "title")),
          field("Texte", text),
          b.type === "gallery" ? galleryEditor(b) : null,
          b.type === "cta" || b.type === "gallery" || b.type === "form" ? null : h("div", { class: "stack" },
            b.imageUrl ? h("img", { src: b.imageUrl, alt: "", style: { maxHeight: "90px", borderRadius: "8px" } }) : null,
            file, status,
            b.imageUrl ? h("button", { type: "button", class: "btn", onClick: () => { b.imageUrl = ""; draw(); } }, "Retirer l'image") : null,
            field("Description de l'image (lecteurs d'écran)", bind(h("input", { class: "input", maxlength: "120", value: b.alt }), "alt"))),
          b.type === "form"
            ? h("div", { class: "form two" },
              field("Bouton d'envoi · nom", bind(h("input", { class: "input", maxlength: "30", placeholder: "Envoyer", value: b.buttonLabel }), "buttonLabel")),
              field("Message de confirmation", bind(h("input", { class: "input", maxlength: "200", placeholder: "Merci, votre message a bien été envoyé.", value: b.successText }), "successText")))
            : h("div", { class: "form two" },
              field("Bouton · nom", bind(h("input", { class: "input", maxlength: "30", value: b.buttonLabel }), "buttonLabel")),
              field("Bouton · lien", bind(h("input", { class: "input", maxlength: "300", placeholder: "#/page, /page ou https://…", value: b.buttonHref }), "buttonHref"))),
          b.type === "form" ? h("p", { class: "small muted" }, "Le visiteur renseigne son nom, un téléphone ou e-mail et son message. Les messages arrivent plus bas, dans « Messages reçus ».") : null,
          h("div", { class: "form two" },
            field("Couleur de fond (vide = aucune)", bind(h("input", { class: "input", maxlength: "7", placeholder: "#0b3d2e", value: b.bg }), "bg")),
            field("Couleur du texte", bind(h("input", { class: "input", maxlength: "7", placeholder: "#ffffff", value: b.ink }), "ink"))),
          h("div", { class: "row", style: { gap: "14px" } }, h("span", { class: "small muted" }, "Afficher sur :"), dev("desktop", "Ordinateur"), dev("tablet", "Tablette"), dev("mobile", "Mobile")))));
  }
  const draw = () => { refreshLisib(); fill(box, d.sections.map((x, i) => {
    const vis = h("input", { type: "checkbox", checked: x.visible !== false, "aria-label": `Afficher ${src.labels[x.id]}` });
    vis.addEventListener("change", () => { x.visible = vis.checked; });
    const move = (dir) => { const j = i + dir; if (j < 0 || j >= d.sections.length) return; [d.sections[i], d.sections[j]] = [d.sections[j], d.sections[i]]; draw(); };
    const row = (el) => dragRow(el, i);
    if (x.custom) return row(blockRow(x, i, vis, move));
    return row(h("div", { class: "row", style: { alignItems: "center", gap: "8px", flexWrap: "wrap" } },
      h("button", { type: "button", class: "btn", "aria-label": "Monter", disabled: i === 0, onClick: () => move(-1) }, "↑"),
      h("button", { type: "button", class: "btn", "aria-label": "Descendre", disabled: i === d.sections.length - 1, onClick: () => move(1) }, "↓"),
      h("b", null, src.labels[x.id] ?? x.id), h("label", { class: "small" }, vis, " Affichée"),
      x.id === "download" ? null : h("details", { style: { flexBasis: "100%" } }, h("summary", { class: "small" }, "Modifier les textes"),
        h("div", { class: "form" }, FIELDS.map(([k, label, max]) => {
          const i = h("input", { class: "input", maxlength: String(max), placeholder: "Vide = texte d'origine", value: d.texts[x.id]?.[k] ?? "" });
          i.addEventListener("input", () => { (d.texts[x.id] ??= {})[k] = i.value; });
          return h("label", { class: "field" }, h("span", null, label), i);
        })),
        ...Array.from({ length: src.cardCounts?.[x.id] ?? 0 }, (_, n) => h("div", { class: "form two" },
          ...[["title", `Carte ${n + 1} · titre`, 60], ["text", `Carte ${n + 1} · texte`, 200]].map(([k, label, max]) => {
            const i = h("input", { class: "input", maxlength: String(max), placeholder: "Vide = texte d'origine", value: d.cards[x.id]?.[n]?.[k] ?? "" });
            i.addEventListener("input", () => { const list = (d.cards[x.id] ??= []); while (list.length <= n) list.push({ title: "", text: "" }); list[n][k] = i.value; });
            return h("label", { class: "field" }, h("span", null, label), i);
          }))))));
  })); };
  draw();
  saveBtn.addEventListener("click", () => act(() => api("/staff/home-layout", { method: "PUT", body: d }), "Accueil publié.", reload));
  draftBtn.addEventListener("click", () => act(() => api("/staff/home-layout/draft", { method: "PUT", body: d }), "Brouillon enregistré (non publié).", reload));
  discardBtn.addEventListener("click", () => act(() => api("/staff/home-layout/draft", { method: "DELETE" }), "Brouillon abandonné.", reload));
  previewBtn.addEventListener("click", async () => { // l'aperçu montre le brouillon : on l'enregistre d'abord
    try { status.textContent = "Préparation de l'aperçu…"; await api("/staff/home-layout/draft", { method: "PUT", body: d }); window.open("/#/?apercu=1", "_blank", "noopener"); status.textContent = "Aperçu ouvert. Le brouillon est enregistré, rien n'est publié."; }
    catch (error) { status.textContent = error.message || "Aperçu impossible."; }
  });
  return [
    panel("Sections de l'accueil", "Sous la recherche : choisissez l'ordre, ce qui s'affiche et les textes des titres. Une section sans données reste masquée automatiquement.", box),
    panel("Blocs libres", "Ajoutez vos propres blocs (jusqu'à 12) : ils se placent et se masquent comme les autres sections, appareil par appareil. Un texte illisible sur sa couleur de fond bloque l'enregistrement.", h("div", { class: "stack" },
      h("div", { class: "row", style: { gap: "8px", flexWrap: "wrap" } }, ...Object.entries(TYPES).map(([t, label]) => h("button", { type: "button", class: "btn", onClick: () => addBlock(t) }, `+ ${label}`))), lisib)),
    formMessagesPanel(src.forms, reload),
    src.draft ? h("p", { class: "small", role: "status" }, "Un brouillon non publié est en cours : vous le modifiez. Les visiteurs voient toujours la version publiée.") : null,
    h("div", { class: "row", style: { gap: "8px", flexWrap: "wrap", alignItems: "center" } }, draftBtn, previewBtn, saveBtn, src.draft ? discardBtn : null, h("button", { class: "btn", type: "button", onClick: reload }, "Annuler les modifications"), status),
  ].filter(Boolean); // replaceChildren natif écrirait « null » pour un élément absent
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

/** Messages reçus par les blocs « Formulaire » : à traiter, puis marqués traités ou supprimés. */
export function formMessagesPanel(initial, reload) {
  const box = h("div", { class: "stack" });
  let mode = "NEW";
  async function load(next) {
    mode = next;
    try { const r = await api(`/staff/home-forms?status=${mode}`); draw(r.items); }
    catch (error) { fill(box, h("p", { class: "small muted" }, error.message || "Chargement impossible.")); }
  }
  const draw = (items) => fill(box,
    h("div", { class: "row", style: { gap: "8px" } },
      h("button", { type: "button", class: "btn", disabled: mode === "NEW", onClick: () => load("NEW") }, "À traiter"),
      h("button", { type: "button", class: "btn", disabled: mode === "HANDLED", onClick: () => load("HANDLED") }, "Traités")),
    items.length ? items.map((m) => h("article", { class: "card panel stack" },
      h("div", null, h("b", null, m.name), ` · ${m.contact}`, h("span", { class: "small muted" }, ` · ${new Date(m.created_at).toLocaleString("fr-FR")}${m.block_title ? ` · ${m.block_title}` : ""}`)),
      h("p", { style: { whiteSpace: "pre-line", margin: 0 } }, m.message),
      h("div", { class: "row", style: { gap: "8px" } },
        mode === "NEW" ? h("button", { type: "button", class: "btn", onClick: () => act(() => api(`/staff/home-forms/${m.id}/handle`, { method: "POST" }), "Message marqué traité.", () => load(mode)) }, "Marquer traité") : null,
        h("button", { type: "button", class: "btn", onClick: () => { if (confirm("Supprimer définitivement ce message ?")) act(() => api(`/staff/home-forms/${m.id}`, { method: "DELETE" }), "Message supprimé.", () => load(mode)); } }, "Supprimer"))))
      : h("p", { class: "small muted" }, mode === "NEW" ? "Aucun message à traiter." : "Aucun message traité."));
  draw(initial?.items ?? []);
  return panel(`Messages reçus${initial?.newCount ? ` (${initial.newCount} à traiter)` : ""}`, "Envoyés par les blocs « Formulaire » de l'accueil. Données personnelles : supprimez les messages dont vous n'avez plus besoin.", box);
}
