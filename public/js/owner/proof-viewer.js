// Aperçu d'une pièce justificative DANS la plateforme : image ou PDF, sans bouton de téléchargement ni d'enregistrement.
// (Une capture d'écran reste possible : aucun navigateur ne peut l'empêcher.) La pièce n'est jamais écrite sur le disque.
import { h } from "/js/dom.js";

let pdfLib;
function loadPdfJs() {
  if (pdfLib) return pdfLib;
  pdfLib = new Promise((resolve, reject) => {
    if (window.pdfjsLib) return resolve(window.pdfjsLib);
    const s = document.createElement("script");
    s.src = "/vendor/pdfjs/pdf.min.js";
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.js"; resolve(window.pdfjsLib); };
    s.onerror = () => reject(new Error("Lecteur de PDF indisponible."));
    document.head.append(s);
  });
  return pdfLib;
}

const bytesOf = (dataUrl) => Uint8Array.from(atob(String(dataUrl).split(",")[1] ?? ""), (c) => c.charCodeAt(0));

/** fileData : data URL renvoyée par le serveur. title : texte d'en-tête. */
export async function previewDocument(fileData, title = "Pièce justificative") {
  const type = String(fileData).slice(5, String(fileData).indexOf(";"));
  const body = h("div", { class: "pv-body" }, h("p", { class: "pv-wait" }, "Chargement de la pièce…"));
  const close = () => { overlay.remove(); document.removeEventListener("keydown", onKey); document.body.classList.remove("pv-open"); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  const overlay = h("div", { class: "pv-back", role: "dialog", "aria-modal": "true", "aria-label": title, onContextmenu: (e) => e.preventDefault(), onClick: (e) => { if (e.target === overlay) close(); } },
    h("div", { class: "pv" },
      h("div", { class: "pv-head" }, h("strong", null, title), h("span", { class: "pv-note" }, "Aperçu protégé : pas de téléchargement"), h("button", { class: "btn sm", type: "button", onClick: close }, "Fermer")),
      body));
  document.body.append(overlay); document.body.classList.add("pv-open"); document.addEventListener("keydown", onKey);
  overlay.querySelector("button")?.focus();
  try {
    if (type.startsWith("image/")) {
      body.replaceChildren(h("img", { class: "pv-img", src: fileData, alt: title, draggable: "false", onDragstart: (e) => e.preventDefault() }));
    } else if (type === "application/pdf") {
      const lib = await loadPdfJs();
      const pdf = await lib.getDocument({ data: bytesOf(fileData) }).promise;
      body.replaceChildren();
      const width = Math.max(280, Math.min(900, body.clientWidth - 16));
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const scale = width / base.width, dpr = Math.min(window.devicePixelRatio || 1, 2);
        const vp = page.getViewport({ scale: scale * dpr });
        const canvas = h("canvas", { class: "pv-page", "aria-label": `Page ${n} sur ${pdf.numPages}` });
        canvas.width = Math.floor(vp.width); canvas.height = Math.floor(vp.height);
        canvas.style.width = `${Math.floor(vp.width / dpr)}px`; canvas.style.height = `${Math.floor(vp.height / dpr)}px`;
        body.append(canvas);
        await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
      }
    } else {
      body.replaceChildren(h("p", { class: "pv-wait" }, "Ce type de fichier ne peut pas être affiché."));
    }
  } catch (error) {
    body.replaceChildren(h("p", { class: "pv-wait" }, error?.message || "La pièce n'a pas pu être affichée."));
  }
}
