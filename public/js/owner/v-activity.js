// Mouvements du site : journal unifié, volumes, filtres, direct, export, dossier d'un compte ou d'une annonce.
import { api, h, ico, panel, empty, skeletons, errorBox, openDrawer, closeDrawer, pill, nf, dayLabel, timeOf, dateTime, ago, initials, shortDay, stackChart, CAT_COLORS, CAT_ICONS, fail, toast, statusPill, fcfa } from "./ui.js";

const PERIODS = [["1", "24 h"], ["7", "7 jours"], ["30", "30 jours"], ["90", "90 jours"], ["all", "Tout"]];
let catalogCache = null;
const state = { period: "7", cats: null, q: "", actor: null };

const catalog = async () => (catalogCache ??= await api("/staff/owner/activity/catalog"));
const fromOf = (p) => (p === "all" ? "" : new Date(Date.now() - Number(p) * 86_400_000).toISOString());
function queryOf(extra = {}) {
  const p = new URLSearchParams();
  if (state.cats?.size) p.set("categories", [...state.cats].join(","));
  if (state.q) p.set("q", state.q);
  if (state.actor) p.set("actor", state.actor);
  const f = fromOf(state.period); if (f) p.set("from", f);
  for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v);
  return p.toString();
}

export const tlIcon = (ev) => { const w = h("span", { class: `eventico ${ev.tone === "ok" || ev.tone === "neutral" ? "" : ev.tone}` }, ico(CAT_ICONS[ev.category] ?? "pulse")); return w; };
const toneClass = (t) => ({ ok: "green", warn: "gold", bad: "red", info: "info", neutral: "neutral" })[t] ?? "neutral";

function eventDrawer(ev, ctx) {
  const rows = [["Événement", ev.label], ["Code", ev.code], ["Date", `${dateTime(ev.at)} (${ago(ev.at)})`], ["Date exacte (UTC)", ev.cursor], ["Catégorie", ev.category], ["Source", ev.source], ["Identifiant", ev.uid]];
  const dl = h("dl", { class: "kv" }, rows.flatMap(([k, v]) => [h("dt", null, k), h("dd", null, v)]));
  const acts = [];
  if (ev.actor?.id) {
    acts.push(h("button", { class: "btn primary", type: "button", onClick: () => { closeDrawer(); ctx.go(`#/trace/user/${encodeURIComponent(ev.actor.id)}`); } }, ico("route"), `Retracer ${ev.actor.name ?? "ce compte"}`));
    acts.push(h("button", { class: "btn", type: "button", onClick: () => { state.actor = ev.actor.id; closeDrawer(); ctx.go("#/activity"); ctx.refresh(); } }, ico("filter"), "Filtrer sur cet acteur"));
  }
  if (ev.object?.type === "listing") {
    acts.push(h("button", { class: "btn", type: "button", onClick: () => { closeDrawer(); ctx.go(`#/trace/listing/${encodeURIComponent(ev.object.id)}`); } }, ico("route"), "Retracer cette annonce"));
    acts.push(h("a", { class: "btn", href: `/#/annonce/${encodeURIComponent(ev.object.id)}`, target: "_blank", rel: "noopener" }, ico("external"), "Voir l'annonce publique"));
  } else if (ev.object?.type === "user") {
    acts.push(h("button", { class: "btn", type: "button", onClick: () => { closeDrawer(); ctx.go(`#/trace/user/${encodeURIComponent(ev.object.id)}`); } }, ico("route"), "Retracer ce compte"));
  }
  openDrawer(ev.label,
    h("div", { class: "row" }, pill(toneClass(ev.tone), ev.label), h("span", { class: "muted small" }, ev.category)),
    ev.detail ? h("p", { class: "note" }, ev.detail) : null,
    ev.actor ? h("div", null, h("h3", { class: "tiny muted" }, "ACTEUR"), h("p", null, ev.actor.name ?? "Sans nom", h("span", { class: "muted small" }, ev.actor.id ? ` · ${ev.actor.id}` : ""))) : h("p", { class: "muted small" }, "Acteur : visiteur non identifié."),
    ev.object ? h("div", null, h("h3", { class: "tiny muted" }, "OBJET"), h("p", null, ev.object.label ?? ev.object.id, h("span", { class: "muted small" }, ` · ${ev.object.type ?? ""} ${ev.object.id}`))) : null,
    dl, h("div", { class: "row" }, acts));
}

/** Liste chronologique groupée par jour. */
export function createTimeline(ctx, { onMore } = {}) {
  const el = h("div", { class: "timeline" });
  const more = h("div", { class: "row" });
  const wrap = h("div", null, el, more);
  let events = []; let seen = new Set(); let fresh = new Set(); let next = null;
  function render() {
    if (!events.length) { el.replaceChildren(empty("Aucun mouvement pour ces filtres.", "pulse")); more.replaceChildren(); return; }
    const out = []; let day = "";
    for (const ev of events) {
      const d = dayLabel(ev.at);
      if (d !== day) { day = d; out.push(h("div", { class: "dayhead" }, d)); }
      const who = ev.actor?.name ?? (ev.actor?.id ? ev.actor.id.slice(0, 8) : null);
      out.push(h("button", { class: `tl${fresh.has(ev.uid) ? " fresh" : ""}`, type: "button", onClick: () => eventDrawer(ev, ctx) },
        tlIcon(ev),
        h("div", { style: { minWidth: 0 } }, h("div", { class: "tl-title" }, ev.label, ev.tone === "bad" || ev.tone === "warn" ? pill(toneClass(ev.tone), ev.tone === "bad" ? "Alerte" : "À suivre") : null),
          h("div", { class: "tl-sub" }, [ev.object?.label, ev.detail].filter(Boolean).join(" · ") || "—")),
        h("div", { class: "tl-meta" }, h("b", null, timeOf(ev.at)), who ?? "Visiteur")));
    }
    el.replaceChildren(...out);
    more.replaceChildren(next && onMore ? h("button", { class: "btn", type: "button", onClick: onMore }, ico("chevron"), "Charger plus") : null);
  }
  return {
    el: wrap,
    set(list, cursor) { events = list; seen = new Set(list.map((e) => e.uid)); fresh = new Set(); next = cursor; render(); },
    append(list, cursor) { for (const e of list) if (!seen.has(e.uid)) { seen.add(e.uid); events.push(e); } next = cursor; render(); },
    prepend(list) { const add = list.filter((e) => !seen.has(e.uid)); if (!add.length) return 0; add.forEach((e) => { seen.add(e.uid); fresh.add(e.uid); }); events = [...add, ...events]; render(); return add.length; },
    get cursor() { return next; }, get newest() { return events[0]; },
  };
}

export function activityView(ctx, { preset } = {}) {
  const isAudit = preset === "audit";
  const root = h("div", { class: "view" });
  const title = isAudit ? "Journal d'audit" : "Mouvements du site";
  let live = false; let timer = null; let loading = false;
  const body = h("div", null, skeletons(2, 120));
  const unavailable = h("div");
  const timeline = createTimeline(ctx, { onMore: loadMore });
  const sumBox = h("div");

  async function init() {
    let cat;
    try { cat = await catalog(); } catch (e) { root.replaceChildren(errorBox(e.message, () => ctx.refresh())); return; }
    if (isAudit) state.cats = new Set(["admin"]);
    else if (!state.cats || state.wasAudit) state.cats = new Set(cat.defaultCategories);
    state.wasAudit = isAudit;
    draw(cat);
    await Promise.all([loadSummary(), loadFeed()]);
  }

  function draw(cat) {
    const searchInput = h("input", { class: "input", type: "search", placeholder: "Rechercher : nom, annonce, identifiant, détail…", value: state.q, "aria-label": "Rechercher" });
    let t; searchInput.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { state.q = searchInput.value.trim(); loadFeed(); }, 350); });
    const seg = h("div", { class: "seg", role: "group", "aria-label": "Période" }, PERIODS.map(([v, l]) => h("button", { type: "button", "aria-pressed": String(state.period === v), onClick: (e) => { state.period = v; seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", "false")); e.currentTarget.setAttribute("aria-pressed", "true"); loadSummary(); loadFeed(); } }, l)));
    const chips = h("div", { class: "chips", id: "chips" });
    const liveBtn = h("button", { class: "btn livebtn", type: "button", "aria-pressed": "false", onClick: () => { live = !live; liveBtn.setAttribute("aria-pressed", String(live)); live ? start() : stop(); toast(live ? "Direct activé : mise à jour toutes les 15 s." : "Direct désactivé."); } }, ico("pulse"), "Direct");
    const actorTag = state.actor ? h("button", { class: "chip", type: "button", "aria-pressed": "true", onClick: () => { state.actor = null; actorTag.remove(); loadFeed(); } }, `Acteur : ${state.actor.slice(0, 10)}…`, ico("x")) : null;
    root.replaceChildren(
      h("div", { class: "welcome" }, h("div", null, h("div", { class: "eyebrow" }, isAudit ? "TRAÇABILITÉ · ÉQUIPE" : "TRAÇABILITÉ · TOUT LE SITE"), h("h1", null, title),
        h("p", null, isAudit ? "Chaque action de l'équipe : qui, quoi, sur quel objet, quand. Les consultations sensibles et les exports sont eux-mêmes inscrits ici." : "Inscriptions, annonces, contacts, messages (sans leur contenu), paiements, signalements, actions de l'équipe, incidents… tout est relu depuis les tables du site, avec l'historique réel.")),
        h("div", { class: "actions" }, liveBtn, h("button", { class: "btn", type: "button", onClick: () => { ctx.refresh(); } }, ico("refresh"), "Actualiser"),
          h("a", { class: "btn primary", id: "export", href: "#", onClick: (e) => { e.currentTarget.href = `/api/staff/owner/activity/export.csv?${queryOf()}`; } }, ico("download"), "Exporter CSV"))),
      h("div", { class: "toolbar" }, h("div", { class: "toolrow" }, seg, h("div", { class: "grow" }, searchInput), actorTag), isAudit ? null : chips),
      unavailable, sumBox,
      h("div", { class: "card panel" }, h("div", { class: "panelhead" }, h("div", null, h("h2", null, "Chronologie"), h("div", { class: "desc", id: "feeddesc" }, "Du plus récent au plus ancien · cliquez un mouvement pour le détail")), h("span", { class: "tiny muted", id: "livestate" })), timeline.el));
    renderChips(cat, null);
    root.querySelector("#livestate").textContent = "";
  }

  let lastSummary = null; let lastCat = null;
  function renderChips(cat, summary) {
    lastCat = cat; const box = root.querySelector("#chips"); if (!box) return;
    box.replaceChildren(...cat.categories.map((c) => {
      const n = summary?.byCategory?.[c.key];
      const b = h("button", { class: "chip", type: "button", "aria-pressed": String(state.cats.has(c.key)), onClick: () => { state.cats.has(c.key) ? state.cats.delete(c.key) : state.cats.add(c.key); if (!state.cats.size) state.cats.add(c.key); renderChips(cat, lastSummary); if (lastSummary) drawSummary(lastSummary); loadFeed(); } }, h("i", { class: "dot" }), c.label, n != null ? h("small", null, nf(n)) : null);
      b.querySelector(".dot").style.setProperty("background", CAT_COLORS[c.key]);
      return b;
    }));
    if (cat.unavailable?.length) unavailable.replaceChildren(h("p", { class: "note warn" }, `Sources non disponibles (migration à appliquer) : ${cat.unavailable.map((u) => u.label).join(", ")}.`));
  }

  async function loadSummary() {
    const days = state.period === "all" ? 90 : Math.max(1, Number(state.period));
    sumBox.replaceChildren(skeletons(1, 160));
    try { lastSummary = await api(`/staff/owner/activity/summary?days=${days}`); renderChips(lastCat, lastSummary); drawSummary(lastSummary); } catch (e) { if (!e.stale) sumBox.replaceChildren(errorBox(e.message, loadSummary)); }
  }

  function drawSummary(sm) {
    const cats = (lastCat?.categories ?? []).filter((c) => state.cats.has(c.key));
    const sel = (d) => cats.reduce((a, c) => a + (d.byCategory[c.key] ?? 0), 0);
    const total = sm.perDay.reduce((a, d) => a + sel(d), 0);
    const busiest = sm.perDay.reduce((a, d) => (sel(d) > sel(a) ? d : a), sm.perDay[0]);
    const mini = (l, v, sub) => h("div", { class: "card mini" }, h("small", null, l), h("strong", null, v), sub ? h("small", null, sub) : null);
    const peak = sm.peakHour;
    const max = Math.max(1, ...sm.byHour);
    const hours = h("div", { class: "hourbars", role: "img", "aria-label": "Mouvements par heure de la journée (UTC, identique à l'heure du Mali)" }, sm.byHour.map((v, i) => { const b = h("i", { class: i === peak ? "peak" : v ? "on" : "", title: `${String(i).padStart(2, "0")} h : ${v}` }); b.style.height = `${Math.max(4, (v / max) * 100)}%`; return b; }));
    const actors = sm.topActors.length ? sm.topActors.map((a) => h("button", { class: "actor-row", type: "button", onClick: () => ctx.go(`#/trace/user/${encodeURIComponent(a.id)}`) }, h("span", { class: "avatar" }, initials(a.name)), h("span", { class: "grow" }, h("b", null, a.name ?? a.id.slice(0, 10)), h("small", null, `${nf(a.count)} mouvement(s)`)), ico("chevron"))) : [empty("Aucun acteur identifié sur la période.")];
    sumBox.replaceChildren(
      h("div", { class: "mini-stats" }, mini("Mouvements (filtres actifs)", nf(total), `${sm.days} jour(s)`), mini("Comptes distincts actifs", nf(sm.totals.actors)), mini("Heure la plus active", peak == null ? "—" : `${String(peak).padStart(2, "0")} h`, "UTC = heure du Mali"), mini("Jour le plus chargé", busiest && sel(busiest) ? shortDay(busiest.day) : "—", busiest && sel(busiest) ? `${nf(sel(busiest))} mouvements` : null)),
      h("div", { class: "split" },
        panel("Volume par jour", "Empilé par catégorie (selon les filtres)", sm.perDay.length ? stackChart({ labels: sm.perDay.map((d) => shortDay(d.day)), stacks: cats.map((c) => ({ key: c.key, name: c.label, color: CAT_COLORS[c.key], values: sm.perDay.map((d) => d.byCategory[c.key] ?? 0) })) }) : empty("Aucune donnée.")),
        h("div", { class: "sidecol" }, panel("Rythme de la journée", "Mouvements par heure", h("div", null, hours, h("div", { class: "hourlabels" }, h("span", null, "0 h"), h("span", null, "12 h"), h("span", null, "23 h")))),
          panel("Comptes les plus actifs", "Hors connexions et fréquentation", h("div", null, actors)))));
  }

  async function loadFeed() {
    if (loading) return; loading = true;
    try {
      const r = await api(`/staff/owner/activity?${queryOf({ limit: 60 })}`);
      timeline.set(r.events, r.nextCursor);
      if (r.failed?.length) toast(`Source(s) en erreur : ${r.failed.join(", ")} (voir les journaux du serveur).`, true);
    } catch (e) { fail(e); } finally { loading = false; }
  }
  async function loadMore() {
    try { const r = await api(`/staff/owner/activity?${queryOf({ limit: 60, before: timeline.cursor })}`); timeline.append(r.events, r.nextCursor); } catch (e) { fail(e); }
  }
  async function poll() {
    try {
      const r = await api(`/staff/owner/activity?${queryOf({ limit: 30 })}`);
      const n = timeline.prepend(r.events);
      root.querySelector("#livestate").textContent = `${n ? `${n} nouveau(x) · ` : ""}vérifié à ${timeOf(new Date().toISOString())}`;
    } catch { /* silencieux : le direct réessaie */ }
  }
  const start = () => { stop(); poll(); timer = setInterval(poll, 15_000); };
  const stop = () => { clearInterval(timer); timer = null; };
  ctx.onLeave(stop);
  init();
  return root;
}

/** Dossier complet d'un compte ou d'une annonce. */
export function traceView(ctx, type, id) {
  const root = h("div", { class: "view" }, skeletons(2, 140));
  const timeline = createTimeline(ctx, { onMore: more });
  async function more() { try { const r = await api(`/staff/owner/activity/trace?type=${type}&id=${encodeURIComponent(id)}&before=${encodeURIComponent(timeline.cursor)}`); timeline.append(r.events, r.nextCursor); } catch (e) { fail(e); } }
  (async () => {
    try {
      const r = await api(`/staff/owner/activity/trace?type=${type}&id=${encodeURIComponent(id)}`);
      const e = r.entity;
      timeline.set(r.events, r.nextCursor);
      const val = (k, v) => (k.includes("(FCFA)") ? fcfa(v) : /le$|connexion enregistrée/.test(k) && v ? dateTime(v) : v ?? "—");
      const counters = Object.entries(e.counters).map(([k, v]) => h("div", null, h("strong", null, nf(v)), h("small", null, { favorites: "Favoris", contacts: "Contacts", reports: "Signalements", payments: "Paiements", listings: "Annonces", published: "Publiées" }[k] ?? k)));
      root.replaceChildren(
        h("div", { class: "welcome" }, h("div", null, h("div", { class: "eyebrow" }, type === "listing" ? "DOSSIER D'ANNONCE" : "DOSSIER DE COMPTE"), h("h1", null, e.title), h("p", null, "Tous les mouvements connus, du plus récent au plus ancien. Cette consultation est inscrite au journal d'audit.")),
          h("div", { class: "actions" }, h("button", { class: "btn", type: "button", onClick: () => history.back() }, "← Retour"),
            type === "listing" ? h("a", { class: "btn", href: `/#/annonce/${encodeURIComponent(e.id)}`, target: "_blank", rel: "noopener" }, ico("external"), "Annonce publique") : h("a", { class: "btn", href: `/#/annonceur/${encodeURIComponent(e.id)}`, target: "_blank", rel: "noopener" }, ico("external"), "Profil public"))),
        h("div", { class: "card entity" }, h("div", { class: "row" }, statusPill(e.status), e.role && e.role !== "USER" ? pill("info", e.role) : null, e.owner?.id ? h("button", { class: "link", type: "button", onClick: () => ctx.go(`#/trace/user/${encodeURIComponent(e.owner.id)}`) }, `Annonceur : ${e.owner.name ?? e.owner.id}`) : null),
          e.statusReason ? h("p", { class: "note warn" }, `Motif : ${e.statusReason}`) : null,
          h("dl", { class: "kv" }, e.facts.flatMap(([k, v]) => [h("dt", null, k), h("dd", null, val(k, v))])), h("div", { class: "counters" }, counters)),
        h("div", { class: "card panel" }, h("div", { class: "panelhead" }, h("div", null, h("h2", null, "Chronologie complète"), h("div", { class: "desc" }, "Fréquentation comprise lorsque la collecte est active"))), timeline.el));
    } catch (er) { if (!er.stale) root.replaceChildren(errorBox(er.message, () => ctx.refresh())); }
  })();
  return root;
}
