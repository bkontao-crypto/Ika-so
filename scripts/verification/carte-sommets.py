# Test jetable (Python + Playwright) du plan local : sélection, suppression et glissement de sommet.
# Usage : (cd public && python3 -m http.server 18099 &) puis python3 scripts/verification/carte-sommets.py
from playwright.sync_api import sync_playwright
HTML = """<!doctype html><meta charset=utf-8><div id=m style="width:600px;height:400px"></div>
<script type=module>
import { createLocalMap } from "/js/map/local.js";
import { fromLocal } from "/js/map/geometry.js";
const C={lat:12.639,lng:-8.002};
window.log=[];
window.map=createLocalMap(document.getElementById('m'),{center:C,mode:'edit',onChange:s=>log.push(['change',s.vertices.length]),onSelect:i=>log.push(['select',i])});
window.map.setShape({vertices:[[-50,-50],[50,-50],[50,50],[-50,50]].map(([x,y])=>fromLocal(C,{x,y}))});
window.ready=true;
</script>"""
res=[]
def chk(n,ok,d=""): res.append(ok); print(("OK   " if ok else "ECHEC"),n,d)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':800,'height':700})
    errs=[]; pg.on("pageerror",lambda e:errs.append(str(e))); pg.on("console",lambda m: errs.append(m.text) if m.type=="error" else None)
    pg.route("**/__h.html",lambda r:r.fulfill(body=HTML,content_type="text/html"))
    pg.goto("http://127.0.0.1:18099/__h.html"); pg.wait_for_function("window.ready")
    n=lambda: pg.evaluate("map.getShape().vertices.length")
    chk("4 sommets au départ",n()==4)
    chk("aucune sélection au départ",pg.evaluate("map.getSelected()") is None)
    dots=pg.locator("circle.geo-vertex")
    chk("4 pastilles",dots.count()==4)
    dots.nth(1).click()
    chk("appui sur le sommet 2 : sélectionné",pg.evaluate("map.getSelected()")==1)
    chk("pastille marquée choisie",pg.locator("circle.geo-vertex-sel").count()==1)
    chk("appui ne déplace pas et ne supprime pas",n()==4)
    pg.locator("circle.geo-vertex").nth(1).click()
    chk("second appui : relâché",pg.evaluate("map.getSelected()") is None)
    pg.locator("circle.geo-vertex").nth(2).click()
    before=pg.evaluate("map.getShape().vertices")
    chk("suppression retourne vrai",pg.evaluate("map.removeSelected()") is True)
    after=pg.evaluate("map.getShape().vertices")
    chk("3 sommets, le bon retiré",len(after)==3 and after==[before[0],before[1],before[3]])
    chk("sélection effacée après suppression",pg.evaluate("map.getSelected()") is None)
    chk("suppression sans sélection : faux, rien changé",pg.evaluate("map.removeSelected()") is False and n()==3)
    # glisser un sommet le sélectionne et le déplace
    box=pg.locator("circle.geo-vertex").nth(0).bounding_box(); cx,cy=box['x']+box['width']/2,box['y']+box['height']/2
    pg.mouse.move(cx,cy); pg.mouse.down(); pg.mouse.move(cx+30,cy+20,steps=5); pg.mouse.up()
    print("DBG",cx,cy,box,pg.evaluate("[map.getSelected(), map.getShape().vertices[0]]"),after[0], pg.evaluate("log.slice(-4)"))
    moved=pg.evaluate("map.getShape().vertices[0]")
    chk("glisser corrige le sommet",moved!=after[0] and n()==3)
    chk("glisser le sélectionne",pg.evaluate("map.getSelected()")==0)
    # appui sur le fond désélectionne puis ajoute un sommet
    pg.mouse.click(60,60)
    chk("appui sur le fond : désélection + nouveau sommet",pg.evaluate("map.getSelected()") is None and n()==4)
    # undo et clear désélectionnent
    pg.locator("circle.geo-vertex").nth(0).click(); pg.evaluate("map.undo()")
    chk("annuler désélectionne",pg.evaluate("map.getSelected()") is None and n()==3)
    chk("aucune erreur JavaScript",not errs,str(errs[:2]))
    pg.screenshot(path="/home/claude/sel.png")
    b.close()
print("TOUT OK" if all(res) else "ECHECS")
