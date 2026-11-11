// Fournisseur de carte « local » : grille métrique en SVG, sans fond de carte ni ressource externe.
// Contrat (à respecter par tout autre fournisseur) :
//   createLocalMap(container, { center, mode: "view"|"edit", onChange }) → { setShape({point, vertices}), getShape(), addVertex(p), undo(), clear(), recenter(p), destroy() }
//   onChange({ point, vertices }) est appelé après chaque modification par l'utilisateur.
//   Sélection d'un sommet (appui sans glisser) : getSelected() → index ou null, removeSelected(), onSelect(index|null) appelé à chaque changement.
import { fromLocal, niceStep, preview, removeVertex, toLocal } from "/js/map/geometry.js";

const NS = "http://www.w3.org/2000/svg";
const W = 600;
const H = 400;
const el = (tag, attrs = {}, text) => {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (text != null) node.textContent = text;
  return node;
};

export function createLocalMap(container, { center, mode = "view", tap = "vertex", onChange = () => {}, onSelect = () => {}, extra = [] } = {}) {
  let tapMode = tap; // "vertex" : un appui ajoute un sommet ; "point" : un appui place le repère du bien
  let view = { lat: center.lat, lng: center.lng, mpp: 0.25 }; // mètres par unité d'écran
  let vertices = [];
  let others = extra;
  let point = null;
  let drag = null;
  let selected = null; // index du sommet choisi (pour le supprimer)
  const select = (i) => { const next = i == null || i < 0 || i >= vertices.length ? null : i; if (next !== selected) { selected = next; onSelect(selected); } };
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, class: "geo-map", role: "img", "aria-label": "Plan métrique de la parcelle" });
  container.replaceChildren(svg);

  const toScreen = (p) => {
    const q = toLocal(view, p);
    return { x: W / 2 + q.x / view.mpp, y: H / 2 - q.y / view.mpp };
  };
  const toGeo = (sx, sy) => fromLocal(view, { x: (sx - W / 2) * view.mpp, y: (H / 2 - sy) * view.mpp });
  const fitTo = (pts) => {
    if (!pts.length) return;
    const xy = pts.map((p) => toLocal(pts[0], p));
    const spanX = Math.max(...xy.map((q) => q.x)) - Math.min(...xy.map((q) => q.x));
    const spanY = Math.max(...xy.map((q) => q.y)) - Math.min(...xy.map((q) => q.y));
    const mid = { // centre de l'emprise (et non la moyenne) : aucun point n'est coupé
      lat: (Math.min(...pts.map((p) => p.lat)) + Math.max(...pts.map((p) => p.lat))) / 2,
      lng: (Math.min(...pts.map((p) => p.lng)) + Math.max(...pts.map((p) => p.lng))) / 2,
    };
    view.lat = mid.lat;
    view.lng = mid.lng;
    view.mpp = Math.max(0.05, Math.max(spanX / (W * 0.8), spanY / (H * 0.8)) || 0.25);
  };

  function draw() {
    const nodes = [];
    const stepM = niceStep(W * view.mpp);
    // grille : lignes tous les « stepM » mètres, repérées par rapport au centre affiché
    for (let m = Math.ceil(-(W / 2) * view.mpp / stepM) * stepM; m < (W / 2) * view.mpp; m += stepM) nodes.push(el("line", { class: "geo-grid", x1: W / 2 + m / view.mpp, y1: 0, x2: W / 2 + m / view.mpp, y2: H }));
    for (let m = Math.ceil(-(H / 2) * view.mpp / stepM) * stepM; m < (H / 2) * view.mpp; m += stepM) nodes.push(el("line", { class: "geo-grid", x1: 0, y1: H / 2 - m / view.mpp, x2: W, y2: H / 2 - m / view.mpp }));
    nodes.push(el("text", { class: "geo-scale", x: 10, y: H - 12 }, `Carreaux : ${stepM} m`));
    nodes.push(el("text", { class: "geo-north", x: W - 52, y: 30 }, "N ↑"));
    for (const other of others) { // autres biens (carte d'ensemble)
      const s = toScreen(other);
      nodes.push(el("circle", { class: "geo-other", cx: s.x, cy: s.y, r: 10 }, null));
      if (other.label) nodes.push(el("text", { class: "geo-label", x: s.x + 14, y: s.y + 6 }, other.label));
    }
    const screen = vertices.map(toScreen);
    if (screen.length >= 2) nodes.push(el(screen.length >= 3 ? "polygon" : "polyline", { class: "geo-shape", points: screen.map((s) => `${s.x},${s.y}`).join(" ") }));
    screen.forEach((s, i) => {
      const dot = el("circle", { class: i === selected ? "geo-vertex geo-vertex-sel" : "geo-vertex", cx: s.x, cy: s.y, r: mode === "edit" ? 20 : 9, "data-i": i });
      nodes.push(dot);
      nodes.push(el("text", { class: "geo-label", x: s.x + 24, y: s.y - 16 }, String(i + 1)));
    });
    if (point) {
      const s = toScreen(point);
      nodes.push(el("path", { class: "geo-pin", d: `M${s.x},${s.y} l-8,-20 a9,9 0 1 1 16,0 z` }));
    }
    svg.replaceChildren(...nodes);
  }

  const toSvg = (event) => {
    const box = svg.getBoundingClientRect();
    return { x: ((event.clientX - box.left) / box.width) * W, y: ((event.clientY - box.top) / box.height) * H };
  };
  const emit = () => { draw(); onChange({ point, vertices: vertices.map((v) => ({ ...v })) }); };

  if (mode === "edit") {
    svg.addEventListener("pointerdown", (event) => {
      const s = toSvg(event);
      const hit = event.target.getAttribute?.("data-i");
      drag = { startX: s.x, startY: s.y, moved: false, vertex: hit == null ? null : Number(hit), lat: view.lat, lng: view.lng };
      svg.setPointerCapture?.(event.pointerId);
    });
    svg.addEventListener("pointermove", (event) => {
      if (!drag) return;
      const s = toSvg(event);
      if (!drag.moved && Math.hypot(s.x - drag.startX, s.y - drag.startY) < 6) return;
      drag.moved = true;
      if (drag.vertex != null) { vertices[drag.vertex] = toGeo(s.x, s.y); draw(); return; }
      const moved = fromLocal({ lat: drag.lat, lng: drag.lng }, { x: -(s.x - drag.startX) * view.mpp, y: (s.y - drag.startY) * view.mpp });
      view.lat = moved.lat; view.lng = moved.lng; draw();
    });
    svg.addEventListener("pointerup", (event) => {
      if (!drag) return;
      const s = toSvg(event);
      const { moved, vertex } = drag;
      drag = null;
      if (vertex == null && !moved) { select(null); if (tapMode === "point") point = toGeo(s.x, s.y); else vertices.push(toGeo(s.x, s.y)); emit(); } // simple appui
      else if (vertex != null && moved) { select(vertex); emit(); } // sommet déplacé
      else if (vertex != null) { select(selected === vertex ? null : vertex); draw(); } // simple appui sur un sommet : le choisir (ou le relâcher)
      else draw(); // déplacement du fond (la carte glisse)
    });
    svg.addEventListener("pointercancel", () => { drag = null; });
    svg.addEventListener("wheel", (event) => { event.preventDefault(); view.mpp = Math.min(50, Math.max(0.05, view.mpp * (event.deltaY > 0 ? 1.25 : 0.8))); draw(); }, { passive: false });
  }

  draw();
  return {
    getShape: () => ({ point, vertices: vertices.map((v) => ({ ...v })) }),
    setShape({ point: p = null, vertices: v = [] } = {}) { point = p; vertices = v.map((x) => ({ ...x })); select(null); fitTo(vertices.length ? vertices : p ? [p] : []); draw(); },
    addVertex(p) { vertices.push({ ...p }); if (vertices.length > 1) fitTo(vertices); else { view.lat = p.lat; view.lng = p.lng; } emit(); }, // recadre pour que tous les points restent visibles
    setPoint(p) { point = p ? { ...p } : null; if (p) { view.lat = p.lat; view.lng = p.lng; } emit(); },
    undo() { vertices.pop(); select(null); emit(); },
    clear() { vertices = []; point = null; select(null); emit(); },
    getSelected: () => selected,
    removeSelected() { if (selected == null) return false; vertices = removeVertex(vertices, selected); select(null); emit(); return true; },
    setTapMode(value) { tapMode = value; },
    setExtra(pts) { others = pts; draw(); },
    fit(pts) { fitTo(pts); draw(); },
    zoom(factor) { view.mpp = Math.min(50, Math.max(0.05, view.mpp / factor)); draw(); },
    recenter(p) { view.lat = p.lat; view.lng = p.lng; draw(); },
    preview: () => preview(vertices),
    destroy: () => container.replaceChildren(),
  };
}
