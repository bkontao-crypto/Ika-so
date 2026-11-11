import { CATEGORIES, COUNTRIES, DOCUMENTS, isDwelling, OWNER_ROLES, PHOTO_PRESETS, ROAD_ACCESS, TRANSACTIONS, ZONES, zonesOf, api, compressPhoto, digits, fail, h, mount, toast } from "/js/dom.js";
import { S, refreshSession } from "/js/core/state.js";
import { go } from "/js/core/router.js";
import { field, select } from "/js/components/ui.js";

export function emptyForm() {
  return { title: "", transaction: "Vente", category: "Terrain", country: COUNTRIES[0]?.code ?? "ML", zone: ZONES[0]?.name ?? "", price: "", surface: "", surfaceM2: "", road: ROAD_ACCESS[0], bedrooms: "", bathrooms: "", furnished: "non", declaredDocument: DOCUMENTS[0], description: "", photos: [PHOTO_PRESETS[0].url] };
}

export function formToBody(f, role, fullName) {
  const land = f.category === "Terrain";
  const dwelling = isDwelling(f.category);
  return {
    title: f.title, description: f.description, category: f.category, transactionType: f.transaction, neighborhood: f.zone, countryCode: f.country,
    price: Number(f.price), surfaceLabel: f.surface || (f.surfaceM2 ? `${f.surfaceM2} m²` : ""), surfaceM2: f.surfaceM2 ? Number(f.surfaceM2) : null,
    roadAccess: land ? f.road : null, bedrooms: dwelling ? Number(f.bedrooms) : null, bathrooms: dwelling ? Number(f.bathrooms) : null,
    furnished: dwelling ? f.furnished === "oui" : null, declaredDocument: f.declaredDocument,
    imageUrl: f.photos[0], imageUrls: f.photos, ownerRole: role, fullName,
  };
}

/** Étape « numéro » : code reçu par SMS. Sans service SMS configuré, le code est un code de démonstration sans badge. */
function phoneStep(onVerified) {
  const st = { phone: "", code: "", hint: "", note: "", role: S.meta?.displayRole ?? OWNER_ROLES[0] };
  const box = h("div", { class: "stack" });
  const draw = () => mount(box,
    h("h2", null, "Votre numéro"),
    field("Rôle", select(OWNER_ROLES, st.role, (v) => (st.role = v))),
    field("Téléphone Mali", h("input", { class: "input", inputmode: "tel", placeholder: "76 00 00 00", value: st.phone, onInput: (e) => (st.phone = e.target.value) })),
    h("button", { class: "btn btn-dark", type: "button", onClick: async () => {
      try {
        const r = await api("/me/otp", { method: "POST", body: { phone: st.phone, displayRole: st.role } });
        st.hint = r.hint; st.note = r.message; toast(r.demo ? "Code de démonstration affiché." : "Code envoyé par SMS.");
        draw();
      } catch (error) { fail(error); }
    } }, "Recevoir le code"),
    st.note ? h("p", { class: "notice" }, st.note, " ", st.hint ? h("strong", null, st.hint) : null) : null,
    field("Code à 6 chiffres", h("input", { class: "input", inputmode: "numeric", maxlength: "6", autocomplete: "one-time-code", value: st.code, onInput: (e) => (st.code = digits(e.target.value)) })),
    h("button", { class: "btn btn-primary", type: "button", onClick: async () => {
      try {
        const r = await api("/me/otp/verify", { method: "POST", body: { code: st.code } });
        toast(r.verifiedBySms ? "Numéro vérifié par SMS." : "Numéro confirmé en démonstration : l'annonce n'aura pas le badge « vérifié ».");
        await refreshSession();
        onVerified();
      } catch (error) { fail(error); }
    } }, "Valider le numéro"));
  draw();
  return box;
}

const TRANSACTION_LABELS = { Vente: "Vendre", Location: "Louer" };
const STEPS = ["Type de bien", "Détails", "Localisation", "Photos & documents"];
const DOC_HELP = {
  "Titre Foncier": "Document officiel de propriété délivré par l'État.",
  "Permis d'occuper": "Autorise à occuper le bien, mais ne remplace pas un titre.",
  "Lettre d'attribution": "Document administratif. Attention : ne constitue pas un titre de propriété.",
  "Bail": "Contrat de location, pour un logement, un local ou un bureau.",
  "En cours de régularisation": "Démarches engagées, sans document définitif pour l'instant.",
};
// Ordre d'affichage : les trois documents du formulaire, puis les deux autres reconnus par le serveur.
const DOC_ORDER = ["Titre Foncier", "Permis d'occuper", "Lettre d'attribution", "Bail", "En cours de régularisation"];
const MAX_PHOTOS = 5;

/**
 * Formulaire d'annonce (publication et modification) : une seule page en 4 sections
 * (type de bien, détails, localisation, photos et documents), avec brouillon automatique à la publication.
 * Les valeurs envoyées au serveur sont inchangées (Vente/Location, documents, etc.).
 */
export function listingForm({ f, title, submitLabel, onSubmit, withPhone, saveDraft }) {
  let phoneDone = !withPhone;
  const root = h("div", { class: "pub" });

  function drawForm() {
    const save = () => saveDraft?.(f);
    const section = (n, heading, ...content) => h("section", { class: "pub-section", id: `pub-s${n}`, "aria-labelledby": `pub-h${n}` },
      h("h2", { class: "pub-section-title", id: `pub-h${n}` }, heading), ...content);
    const num = (key, extra = {}) => h("input", { class: "input", inputmode: "numeric", value: f[key], onInput: (e) => { f[key] = digits(e.target.value); e.target.value = f[key]; save(); }, ...extra });
    const pick = (key, options, onChange) => select(options, f[key], (v) => { f[key] = v; onChange?.(); save(); });

    // ---- Section 1 : type de bien et transaction
    const priceLabel = h("span", null, f.transaction === "Location" ? "Loyer mensuel (FCFA)" : "Prix (FCFA)");
    const dyn = h("div", { class: "pub-grid" });
    function drawDyn() {
      const land = f.category === "Terrain";
      const dwelling = isDwelling(f.category);
      mount(dyn,
        land ? field("Accès routier", pick("road", ROAD_ACCESS)) : null,
        dwelling ? field("Chambres", num("bedrooms", { placeholder: "Ex : 4" })) : null,
        dwelling ? field("Salles d'eau", num("bathrooms", { placeholder: "Ex : 3" })) : null,
        dwelling ? field("Meublé", select(["oui", "non"], f.furnished, (v) => { f.furnished = v; save(); })) : null);
      dyn.hidden = !land && !dwelling;
    }
    const transactionSelect = h("select", { class: "input", onChange: (e) => { f.transaction = e.target.value; priceLabel.textContent = f.transaction === "Location" ? "Loyer mensuel (FCFA)" : "Prix (FCFA)"; save(); } },
      TRANSACTIONS.map((t) => h("option", { value: t, selected: t === f.transaction }, TRANSACTION_LABELS[t] ?? t)));
    const s1 = section(1, "Type de bien et transaction",
      h("div", { class: "pub-grid" },
        field("Je souhaite", transactionSelect),
        field("Type de bien", pick("category", CATEGORIES, drawDyn))));

    // ---- Section 2 : détails du bien
    const surfaceInput = h("input", { class: "input", inputmode: "numeric", placeholder: "Ex : 320", value: f.surfaceM2, onInput: (e) => {
      f.surfaceM2 = digits(e.target.value); e.target.value = f.surfaceM2;
      f.surface = f.surfaceM2 ? `${f.surfaceM2} m²` : "";
      save();
    } });
    const s2 = section(2, "Détails du bien",
      h("div", { class: "pub-grid" },
        field("Titre de l'annonce", h("input", { class: "input", maxlength: "140", placeholder: "Ex : Villa basse 4 chambres avec cour", value: f.title, onInput: (e) => { f.title = e.target.value; save(); } }), { class: "full" }),
        field("Description", h("textarea", { class: "input", maxlength: "3000", placeholder: "Décrivez votre bien (atouts, état, commodités…)", value: f.description, onInput: (e) => { f.description = e.target.value; save(); } }), { class: "full" }),
        h("div", null, field(priceLabel, num("price", { placeholder: "Ex : 85000000" })), h("span", { class: "pub-help" }, "Pour une location, indiquez le loyer mensuel.")),
        h("div", null, field("Surface (m²)", surfaceInput), h("span", { class: "pub-help" }, "Mesure indicative."))),
      dyn);

    // ---- Section 3 : pays et quartier (listes tenues à jour par le Superadmin)
    // Une annonce ancienne peut porter un pays ou un quartier masqué depuis : on le garde dans la liste pour ne pas le perdre à l'enregistrement.
    const countryChoices = () => {
      const list = COUNTRIES.map((c) => ({ value: c.code, label: c.name }));
      if (f.country && !list.some((c) => c.value === f.country)) list.push({ value: f.country, label: f.country });
      return list;
    };
    const zoneChoices = () => {
      const names = zonesOf(f.country).map((z) => z.name);
      if (f.zone && !names.includes(f.zone)) names.push(f.zone);
      return names;
    };
    const zoneBox = h("div");
    function drawZone() {
      const names = zoneChoices();
      if (!names.includes(f.zone)) f.zone = names[0] ?? "";
      mount(zoneBox, field("Quartier", select(names, f.zone, (v) => { f.zone = v; save(); })));
    }
    const countrySelect = h("select", { class: "input", onChange: (e) => { f.country = e.target.value; f.zone = zonesOf(f.country)[0]?.name ?? ""; drawZone(); save(); } },
      countryChoices().map((c) => h("option", { value: c.value, selected: c.value === f.country }, c.label)));
    drawZone();
    const s3 = section(3, "Localisation",
      h("div", { class: "pub-grid" }, field("Pays", countrySelect), zoneBox),
      h("div", { class: "pub-privacy" },
        h("strong", null, "Position privée par défaut"),
        h("p", null, "Seul le quartier est visible des visiteurs. Après l'envoi, vous pourrez placer le bien sur la carte (bouton « Localiser » de votre annonce) et choisir d'afficher sa position exacte.")));

    // ---- Section 4 : photos et document foncier
    const strip = h("div", { class: "photo-strip" });
    const count = h("p", { class: "pub-help" });
    function drawPhotos() {
      count.textContent = `Photos (${f.photos.length}/${MAX_PHOTOS})`;
      mount(strip, f.photos.map((url, i) => h("figure", null,
        h("img", { src: url, alt: `Photo ${i + 1}` }),
        f.photos.length > 1 ? h("button", { type: "button", onClick: () => { f.photos.splice(i, 1); drawPhotos(); save(); } }, "Retirer") : null)));
    }
    async function addFiles(files) {
      for (const file of [...files].filter((x) => x.type.startsWith("image/"))) {
        if (f.photos.length >= MAX_PHOTOS) { toast(`${MAX_PHOTOS} photos au maximum.`, true); break; }
        try { f.photos.push(await compressPhoto(file)); } catch (error) { fail(error); }
      }
      drawPhotos(); save();
    }
    const fileInput = h("input", { class: "pub-file", type: "file", accept: "image/*", multiple: true, onChange: async (e) => { await addFiles(e.target.files); e.target.value = ""; } });
    const drop = h("label", { class: "pub-drop",
      onDragover: (e) => { e.preventDefault(); drop.classList.add("is-over"); },
      onDragleave: () => drop.classList.remove("is-over"),
      onDrop: async (e) => { e.preventDefault(); drop.classList.remove("is-over"); await addFiles(e.dataTransfer?.files ?? []); } },
      fileInput,
      h("b", null, "Ajouter des photos"),
      h("small", null, "Glissez-déposez ou touchez pour choisir (réduites dans votre téléphone avant l'envoi)"));
    const docs = h("div", { class: "pub-radios", role: "radiogroup", "aria-label": "Document foncier déclaré" },
      DOC_ORDER.filter((d) => DOCUMENTS.includes(d)).map((d) => h("label", { class: "pub-radio" },
        h("input", { type: "radio", name: "declaredDocument", value: d, checked: f.declaredDocument === d, onChange: () => { f.declaredDocument = d; save(); } }),
        h("span", null, h("strong", null, d), h("small", null, DOC_HELP[d] ?? "")))));
    const s4 = section(4, "Photos et document foncier",
      drop, count, strip,
      field("Ou une illustration du site", select(PHOTO_PRESETS.map((p) => p.label), "", (label) => {
        const preset = PHOTO_PRESETS.find((p) => p.label === label);
        if (preset && f.photos.length < MAX_PHOTOS) { f.photos.push(preset.url); drawPhotos(); save(); }
      }, { blank: "Choisir" })),
      h("p", { class: "pub-label" }, "Document foncier déclaré"),
      docs,
      h("div", { class: "pub-warning", role: "note" },
        h("p", null, h("strong", null, "Rappel important : "), "IKA SO ne certifie pas juridiquement vos documents. Une lettre d'attribution ne doit jamais être présentée comme un titre foncier. L'équipe de modération examinera votre annonce avant publication.")));

    const sections = [s1, s2, s3, s4];

    // ---- Étapes : repères cliquables, mis en évidence selon la section visible
    const pills = STEPS.map((label, i) => h("button", { type: "button", class: "pub-step", "aria-current": i === 0 ? "step" : null,
      onClick: () => sections[i].scrollIntoView({ behavior: "smooth", block: "start" }) },
      h("span", { class: "pub-step-num" }, String(i + 1)), label));
    const setActive = (index) => pills.forEach((p, i) => { if (i === index) p.setAttribute("aria-current", "step"); else p.removeAttribute("aria-current"); });
    if (typeof IntersectionObserver !== "undefined") {
      const seen = new Map();
      const io = new IntersectionObserver((entries) => {
        if (!root.isConnected) return io.disconnect();
        for (const en of entries) seen.set(en.target, en.isIntersecting);
        const first = sections.findIndex((s) => seen.get(s));
        if (first >= 0) setActive(first);
      }, { rootMargin: "-15% 0px -60% 0px" });
      sections.forEach((s) => io.observe(s));
    }

    // ---- Envoi
    const goTo = (section, message) => { toast(message, true); section.scrollIntoView({ behavior: "smooth", block: "center" }); return false; };
    const valid = () => {
      const dwelling = isDwelling(f.category);
      if (f.title.trim().length < 5) return goTo(s2, "Le titre doit faire au moins 5 caractères.");
      if (!f.price) return goTo(s2, "Indiquez le prix.");
      if (dwelling ? !(f.surface.trim() || f.surfaceM2) : !f.surfaceM2) return goTo(s2, "La superficie en m² est obligatoire.");
      if (dwelling && (f.bedrooms === "" || f.bathrooms === "")) return goTo(s2, "Indiquez le nombre de chambres et de salles d'eau.");
      if (f.description.trim().length < 20) return goTo(s2, "La description doit contenir au moins 20 caractères.");
      if (!f.zone) return goTo(s3, "Choisissez un quartier.");
      return true;
    };
    const publish = h("button", { class: "btn-publish", type: "button", onClick: async (e) => {
      if (!valid()) return;
      const button = e.currentTarget;
      button.disabled = true;
      try { await onSubmit(); } catch (error) { fail(error); button.disabled = false; }
    } }, submitLabel);

    drawDyn();
    drawPhotos();
    mount(root,
      h("div", { class: "pub-head" },
        h("div", null, h("h1", { class: "title" }, title), h("p", { class: "muted" }, "Remplissez les informations ci-dessous pour mettre votre bien en ligne.")),
        saveDraft ? h("span", { class: "pub-draft" }, h("i", { "aria-hidden": "true" }), "Brouillon enregistré automatiquement") : null),
      h("nav", { class: "pub-steps", "aria-label": "Étapes" }, pills),
      sections,
      h("div", { class: "pub-actions" },
        h("button", { class: "btn-cancel", type: "button", onClick: () => go("/mes-annonces") }, "Annuler"),
        publish));
  }

  if (phoneDone) drawForm();
  else mount(root, h("h1", { class: "title" }, title), h("div", { class: "card pad stack" }, phoneStep(() => { phoneDone = true; drawForm(); })));
  return root;
}
