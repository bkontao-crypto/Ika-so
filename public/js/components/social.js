// Réactions communes aux annonces et aux publications : j'aime, commentaires publics (avec j'aime), partage interne et externe, photo en plein écran.
import { api, fail, h, toast } from "/js/dom.js";
import { S } from "/js/core/state.js";
import { needLogin } from "/js/core/router.js";
import { icon } from "/js/icons.js";
import { moduleNotice } from "/js/components/module-notice.js";

let cssDone = false;
export function loadSocialCss() {
  if (cssDone || document.querySelector('link[href="/css/social.css"]')) { cssDone = true; return; }
  document.head.append(h("link", { rel: "stylesheet", href: "/css/social.css" })); cssDone = true;
}

// Compteurs : les demandes d'une même page sont groupées en un seul appel.
let queue = null;
function statsFor(type, id) {
  if (!queue) {
    const q = queue = { items: new Map() };
    setTimeout(async () => {
      queue = null;
      let data = {};
      try { data = await api("/social/stats", { method: "POST", body: { items: [...q.items.values()].map((x) => x.item) } }); } catch { /* compteurs absents : zéro */ }
      for (const [key, x] of q.items) x.resolvers.forEach((r) => r(data[key] ?? { likes: 0, liked: false, comments: 0, shares: 0 }));
    }, 40);
  }
  const key = `${type}:${id}`;
  return new Promise((resolve) => { const x = queue.items.get(key) ?? { item: { type, id }, resolvers: [] }; x.resolvers.push(resolve); queue.items.set(key, x); });
}

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
export const shareUrl = (type, id) => `${location.origin}/#/${type === "LISTING" ? `annonce/${encodeURIComponent(id)}` : `decouvrir?p=${encodeURIComponent(id)}`}`;

async function repostDialog(type, id, onDone) {
  const msg = h("textarea", { class: "input", rows: "3", maxlength: "2000", "aria-label": "Votre commentaire (facultatif)", placeholder: "Ajoutez un commentaire (facultatif)…" });
  const d = h("dialog", { "aria-label": "Republier sur Découvrir" }, h("form", { class: "pad stack", method: "dialog" },
    h("h2", null, "Republier sur Découvrir"), msg,
    h("p", { class: "small muted" }, "Votre publication apparaîtra sur votre fil avec la carte de l'original."),
    h("div", { class: "row" }, h("button", { class: "btn btn-quiet", value: "cancel" }, "Annuler"),
      h("button", { class: "btn btn-primary", type: "button", onClick: async () => {
        try { await api(`/social/${type}/${encodeURIComponent(id)}/repost`, { method: "POST", body: { comment: msg.value.trim() } }); d.close(); toast("Republié sur Découvrir."); onDone?.(); } catch (error) { fail(error); }
      } }, "Republier"))));
  d.addEventListener("close", () => d.remove()); document.body.append(d); d.showModal();
}

function shareMenu(type, id, onShared) {
  const url = shareUrl(type, id), text = encodeURIComponent(`${url}`);
  const box = h("div", { class: "sc-menu", role: "menu" },
    h("button", { type: "button", role: "menuitem", onClick: () => { if (!needLogin()) repostDialog(type, id, onShared); } }, "Republier sur Découvrir"),
    h("button", { type: "button", role: "menuitem", onClick: async () => { try { await navigator.clipboard.writeText(url); toast("Lien copié."); } catch { prompt("Copiez ce lien :", url); } } }, "Copier le lien"),
    h("a", { role: "menuitem", href: `https://wa.me/?text=${text}`, target: "_blank", rel: "noopener noreferrer" }, "WhatsApp"),
    h("a", { role: "menuitem", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, target: "_blank", rel: "noopener noreferrer" }, "Facebook"),
    navigator.share ? h("button", { type: "button", role: "menuitem", onClick: () => navigator.share({ url }).catch(() => {}) }, "Autres applications…") : null);
  return box;
}

/** Commentaires d'une annonce ou d'une publication : liste, j'aime sur chaque commentaire, signalement, saisie. */
export function commentsPanel(type, id, { onCount } = {}) {
  loadSocialCss();
  const list = h("ul", { class: "sc-comments" });
  const input = h("input", { class: "input", maxlength: "1000", "aria-label": "Votre commentaire", placeholder: "Écrivez un commentaire public…" });
  const base = `/social/${type}/${encodeURIComponent(id)}`;
  async function load() {
    let rows = [];
    try { rows = await api(`${base}/comments`); } catch (error) { return fail(error); }
    onCount?.(rows.length);
    list.replaceChildren(...(rows.length ? rows.map((c) => {
      const like = h("button", { type: "button", class: `sc-clike${c.liked ? " on" : ""}`, "aria-pressed": String(c.liked), "aria-label": "J'aime ce commentaire", onClick: async () => {
        if (needLogin()) return;
        try { const r = await api(`/social/COMMENT/${encodeURIComponent(c.id)}/like`, { method: "POST", body: {} }); c.liked = r.liked; c.likes = r.likes; draw(); } catch (error) { fail(error); }
      } });
      const draw = () => { like.className = `sc-clike${c.liked ? " on" : ""}`; like.setAttribute("aria-pressed", String(c.liked)); like.replaceChildren(icon("heart"), c.likes ? ` ${c.likes}` : " J'aime"); };
      draw();
      return h("li", { class: "sc-comment" }, h("strong", null, c.authorName), h("p", null, c.body),
        h("div", { class: "sc-crow" }, like, h("small", { class: "muted" }, new Date(c.createdAt).toLocaleDateString("fr-FR")),
          S.user && !c.mine ? h("button", { type: "button", class: "sc-link", onClick: async () => {
            const reason = prompt("Pourquoi signaler ce commentaire ?"); if (!reason?.trim()) return;
            try { await api(`/comments/${encodeURIComponent(c.id)}/report`, { method: "POST", body: { reason: reason.trim() } }); toast("Signalement transmis à la modération."); } catch (error) { fail(error); }
          } }, "Signaler") : null));
    }) : [h("li", { class: "muted small" }, "Pas encore de commentaire. Soyez le premier.")]));
  }
  const send = h("button", { class: "btn btn-primary btn-small", type: "button", onClick: async () => {
    if (needLogin()) return;
    try { await api(`${base}/comments`, { method: "POST", body: { body: input.value } }); input.value = ""; toast("Commentaire publié."); await load(); } catch (error) { fail(error); }
  } }, "Publier");
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); send.click(); } });
  load();
  return h("div", { class: "sc-panel" }, list, h("div", { class: "sc-write", "data-module": "comments" }, input, send), moduleNotice("comments"));
}

/** Barre « J'aime · Commenter · Partager » avec compteurs. `inline` : ouvre les commentaires sous la barre ; sinon `onComments` est appelé. */
export function socialBar(type, id, { onComments, inline = true, openComments = false } = {}) {
  loadSocialCss();
  const counts = h("div", { class: "sc-counts" });
  const likeBtn = h("button", { type: "button", class: "sc-btn", onClick: toggleLike }, icon("heart"), " J'aime");
  const comBtn = h("button", { type: "button", class: "sc-btn", onClick: () => { if (onComments) onComments(); else togglePanel(); } }, icon("message"), " Commenter");
  const shareBtn = h("button", { type: "button", class: "sc-btn", "aria-haspopup": "menu", onClick: () => { menu.hidden = !menu.hidden; } }, icon("share"), " Partager");
  const menu = shareMenu(type, id, () => refresh()); menu.hidden = true;
  const holder = h("div", { class: "sc-holder" });
  let st = { likes: 0, liked: false, comments: 0, shares: 0 }, panel = null;
  const draw = () => {
    counts.replaceChildren(...[st.likes ? h("span", null, `♥ ${st.likes}`) : null, st.comments ? h("button", { type: "button", class: "sc-link", onClick: () => (onComments ? onComments() : togglePanel()) }, plural(st.comments, "commentaire", "commentaires")) : null, st.shares ? h("span", null, plural(st.shares, "partage", "partages")) : null].filter(Boolean));
    likeBtn.className = `sc-btn${st.liked ? " on" : ""}`; likeBtn.setAttribute("aria-pressed", String(st.liked));
  };
  async function refresh() { st = await statsFor(type, id); draw(); }
  async function toggleLike() {
    if (needLogin()) return;
    try { const r = await api(`/social/${type}/${encodeURIComponent(id)}/like`, { method: "POST", body: {} }); st = { ...st, liked: r.liked, likes: r.likes }; draw(); } catch (error) { fail(error); }
  }
  function togglePanel() {
    if (!inline) return;
    if (panel) { panel.remove(); panel = null; return; }
    panel = commentsPanel(type, id, { onCount: (n) => { st.comments = n; draw(); } }); holder.append(panel);
  }
  document.addEventListener("click", (e) => { if (!menu.hidden && !e.target.closest?.(".sc-share")) menu.hidden = true; });
  draw(); refresh(); if (openComments) togglePanel();
  return h("div", { class: "sc-bar" }, counts, h("div", { class: "sc-actions" }, likeBtn, comBtn, h("div", { class: "sc-share" }, shareBtn, menu)), holder);
}

/** Photo en plein écran : précédente / suivante, et à droite j'aime, partage et commentaires de la publication. */
/**
 * Photo en plein écran (tout l'écran, rien d'autre) : ouverte au clic sur la photo du détail de la publication.
 * Flèches du clavier, boutons ‹ ›, balayage du doigt ; fermeture par la croix, Échap ou un clic hors de la photo.
 * `onChange(i)` prévient le détail de la photo affichée en dernier.
 */
export function openFullscreen(photos, start, onChange) {
  loadSocialCss();
  let i = Math.max(0, Math.min(start ?? 0, photos.length - 1));
  const img = h("img", { class: "sc-fullimg", alt: "", draggable: "false" });
  const counter = h("span", { class: "sc-pos" });
  const show = () => { img.src = photos[i]; img.alt = `Photo ${i + 1} sur ${photos.length}`; counter.textContent = photos.length > 1 ? `${i + 1} / ${photos.length}` : ""; onChange?.(i); };
  const move = (d) => { if (photos.length < 2) return; i = (i + d + photos.length) % photos.length; show(); };
  const dlg = h("dialog", { class: "sc-full", "aria-label": "Photo en plein écran" },
    h("button", { type: "button", class: "sc-close", "aria-label": "Fermer la photo", onClick: () => dlg.close() }, icon("x")),
    photos.length > 1 ? h("button", { type: "button", class: "sc-nav prev", "aria-label": "Photo précédente", onClick: () => move(-1) }, "‹") : null,
    img,
    photos.length > 1 ? h("button", { type: "button", class: "sc-nav next", "aria-label": "Photo suivante", onClick: () => move(1) }, "›") : null, counter);
  dlg.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") move(-1); if (e.key === "ArrowRight") move(1); });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  // Balayage d'un doigt vers la gauche ou la droite (pas pendant un zoom à deux doigts).
  let x0 = null; let y0 = 0;
  dlg.addEventListener("touchstart", (e) => { x0 = e.touches.length === 1 && (window.visualViewport?.scale ?? 1) <= 1.02 ? e.touches[0].clientX : null; y0 = e.touches[0].clientY; }, { passive: true });
  dlg.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0; const dy = e.changedTouches[0].clientY - y0; x0 = null;
    if (Math.abs(dx) > 60 && Math.abs(dy) < 50) move(dx < 0 ? 1 : -1);
  }, { passive: true });
  const onHash = () => dlg.close();
  window.addEventListener("hashchange", onHash);
  dlg.addEventListener("close", () => { window.removeEventListener("hashchange", onHash); dlg.remove(); });
  show(); document.body.append(dlg); dlg.showModal();
}

export function openLightbox(photos, start, { type, id, title, action, body } = {}) {
  loadSocialCss();
  const withPhotos = photos.length > 0;
  let i = Math.max(0, Math.min(start ?? 0, photos.length - 1));
  const full = () => openFullscreen(photos, i, (j) => { if (j !== i) { i = j; show(); } });
  const img = h("img", { class: "sc-big", alt: "", role: "button", tabindex: "0", title: "Voir en plein écran", onClick: full, onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); full(); } } });
  const counter = h("span", { class: "sc-pos" });
  const show = () => { if (!withPhotos) return; img.src = photos[i]; img.alt = `Photo ${i + 1} sur ${photos.length}`; counter.textContent = photos.length > 1 ? `${i + 1} / ${photos.length}` : ""; };
  const move = (d) => { if (!withPhotos) return; i = (i + d + photos.length) % photos.length; show(); };
  const head = title || action ? h("div", { class: "sc-sidehead" },
    withPhotos ? null : h("button", { type: "button", class: "sc-sideclose", "aria-label": "Fermer", onClick: () => dlg.close() }, icon("x")),
    title ? h("strong", null, title) : null, action?.() ?? null) : null;
  const stage = !withPhotos ? null : h("div", { class: "sc-stage" },
      h("button", { type: "button", class: "sc-close", "aria-label": "Fermer", onClick: () => dlg.close() }, icon("x")),
      photos.length > 1 ? h("button", { type: "button", class: "sc-nav prev", "aria-label": "Photo précédente", onClick: () => move(-1) }, "‹") : null,
      img,
      photos.length > 1 ? h("button", { type: "button", class: "sc-nav next", "aria-label": "Photo suivante", onClick: () => move(1) }, "›") : null, counter);
  const dlg = h("dialog", { class: `sc-lightbox${withPhotos ? "" : " sc-textonly"}`, "aria-label": withPhotos ? "Photo en plein écran" : "Publication" }, stage,
    id ? h("aside", { class: "sc-side" }, head, body?.() ?? null, socialBar(type, id, { openComments: true })) : null);
  dlg.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") move(-1); if (e.key === "ArrowRight") move(1); });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  // « Écrire » mène à la messagerie : la fenêtre se ferme dès que la page change.
  const onHash = () => dlg.close();
  window.addEventListener("hashchange", onHash);
  dlg.addEventListener("close", () => { window.removeEventListener("hashchange", onHash); dlg.remove(); });
  show(); document.body.append(dlg); dlg.showModal();
}
