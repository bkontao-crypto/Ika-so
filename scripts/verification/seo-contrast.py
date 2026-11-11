"""Contrôle de lisibilité des pages publiques rendues par le serveur : contraste >= 4,5 (3 pour les grands textes).
Scénarios : thème clair, thème sombre, et chacun avec un ika.css ANCIEN (sans thème sombre) ou ABSENT, car c'est ce
qui rendait ces pages illisibles chez l'utilisateur (ancienne feuille de style gardée en mémoire par l'appareil).
Usage : python3 seo-contrast.py     (nécessite Python + playwright + chromium ; code retour 1 si un texte est illisible)"""
import os, subprocess, sys, tempfile
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.normpath(os.path.join(HERE, "..", "..", "public"))
OLD_IKA = ':root{--paper:#f6f5ef;--ink:#17231e;--card:#fff;--muted:#56625b;--line:#e7e5dc;--forest:#102c25;--leaf:#1e6b50;--lime:#c9ef75}:root[data-theme="dark"],:root[data-theme="dark"] body{background:#0d1b17}html{background:var(--paper);color:var(--ink)}.site-header{background:rgba(255,255,255,.97);color:#102c25}.card{background:var(--card);border:1px solid var(--line)}.btn{background:var(--card)}'

JS = r"""() => {
  const lum = ([r,g,b]) => { const f = c => { c/=255; return c<=.03928 ? c/12.92 : Math.pow((c+.055)/1.055,2.4); }; return .2126*f(r)+.7152*f(g)+.0722*f(b); };
  const parse = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return [p[0],p[1],p[2], p.length>3?p[3]:1]; };
  const over = (top, under) => { const a = top[3]; return [0,1,2].map(i => top[i]*a + under[i]*(1-a)).concat([1]); };
  const bgOf = el => { const stack = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c[3] > 0) { stack.push(c); if (c[3] === 1) break; } if (getComputedStyle(e).backgroundImage !== 'none') return null; }
    let base = [255,255,255,1]; if (!stack.length || stack[stack.length-1][3] < 1) { const root = parse(getComputedStyle(document.documentElement).backgroundColor); base = root && root[3] > 0 ? root : [255,255,255,1]; } else base = stack.pop();
    while (stack.length) base = over(stack.pop(), base); return base; };
  const bad = []; const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = walker.nextNode());) {
    const t = n.textContent.trim(); const el = n.parentElement;
    if (!t || !el || seen.has(el) || ['SCRIPT','STYLE','NOSCRIPT'].includes(el.tagName)) continue;
    const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    if (cs.visibility === 'hidden' || cs.display === 'none' || r.width === 0 || r.height === 0 || el.closest('.sr-only')) continue;
    seen.add(el);
    const bg = bgOf(el); if (!bg) continue;
    let fg = parse(cs.color); if (!fg) continue; if (fg[3] < 1) fg = over(fg, bg);
    const L1 = lum(fg), L2 = lum(bg); const ratio = (Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05);
    const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight) >= 700; const need = (size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5;
    if (ratio < need) bad.push({ text: t.slice(0,40), ratio: Math.round(ratio*100)/100, need, tag: el.tagName.toLowerCase()+'.'+(el.className||'') });
  }
  const html = parse(getComputedStyle(document.documentElement).backgroundColor), body = parse(getComputedStyle(document.body).backgroundColor);
  return { bad, htmlBg: html, bodyBg: body };
}"""

def main():
    tmp = tempfile.mkdtemp()
    subprocess.run(["node", os.path.join(HERE, "seo-pages-gen.mjs"), tmp], check=True, capture_output=True)
    pages = sorted(f for f in os.listdir(tmp) if f.endswith(".html"))
    failures = 0; checked = 0
    with sync_playwright() as p:
        b = p.chromium.launch()
        for theme in ("light", "dark"):
            for ika in ("actuel", "ancien", "absent"):
                for name in pages:
                    ctx = b.new_context(viewport={"width": 1000, "height": 700}); pg = ctx.new_page()
                    def route(r, ika=ika):
                        u = r.request.url.replace("http://x", "").split("?")[0]
                        if u.startswith("/page/"): return r.fulfill(path=os.path.join(tmp, u[6:]))
                        if u == "/css/ika.css" and ika == "ancien": return r.fulfill(body=OLD_IKA, content_type="text/css")
                        if u == "/css/ika.css" and ika == "absent": return r.fulfill(status=404, body="")
                        f = PUB + u
                        return r.fulfill(path=f) if os.path.isfile(f) else r.fulfill(status=404, body="")
                    pg.route("http://x/**", route)
                    pg.add_init_script(f"try{{localStorage.setItem('ika_theme','{theme}')}}catch(e){{}}")
                    pg.goto("http://x/page/" + name); pg.wait_for_timeout(120)
                    res = pg.evaluate(JS); checked += 1
                    for item in res["bad"]:
                        failures += 1; print(f"ILLISIBLE [{theme}/ika {ika}] {name}: « {item['text']} » {item['ratio']}:1 (min {item['need']}) {item['tag']}")
                    ctx.close()
        b.close()
    print(f"{checked} pages contrôlées, {failures} texte(s) illisible(s).")
    sys.exit(1 if failures else 0)

main()
