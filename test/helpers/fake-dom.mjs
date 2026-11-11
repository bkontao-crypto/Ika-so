// Faux DOM minimal : assez pour construire une page avec h() et relire son texte, sans navigateur.
export class FakeNode {
  constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this.listeners = {}; this.className = ""; this.hidden = false; this.style = { setProperty: (k, v) => { this.attrs[`style:${k}`] = v; } }; this.classList = { toggle: () => {}, remove: () => {}, add: () => {} }; }
  setAttribute(k, v) { this.attrs[k] = v; }
  getAttribute(k) { return this.attrs[k]; }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  append(...kids) { for (const k of kids) this.children.push(typeof k === "string" ? new FakeText(k) : k); }
  replaceChildren(...kids) { this.children = []; this.append(...kids); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
  querySelectorAll(sel) {
    const out = []; const cls = sel.startsWith(".") ? sel.slice(1) : null; const tag = !cls && !sel.startsWith("[") ? sel : null;
    const walk = (n) => { for (const c of n.children) { if (c instanceof FakeNode) { if ((cls && c.className.split(/\s+/).includes(cls)) || (tag && c.tag === tag) || (sel === "[aria-selected=true]" && c.attrs["aria-selected"] === "true")) out.push(c); walk(c); } } };
    walk(this); return out;
  }
  get textContent() { return this.children.map((c) => c.textContent).join(""); }
  get value() { return this._v ?? ""; } set value(v) { this._v = v; }
  focus() {}
  scrollIntoView() {}
}
export class FakeText extends FakeNode { constructor(t) { super("#text"); this.text = String(t); } get textContent() { return this.text; } }
export function installDom() {
  // Les minuteurs de la page (rafraîchissement des messages non lus…) ne doivent pas empêcher Node de se terminer.
  const realInterval = globalThis.setInterval;
  globalThis.setInterval = (...args) => { const t = realInterval(...args); t?.unref?.(); return t; };
  globalThis.Node = FakeNode;
  const app = new FakeNode("div");
  globalThis.document = { createElement: (t) => new FakeNode(t), createTextNode: (t) => new FakeText(t), createElementNS: (ns, t) => new FakeNode(t), getElementById: () => app, querySelector: () => null, head: new FakeNode("head"), body: new FakeNode("body") };
  globalThis.window = { prompt: () => null, open: () => {} };
  globalThis.location = { hash: "#/annonceur/x", href: "" };
  Object.defineProperty(globalThis, "navigator", { value: {}, configurable: true });
  return app;
}
export const allText = (n) => n.textContent.replace(/\s+/g, " ");
