// Barre d'onglets du profil, façon Facebook : jamais de défilement horizontal.
// Les onglets qui ne tiennent plus dans la largeur passent dans « Plus ▾ » ; le bouton « ••• » ouvre les actions du profil.
// Aucune donnée ici : la page fournit les onglets et les actions (rien n'est inventé).
import { h } from "/js/dom.js";

const CSS = "/css/profil-onglets.css";
let observer = null; // un seul observateur à la fois (la page profil se redessine souvent)
let closeOpen = null; // fenêtre déroulante ouverte : une seule à la fois

function loadCss() {
  if (!document.querySelector(`link[href="${CSS}"]`)) document.head.append(h("link", { rel: "stylesheet", href: CSS }));
}

/** Fenêtre déroulante : clic sur le bouton, Échap, clic ailleurs ; flèches haut / bas pour parcourir les entrées. */
function dropdown(btn, pop) {
  pop.hidden = true;
  const entries = () => [...pop.querySelectorAll("[role=menuitem]")];
  const onDoc = (e) => { if (!pop.contains(e.target) && !btn.contains(e.target)) close(); };
  const onKey = (e) => {
    if (e.key === "Escape") { close(); btn.focus(); return; }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const list = entries();
    if (!list.length) return;
    e.preventDefault();
    const at = list.indexOf(document.activeElement);
    const down = e.key === "ArrowDown";
    list[at < 0 ? (down ? 0 : list.length - 1) : (at + (down ? 1 : -1) + list.length) % list.length].focus();
  };
  function close() {
    if (pop.hidden) return;
    pop.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    document.removeEventListener("click", onDoc, true);
    document.removeEventListener("keydown", onKey);
    if (closeOpen === close) closeOpen = null;
  }
  function open() {
    closeOpen?.();
    pop.hidden = false;
    pop.classList.remove("flip");
    if (pop.getBoundingClientRect().right > window.innerWidth - 8) pop.classList.add("flip"); // déborderait à droite : on l'aligne à droite
    btn.setAttribute("aria-expanded", "true");
    document.addEventListener("click", onDoc, true);
    document.addEventListener("keydown", onKey);
    closeOpen = close;
    entries()[0]?.focus();
  }
  btn.addEventListener("click", () => (pop.hidden ? open() : close()));
  pop.addEventListener("click", (e) => { if (e.target.closest("[role=menuitem]")) close(); });
}

/**
 * @param {{ tabs: {id: string, label: string}[], current: string, onSelect: (id: string) => void,
 *   menu?: { title: string, items: ({ icon?: string, label: string, href?: string, download?: string, onClick?: () => void } | null)[] }[] }} options
 * @returns {{ node: HTMLElement, select: (id: string) => void, layout: () => void }}
 */
export function profileTabs({ tabs, current, onSelect, menu = [] }) {
  loadCss();
  observer?.disconnect();
  let selected = current;
  let overflow = [];

  const choose = (id) => { select(id); onSelect(id); };
  const buttons = tabs.map((t) => h("button", { class: "mp-tab mpt-tab", type: "button", role: "tab", "data-ic": "1", "data-tab": t.id, "aria-selected": "false", onClick: () => choose(t.id) }, t.label));
  const list = h("div", { class: "mpt-list", role: "tablist", "aria-label": "Sections du profil" }, buttons);

  // « Plus ▾ » : les onglets qui ne tiennent pas.
  const moreBtn = h("button", { class: "mp-tab mpt-more-btn", type: "button", "data-ic": "1", "aria-haspopup": "menu", "aria-expanded": "false" }, "Plus ", h("span", { "aria-hidden": "true" }, "▾"));
  const morePop = h("div", { class: "mpt-pop", role: "menu", "aria-label": "Autres sections" });
  const more = h("div", { class: "mpt-more" }, moreBtn, morePop);
  dropdown(moreBtn, morePop);

  // « ••• » : actions du profil, regroupées par rubrique.
  const entry = (x) => {
    const body = [x.icon ? h("span", { class: "mpt-ic", "aria-hidden": "true" }, x.icon) : null, x.label];
    return x.href
      ? h("a", { class: "mpt-item", role: "menuitem", "data-ic": "1", href: x.href, download: x.download ?? null }, body)
      : h("button", { class: "mpt-item", type: "button", role: "menuitem", "data-ic": "1", onClick: x.onClick }, body);
  };
  const sections = menu.map((s) => ({ title: s.title, items: s.items.filter(Boolean) })).filter((s) => s.items.length);
  const dotsBtn = h("button", { class: "mpt-dots-btn", type: "button", "aria-haspopup": "menu", "aria-expanded": "false", "aria-label": "Plus d'options du profil", title: "Plus d'options" }, "•••");
  const sectionNode = (s) => h("div", { class: "mpt-sec", role: "group", "aria-label": s.title }, h("h4", null, s.title), s.items.map(entry));
  const dotsPop = h("div", { class: "mpt-pop mpt-pop-right", role: "menu", "aria-label": "Options du profil" }, sections.map(sectionNode));
  const dots = h("div", { class: "mpt-dots" }, dotsBtn, dotsPop);
  dropdown(dotsBtn, dotsPop);

  const wrap = h("div", { class: "mpt" }, list, more, dots);
  const small = typeof matchMedia === "function" ? matchMedia("(max-width: 640px)") : null;
  const compact = () => Boolean(small?.matches); // téléphone : pas de « Plus ▾ », tout passe par « ••• »

  function renderOverflow() {
    const tabItems = overflow.map((t) => h("button", { class: "mpt-item", type: "button", role: "menuitem", "data-ic": "1", "aria-current": String(t.id === selected), onClick: () => choose(t.id) }, t.label));
    morePop.replaceChildren(...(compact() ? [] : tabItems));
    // Téléphone : les onglets en trop forment la première rubrique du menu « ••• ».
    dotsPop.replaceChildren(...(compact() && tabItems.length ? [h("div", { class: "mpt-sec", role: "group", "aria-label": "Autres sections" }, h("h4", null, "Autres sections"), tabItems)] : []), ...sections.map(sectionNode));
    const on = overflow.some((t) => t.id === selected);
    moreBtn.classList.toggle("is-on", on && !compact());
    dotsBtn.classList.toggle("is-on", on && compact());
  }

  /** Marque l'onglet actif (sans rappeler onSelect). */
  function select(id) {
    selected = id;
    buttons.forEach((el) => el.setAttribute("aria-selected", String(el.dataset.tab === id)));
    renderOverflow();
  }

  /** Mesure la largeur disponible : les onglets qui ne tiennent pas passent dans « Plus ». */
  function layout() {
    if (!wrap.isConnected || !wrap.clientWidth) return;
    buttons.forEach((el) => { el.hidden = false; });
    more.hidden = compact();
    dots.hidden = !sections.length && !compact();
    const style = getComputedStyle(wrap);
    const gap = parseFloat(getComputedStyle(list).columnGap) || 0;
    const room = wrap.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - (dots.hidden ? 0 : dots.offsetWidth + gap);
    const widths = buttons.map((el) => el.offsetWidth);
    const total = widths.reduce((sum, w) => sum + w, 0) + gap * (widths.length - 1);
    let count = widths.length;
    if (total > room) {
      let used = (compact() ? 0 : more.offsetWidth) + gap;
      count = 0;
      for (const w of widths) {
        if (used + w + gap > room) break;
        used += w + gap;
        count += 1;
      }
      count = Math.max(count, 1);
    }
    buttons.forEach((el, i) => { el.hidden = i >= count; });
    overflow = tabs.slice(count);
    more.hidden = compact() || overflow.length === 0;
    dots.hidden = !sections.length && !(compact() && overflow.length);
    renderOverflow();
  }

  if (typeof ResizeObserver === "function") {
    observer = new ResizeObserver(layout);
    observer.observe(wrap);
  } else window.addEventListener("resize", layout);
  small?.addEventListener?.("change", layout);
  document.fonts?.ready?.then(layout).catch(() => undefined); // les polices changent la largeur des onglets
  select(current);
  return { node: wrap, select, layout };
}
