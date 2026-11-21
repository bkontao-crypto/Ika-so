// Zone « Nouvelle publication » : texte, photos, type (actualité, je cherche, information). Partagée par Découvrir et le profil.
import { CATEGORIES, api, compressPhoto, fail, h, toast } from "/js/dom.js";
import { S } from "/js/core/state.js";
import { icon } from "/js/icons.js";

export const KIND_LABELS = { ACTUALITE: "Actualité", RECHERCHE: "Je cherche", INFORMATION: "Information" };
const KIND_HINTS = {
  ACTUALITE: "Partagez une nouvelle, un projet, un événement…",
  RECHERCHE: "Décrivez ce que vous cherchez : type de bien, quartier, budget… Les annonceurs et les membres pourront vous écrire.",
  INFORMATION: "Partagez une information utile : conseil, démarche, changement de réglementation…",
};
const TEXT_MAX = 2000;

export function loadDiscoverCss() {
  for (const href of ["/css/espace.css", "/css/decouvrir.css"]) if (!document.querySelector(`link[href="${href}"]`)) document.head.append(h("link", { rel: "stylesheet", href }));
}

/** Photos d'une publication : grille de 1 à 4 vignettes (« +N » s'il y en a davantage), chacune s'ouvre en grand. */
export function photoGrid(urls = []) {
  if (!urls.length) return null;
  return h("div", { class: `dc-photos n${Math.min(urls.length, 4)}` }, urls.slice(0, 4).map((u, i) => h("a", { href: u, target: "_blank", rel: "noopener", "aria-label": `Agrandir la photo ${i + 1}` },
    h("img", { src: u, alt: `Photo ${i + 1} de la publication`, loading: "lazy" }), urls.length > 4 && i === 3 ? h("span", { class: "dc-more" }, `+${urls.length - 4}`) : null)));
}

/** Lien vidéo YouTube / Facebook : carte-lien sûre qui s'ouvre dans un nouvel onglet (aucun lecteur externe intégré). */
export function videoCard(video) {
  if (!video?.url) return null;
  const name = video.provider === "facebook" ? "Facebook" : "YouTube";
  return h("a", { class: "dc-video", href: video.url, target: "_blank", rel: "noopener noreferrer nofollow" }, icon("play"), h("span", null, `Voir la vidéo sur ${name}`));
}

/** @param {{ onPosted?: () => void, defaultKind?: string }} opts */
export function postComposer({ onPosted = () => {}, defaultKind = "ACTUALITE" } = {}) {
  loadDiscoverCss();
  const root = h("section", { class: "card pad stack dc-composer", "aria-label": "Nouvelle publication" });
  let kind = defaultKind; let photos = []; let settings = { enabled: true, maxPhotos: 4, videoLinks: false };
  const text = h("textarea", { class: "input", rows: "4", maxlength: String(TEXT_MAX), "aria-label": "Texte de la publication", onInput: () => count() });
  const counter = h("small", { class: "muted" });
  const category = h("select", { class: "input", "aria-label": "Type de bien" }, h("option", { value: "" }, "Type de bien (facultatif)"), CATEGORIES.map((c) => h("option", { value: c }, c)));
  const zone = h("input", { class: "input", maxlength: "80", placeholder: "Quartier ou ville (facultatif)", "aria-label": "Quartier ou ville" });
  const thumbs = h("div", { class: "dc-thumbs" });
  const videoUrl = h("input", { class: "input", type: "url", maxlength: "300", placeholder: "Lien vidéo YouTube ou Facebook (facultatif)", "aria-label": "Lien vidéo YouTube ou Facebook" });
  const fileInput = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp", multiple: true, class: "sr-only", "aria-label": "Ajouter des photos", onChange: addFiles });
  const kinds = h("div", { class: "row dc-kinds", role: "group", "aria-label": "Type de publication" });
  const send = h("button", { class: "btn btn-primary", type: "button", onClick: submit }, "Publier");
  const photoBtn = h("button", { class: "btn", type: "button", onClick: () => fileInput.click() }, icon("image"), "Photos");
  const count = () => { counter.textContent = `${text.value.length}/${TEXT_MAX}`; };

  function draw() {
    text.placeholder = KIND_HINTS[kind];
    kinds.replaceChildren(...Object.entries(KIND_LABELS).map(([k, label]) => h("button", { class: "chip", type: "button", "aria-pressed": String(kind === k), onClick: () => { kind = k; draw(); } }, label)));
    thumbs.replaceChildren(...photos.map((p, i) => h("div", { class: "dc-thumb" }, h("img", { src: p, alt: `Photo ${i + 1}` }),
      h("button", { type: "button", class: "dc-thumb-x", "aria-label": `Retirer la photo ${i + 1}`, onClick: () => { photos.splice(i, 1); draw(); } }, icon("x")))));
    photoBtn.hidden = settings.maxPhotos === 0;
    photoBtn.lastChild.textContent = ` Photos (${photos.length}/${settings.maxPhotos})`;
    photoBtn.disabled = photos.length >= settings.maxPhotos;
    count();
  }

  async function addFiles(e) {
    const files = [...(e.target.files ?? [])]; e.target.value = "";
    for (const f of files) {
      if (photos.length >= settings.maxPhotos) { toast(`${settings.maxPhotos} photo${settings.maxPhotos > 1 ? "s" : ""} au maximum.`, true); break; }
      if (f.size > 12_000_000) { toast("Image trop volumineuse (12 Mo au maximum).", true); continue; }
      try { photos.push(await compressPhoto(f, 380_000)); draw(); } catch (error) { fail(error); }
    }
  }

  async function submit() {
    if (text.value.trim().length < 5) { toast("Le texte de la publication est trop court.", true); return; }
    send.disabled = true; send.textContent = "Publication…";
    try {
      await api("/me/discover", { method: "POST", body: { content: text.value.trim(), kind, category: category.value, zone: zone.value.trim(), photos, videoUrl: settings.videoLinks ? videoUrl.value.trim() : "" } });
      toast("Publication ajoutée.");
      text.value = ""; photos = []; category.value = ""; zone.value = ""; videoUrl.value = ""; draw();
      onPosted();
    } catch (error) { fail(error); } finally { send.disabled = false; send.textContent = "Publier"; }
  }

  function drawGuest() {
    root.replaceChildren(h("h3", null, "Nouvelle publication"), h("p", { class: "muted" }, "Connectez-vous pour partager une actualité, une information ou ce que vous cherchez."),
      h("a", { class: "btn btn-primary", href: "#/connexion" }, "Se connecter"));
  }

  async function init() {
    if (!S.user) { drawGuest(); return; }
    try { settings = await api("/discover/settings"); } catch { /* valeurs par défaut */ }
    if (!settings.enabled) { root.replaceChildren(h("h3", null, "Nouvelle publication"), h("p", { class: "muted" }, "Les publications sont fermées pour le moment.")); return; }
    root.replaceChildren(h("h3", null, "Nouvelle publication"), kinds, text,
      h("div", { class: "dc-optional" }, category, zone), thumbs, fileInput, settings.videoLinks ? videoUrl : null,
      h("p", { class: "small muted" }, "Pas de numéro de téléphone : les personnes intéressées vous écrivent par la messagerie. Ce n'est pas une annonce professionnelle."),
      h("div", { class: "row between" }, h("div", { class: "row" }, photoBtn, counter), send));
    draw();
  }
  init();
  return root;
}
