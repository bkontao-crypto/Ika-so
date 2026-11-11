# Test jetable (Python + Playwright) du fournisseur Mapbox avec une FAUSSE bibliothèque (stub) : vérifie le choix et le repli de provider.js et le contrat de mapbox.js.
# Il ne prouve PAS le rendu réel de Mapbox. Usage : (cd public && python3 -m http.server 18099 &) puis python3 scripts/verification/carte-mapbox-stub.py
import json
from playwright.sync_api import sync_playwright
STUB = r"""
(function(){
  const reg = {};
  function Source(d){ this.data=d; } Source.prototype.setData=function(d){ this.data=d; };
  function Map(opts){
    this.opts=opts; this.h=[]; this.sources={}; this.layers={}; this.zoom=17; window.__maps=(window.__maps||[]); window.__maps.push(this);
    this.dragPan={ disable:()=>{this.panOff=true}, enable:()=>{this.panOff=false} };
    this.touchZoomRotate={ disableRotation(){} };
    setTimeout(()=>{ if(window.__fail) this.fire('error',{error:new Error('401')}); else { this.fire('load',{}); } },0);
  }
  Map.prototype.on=function(t,a,b){ this.h.push(b?{t,layer:a,fn:b,once:false}:{t,fn:a,once:false}); };
  Map.prototype.once=function(t,fn){ this.h.push({t,fn,once:true}); };
  Map.prototype.fire=function(t,e,layer){ for(const x of [...this.h]){ if(x.t!==t) continue; if(x.layer && x.layer!==layer) continue; if(x.once) this.h.splice(this.h.indexOf(x),1); x.fn(e||{}); } };
  Map.prototype.getSource=function(n){ return this.sources[n]; };
  Map.prototype.addSource=function(n,s){ this.sources[n]=new Source(s.data); };
  Map.prototype.getLayer=function(n){ return this.layers[n]; };
  Map.prototype.addLayer=function(l){ this.layers[l.id]=l; };
  Map.prototype.queryRenderedFeatures=function(pt,o){ return (this.vertexAt && this.vertexAt(pt)) ? [{properties:{i:this.vertexAt(pt)-1}}] : []; };
  Map.prototype.jumpTo=function(o){ this.last={jump:o}; };
  Map.prototype.fitBounds=function(b,o){ this.last={fit:b}; };
  Map.prototype.zoomTo=function(z){ this.zoom=z; };
  Map.prototype.getZoom=function(){ return this.zoom; };
  Map.prototype.setStyle=function(s){ this.opts.style=s; this.sources={}; this.layers={}; setTimeout(()=>this.fire('style.load',{}),0); };
  Map.prototype.remove=function(){ this.removed=true; };
  window.mapboxgl={ Map, accessToken:null };
})();
"""
res=[]
def chk(n,ok,d=""): res.append(ok); print(("OK   " if ok else "ECHEC"),n,d)
H="""<!doctype html><meta charset=utf-8><div id=m style="width:600px;height:400px"></div>
<script type=module>
import { createMap } from "/js/map/provider.js";
window.out={};
window.start=async()=>{ const m=await createMap(document.getElementById('m'),{center:{lat:12.639,lng:-8.002},mode:'edit',onChange:s=>(window.out.ch=s),onSelect:i=>(window.out.sel=i)}); window.m=m; window.ready=true; };
</script>"""
def scenario(b, name, token, vendor, fail=False):
    pg=b.new_page(viewport={'width':800,'height':700}); errs=[]
    pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.route("**/__h.html",lambda r:r.fulfill(body=H,content_type="text/html"))
    pg.route("**/api/config/map",lambda r:r.fulfill(body=json.dumps({"mapbox":{"token":token} if token else None}),content_type="application/json"))
    if vendor:
        pg.route("**/vendor/mapbox-gl.js",lambda r:r.fulfill(body=("window.__fail=true;" if fail else "")+STUB,content_type="text/javascript"))
        pg.route("**/vendor/mapbox-gl.css",lambda r:r.fulfill(body="",content_type="text/css"))
    else:
        pg.route("**/vendor/**",lambda r:r.fulfill(status=404,body="no"))
    pg.goto("http://127.0.0.1:18099/__h.html"); pg.evaluate("start()"); pg.wait_for_function("window.ready")
    return pg,errs
with sync_playwright() as p:
    b=p.chromium.launch()
    pg,e=scenario(b,"sans jeton",None,True); chk("sans jeton : plan local (SVG)", pg.locator("svg.geo-map").count()==1 and pg.evaluate("!window.mapboxgl")); chk("sans jeton : aucune erreur",not e); pg.close()
    pg,e=scenario(b,"jeton, fichiers absents","pk.aaaaaaaaaa.bbbbbbbbbb",False); chk("jeton mais bibliothèque absente : repli local", pg.locator("svg.geo-map").count()==1); pg.close()
    pg,e=scenario(b,"jeton refusé","pk.aaaaaaaaaa.bbbbbbbbbb",True,fail=True); chk("jeton refusé par Mapbox : repli local", pg.locator("svg.geo-map").count()==1); chk("repli : carte Mapbox retirée", pg.evaluate("window.__maps.every(m=>m.removed)")); pg.close()
    pg,e=scenario(b,"ok","pk.aaaaaaaaaa.bbbbbbbbbb",True)
    chk("jeton + bibliothèque : fournisseur Mapbox", pg.locator("svg.geo-map").count()==0 and pg.evaluate("window.__maps.length")==1)
    chk("jeton transmis à la bibliothèque", pg.evaluate("mapboxgl.accessToken")=="pk.aaaaaaaaaa.bbbbbbbbbb")
    chk("fond rues par défaut", pg.evaluate("__maps[0].opts.style")=="mapbox://styles/mapbox/streets-v12")
    chk("couches créées", pg.evaluate("['shape-fill','shape-line','verts','pin','others'].every(l=>!!__maps[0].layers[l])"))
    # clics : 4 sommets
    for i,(x,y) in enumerate([(1,1),(2,1),(2,2),(1,2)]):
        pg.evaluate(f"__maps[0].fire('click',{{point:{{x:{x*10},y:{y*10}}},lngLat:{{lat:12.639+{y}*0.0005,lng:-8.002+{x}*0.0005}}}})")
    n=lambda: pg.evaluate("m.getShape().vertices.length")
    chk("4 clics = 4 sommets",n()==4)
    chk("onChange appelé",pg.evaluate("out.ch.vertices.length")==4)
    chk("source de la forme = polygone fermé",pg.evaluate("(()=>{const f=__maps[0].sources.shape.data.features[0];return f.geometry.type==='Polygon'&&f.geometry.coordinates[0].length===5})()"))
    chk("aperçu superficie > 0",pg.evaluate("m.preview().areaM2")>1000)
    # appui sur le sommet 2 sans bouger : sélection
    pg.evaluate("void(__maps[0].vertexAt=(pt)=>pt.x===20&&pt.y===10?2:0)")
    ev="{point:{x:20,y:10},lngLat:{lat:12.6395,lng:-8.0015},features:[{properties:{i:1}}],preventDefault(){}}"
    pg.evaluate(f"__maps[0].fire('mousedown',{ev},'verts');__maps[0].fire('mouseup',{{}});__maps[0].fire('click',{ev})")
    chk("appui sur sommet : choisi, rien ajouté",pg.evaluate("m.getSelected()")==1 and n()==4)
    chk("carte non déplaçable pendant l'appui puis réactivée",pg.evaluate("__maps[0].panOff")==False)
    chk("suppression du sommet choisi",pg.evaluate("m.removeSelected()") is True and n()==3 and pg.evaluate("m.getSelected()") is None)
    # glisser le sommet 0
    pg.evaluate("__maps[0].fire('mousedown',{point:{x:10,y:10},lngLat:{lat:1,lng:1},features:[{properties:{i:0}}],preventDefault(){}},'verts')")
    pg.evaluate("__maps[0].fire('mousemove',{point:{x:60,y:50},lngLat:{lat:12.6402,lng:-8.0001}})")
    pg.evaluate("__maps[0].fire('mouseup',{})")
    v0=pg.evaluate("m.getShape().vertices[0]")
    chk("glisser corrige le sommet et le choisit",abs(v0['lat']-12.6402)<1e-9 and pg.evaluate("m.getSelected()")==0 and n()==3)
    pg.evaluate("m.undo()"); chk("annuler",n()==2 and pg.evaluate("m.getSelected()") is None)
    pg.evaluate("m.setTapMode('point')"); pg.evaluate("__maps[0].fire('click',{point:{x:5,y:5},lngLat:{lat:12.64,lng:-8.0}})")
    chk("mode repère : un clic place le repère",pg.evaluate("m.getShape().point.lat")==12.64 and n()==2)
    pg.evaluate("m.setBase('satellite')"); chk("bascule satellite",pg.evaluate("__maps[0].opts.style").endswith("satellite-streets-v12"))
    pg.wait_for_timeout(50); chk("couches recréées après changement de fond",pg.evaluate("!!__maps[0].layers.verts && !!__maps[0].sources.shape"))
    pg.evaluate("m.clear()"); chk("tout effacer",n()==0 and pg.evaluate("m.getShape().point") is None)
    pg.evaluate("m.destroy()"); chk("destroy retire la carte",pg.evaluate("__maps[0].removed"))
    chk("aucune erreur JavaScript",not e,str(e[:2]))
    b.close()
print("TOUT OK" if all(res) else "ECHECS")
