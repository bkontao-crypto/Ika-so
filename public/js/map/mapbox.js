// Fournisseur « Mapbox » (étape 4 bis) : fond de carte rues / satellite, MÊME contrat que local.js.
// Chargé UNIQUEMENT par provider.js, quand le serveur donne un jeton public valide ET que la bibliothèque hébergée
// chez nous (public/vendor/mapbox-gl.js) s'est chargée. Toute erreur ici → provider.js replie sur le plan local.
// Contrat : createMapboxMap(container, { center, mode, tap, onChange, onSelect, extra, token }) → mêmes méthodes que local.js
// + setBase("streets"|"satellite"). Les mesures officielles restent celles du serveur ; l'aperçu vient de geometry.js.
import { preview, removeVertex } from "/js/map/geometry.js";

const STYLES = { streets: "mapbox://styles/mapbox/streets-v12", satellite: "mapbox://styles/mapbox/satellite-streets-v12" };
// Repères « photo » : la première photo de l'annonce, rognée en rond avec un liseré (doré = à la une). Sans photo ou si elle ne se charge pas : pastille unie.
const ICON = 88;
const photoCache = new Map();
function loadPhoto(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
function drawIcon(img, ring) {
  const c = document.createElement("canvas");
  c.width = c.height = ICON;
  const x = c.getContext("2d");
  const r = ICON / 2;
  x.fillStyle = "#ffffff";
  x.beginPath(); x.arc(r, r, r - 1, 0, Math.PI * 2); x.fill();
  x.save();
  x.beginPath(); x.arc(r, r, r - 7, 0, Math.PI * 2); x.clip();
  if (img) {
    const scale = Math.max(ICON / img.width, ICON / img.height); // « cover » : on remplit le rond
    x.drawImage(img, (ICON - img.width * scale) / 2, (ICON - img.height * scale) / 2, img.width * scale, img.height * scale);
  } else { x.fillStyle = ring; x.fillRect(0, 0, ICON, ICON); }
  x.restore();
  x.lineWidth = 5; x.strokeStyle = ring;
  x.beginPath(); x.arc(r, r, r - 3, 0, Math.PI * 2); x.stroke();
  return x.getImageData(0, 0, ICON, ICON);
}
async function photoIcon(url, featured) {
  const key = `${url || ""}|${featured ? 1 : 0}`;
  if (!photoCache.has(key)) photoCache.set(key, loadPhoto(url).then((img) => drawIcon(img, featured ? "#c9ef75" : "#102c25")));
  return photoCache.get(key);
}
const iconName = (o) => `ph:${o.image || "none"}:${o.featured ? 1 : 0}`;
const ICON_LAYOUT = { "icon-image": ["get", "icon"], "icon-size": 1, "icon-allow-overlap": true, "icon-anchor": "center" };
const EMPTY = { type: "FeatureCollection", features: [] };
const pt = (p, props = {}) => ({ type: "Feature", properties: props, geometry: { type: "Point", coordinates: [p.lng, p.lat] } });

export async function createMapboxMap(container, { center, mode = "view", tap = "vertex", onChange = () => {}, onSelect = () => {}, extra = [], token } = {}) {
  const gl = window.mapboxgl;
  if (!gl?.Map || !token) throw new Error("Bibliothèque Mapbox ou jeton absent.");
  gl.accessToken = token;
  let tapMode = tap;
  let vertices = [];
  let point = null;
  let others = extra;
  let selected = null;
  let drag = null;
  let base = "streets";
  const edit = mode === "edit";

  container.replaceChildren();
  container.style.height = container.style.height || "26rem"; // sans hauteur, Mapbox se dessine à 0 px : carte blanche
  const map = new gl.Map({ container, style: STYLES[base], center: [center.lng, center.lat], zoom: 17, dragRotate: false, pitchWithRotate: false, touchPitch: false, attributionControl: true });
  map.touchZoomRotate?.disableRotation?.();
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Mapbox : délai dépassé.")), 15_000);
      map.once("load", () => { clearTimeout(timer); resolve(); });
      map.once("error", (event) => { clearTimeout(timer); reject(event?.error ?? new Error("Mapbox : erreur de chargement (jeton refusé ?).")); });
    });
  } catch (error) {
    map.remove(); // pas de carte à moitié démarrée : provider.js replie sur le plan local
    throw error;
  }

  if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => map.resize()).observe(container);

  const select = (i) => { const next = i == null || i < 0 || i >= vertices.length ? null : i; if (next !== selected) { selected = next; onSelect(selected); } };
  const data = () => {
    const ring = vertices.map((v) => [v.lng, v.lat]);
    const shape = ring.length >= 3 ? { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[...ring, ring[0]]] } }
      : ring.length === 2 ? { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: ring } } : null;
    return {
      shape: { type: "FeatureCollection", features: shape ? [shape] : [] },
      verts: { type: "FeatureCollection", features: vertices.map((v, i) => pt(v, { i, n: String(i + 1), sel: i === selected ? 1 : 0 })) },
      pin: { type: "FeatureCollection", features: point ? [pt(point)] : [] },
      others: { type: "FeatureCollection", features: others.map((o) => pt(o, { label: o.label ?? "", icon: iconName(o) })) },
    };
  };
  const draw = () => { const d = data(); for (const name of Object.keys(d)) map.getSource(name)?.setData(d[name]); };
  const icons = new Map(); // nom → image prête (re-posée après chaque changement de fond)
  const restoreIcons = () => { for (const [name, img] of icons) if (!map.hasImage(name)) map.addImage(name, img, { pixelRatio: 2 }); };
  const prepareIcons = async (list) => {
    await Promise.all(list.map(async (o) => { const name = iconName(o); if (!icons.has(name)) icons.set(name, await photoIcon(o.image, o.featured)); }));
    restoreIcons();
  };
  const addLayers = () => { // appelé au chargement et après chaque changement de fond (setStyle efface les couches)
    restoreIcons();
    const d = data();
    for (const name of Object.keys(d)) if (!map.getSource(name)) map.addSource(name, { type: "geojson", data: d[name] });
    const add = (layer) => { if (!map.getLayer(layer.id)) map.addLayer(layer); };
    add({ id: "shape-fill", type: "fill", source: "shape", filter: ["==", "$type", "Polygon"], paint: { "fill-color": "#c9ef75", "fill-opacity": 0.28 } });
    add({ id: "shape-line", type: "line", source: "shape", paint: { "line-color": "#c9ef75", "line-width": 3 } });
    add({ id: "others", type: "symbol", source: "others", layout: ICON_LAYOUT });
    add({ id: "others-label", type: "symbol", source: "others", layout: { "text-field": ["get", "label"], "text-size": 12, "text-offset": [0, 2.3], "text-anchor": "top", "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"] }, paint: { "text-color": "#102c25", "text-halo-color": "#ffffff", "text-halo-width": 2 } });
    add({ id: "pin", type: "circle", source: "pin", paint: { "circle-radius": 10, "circle-color": "#dc2626", "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 } });
    add({ id: "verts", type: "circle", source: "verts", paint: { "circle-radius": edit ? 14 : 8, "circle-color": ["case", ["==", ["get", "sel"], 1], "#102c25", "#c9ef75"], "circle-stroke-color": ["case", ["==", ["get", "sel"], 1], "#c9ef75", "#102c25"], "circle-stroke-width": ["case", ["==", ["get", "sel"], 1], 4, 2] } });
    add({ id: "verts-n", type: "symbol", source: "verts", layout: { "text-field": ["get", "n"], "text-size": 13, "text-offset": [1.4, -1.2], "text-allow-overlap": true }, paint: { "text-color": "#102c25", "text-halo-color": "#ffffff", "text-halo-width": 2 } });
  };
  addLayers();
  map.on("style.load", addLayers);
  if (others.length) prepareIcons(others).then(draw, draw);

  const emit = () => { draw(); onChange({ point, vertices: vertices.map((v) => ({ ...v })) }); };
  const onVertex = (event) => event.features?.[0]?.properties?.i;

  if (edit) {
    const start = (event) => {
      const i = onVertex(event);
      if (i == null) return;
      event.preventDefault?.();
      map.dragPan.disable();
      drag = { i: Number(i), x: event.point.x, y: event.point.y, moved: false };
    };
    map.on("mousedown", "verts", start);
    map.on("touchstart", "verts", start);
    const move = (event) => {
      if (!drag) return;
      if (!drag.moved && Math.hypot(event.point.x - drag.x, event.point.y - drag.y) < 6) return;
      drag.moved = true;
      vertices[drag.i] = { lat: event.lngLat.lat, lng: event.lngLat.lng };
      draw();
    };
    map.on("mousemove", move);
    map.on("touchmove", move);
    const end = () => {
      if (!drag) return;
      const { i, moved } = drag;
      drag = null;
      map.dragPan.enable();
      if (moved) { select(i); emit(); } else { select(selected === i ? null : i); draw(); }
      drag = null;
      justHandled = true; // le « click » qui suit cet appui ne doit pas ajouter de sommet
      setTimeout(() => { justHandled = false; }, 0);
    };
    let justHandled = false;
    map.on("mouseup", end);
    map.on("touchend", end);
    map.on("click", (event) => {
      if (justHandled) return;
      if (map.queryRenderedFeatures(event.point, { layers: ["verts"] }).length) return;
      select(null);
      const here = { lat: event.lngLat.lat, lng: event.lngLat.lng };
      if (tapMode === "point") point = here; else vertices.push(here);
      emit();
    });
  }

  const fitTo = (pts) => {
    if (!pts.length) return;
    if (pts.length === 1) { map.jumpTo({ center: [pts[0].lng, pts[0].lat], zoom: 18 }); return; }
    const lngs = pts.map((p) => p.lng), lats = pts.map((p) => p.lat);
    map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 60, maxZoom: 19, duration: 0 });
  };

  return {
    getShape: () => ({ point, vertices: vertices.map((v) => ({ ...v })) }),
    setShape({ point: p = null, vertices: v = [] } = {}) { point = p; vertices = v.map((x) => ({ ...x })); select(null); fitTo(vertices.length ? vertices : p ? [p] : []); draw(); },
    addVertex(p) { vertices.push({ ...p }); select(null); if (vertices.length > 1) fitTo(vertices); else map.jumpTo({ center: [p.lng, p.lat] }); emit(); },
    setPoint(p) { point = p ? { ...p } : null; if (p) map.jumpTo({ center: [p.lng, p.lat] }); emit(); },
    undo() { vertices.pop(); select(null); emit(); },
    clear() { vertices = []; point = null; select(null); emit(); },
    getSelected: () => selected,
    removeSelected() { if (selected == null) return false; vertices = removeVertex(vertices, selected); select(null); emit(); return true; },
    setTapMode(value) { tapMode = value; },
    setExtra(pts) { others = pts; prepareIcons(pts).then(draw, draw); },
    fit(pts) { fitTo(pts); },
    resize() { map.resize(); },
    zoom(factor) { map.zoomTo(map.getZoom() + Math.log2(factor)); },
    recenter(p) { map.jumpTo({ center: [p.lng, p.lat] }); },
    setBase(name) { if (STYLES[name] && name !== base) { base = name; map.setStyle(STYLES[name]); } }, // addLayers() est rappelé par « style.load »
    getBase: () => base,
    preview: () => preview(vertices),
    destroy: () => { map.remove(); container.replaceChildren(); container.style.height = ""; },
  };
}


// Carte d'accueil : toutes les annonces géolocalisées, regroupées en secteurs, avec le prix. Clic : détail de l'annonce.
export async function createListingsMapbox(container, { pins = [], token, onOpen = () => {} } = {}) {
  const gl = window.mapboxgl;
  if (!gl?.Map || !token) throw new Error("Bibliothèque Mapbox ou jeton absent.");
  gl.accessToken = token;
  const map = new gl.Map({ container, style: STYLES.streets, center: [-8.0029, 12.6392], zoom: 11, attributionControl: true });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Mapbox : délai dépassé.")), 15_000);
      map.once("load", () => { clearTimeout(timer); resolve(); });
      map.once("error", (event) => { clearTimeout(timer); reject(event?.error ?? new Error("Mapbox : erreur de chargement.")); });
    });
  } catch (error) { map.remove(); throw error; }

  map.on("error", (e) => console.warn("[carte annonces]", e?.error?.message ?? e)); // visible dans la console (F12)
  const data = { type: "FeatureCollection", features: pins.map((p) => ({ type: "Feature", properties: { id: p.id, label: p.label, featured: p.featured ? 1 : 0, icon: `ph:${p.id}` }, geometry: { type: "Point", coordinates: [p.lng, p.lat] } })) };
  await Promise.all(pins.map(async (p) => map.addImage(`ph:${p.id}`, await photoIcon(p.image, p.featured), { pixelRatio: 2 })));
  map.addSource("listings", { type: "geojson", data, cluster: true, clusterRadius: 45, clusterMaxZoom: 15 });
  map.addLayer({ id: "clusters", type: "circle", source: "listings", filter: ["has", "point_count"], paint: { "circle-radius": ["step", ["get", "point_count"], 18, 10, 24, 50, 30], "circle-color": "#c9ef75", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });
  map.addLayer({ id: "cluster-count", type: "symbol", source: "listings", filter: ["has", "point_count"], layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 14, "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"] }, paint: { "text-color": "#102c25" } });
  map.addLayer({ id: "points", type: "symbol", source: "listings", filter: ["!", ["has", "point_count"]], layout: ICON_LAYOUT });
  map.addLayer({ id: "points-label", type: "symbol", source: "listings", filter: ["!", ["has", "point_count"]], layout: { "text-field": ["get", "label"], "text-size": 12, "text-offset": [0, 2.3], "text-anchor": "top", "text-allow-overlap": false, "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"] }, paint: { "text-color": "#102c25", "text-halo-color": "#ffffff", "text-halo-width": 2 } });

  map.on("click", "clusters", (e) => {
    const f = map.queryRenderedFeatures(e.point, { layers: ["clusters"] })[0];
    map.getSource("listings").getClusterExpansionZoom(f.properties.cluster_id, (err, zoom) => { if (!err) map.easeTo({ center: f.geometry.coordinates, zoom }); });
  });
  map.on("click", "points", (e) => { const id = e.features?.[0]?.properties?.id; if (id) onOpen(id); });
  for (const layer of ["clusters", "points"]) {
    map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
  }
  if (pins.length === 1) map.jumpTo({ center: [pins[0].lng, pins[0].lat], zoom: 14 });
  else if (pins.length > 1) {
    const lngs = pins.map((p) => p.lng), lats = pins.map((p) => p.lat);
    map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 60, maxZoom: 15, duration: 0 });
  }
  // La carte peut être créée pendant que l'onglet « Liste » est affiché : on suit les changements de taille.
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => map.resize()).observe(container);
  return { resize: () => map.resize(), destroy: () => map.remove() };
}
