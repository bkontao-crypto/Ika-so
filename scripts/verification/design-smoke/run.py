import json, urllib.request
from playwright.sync_api import sync_playwright

def log(port):
    return json.load(urllib.request.urlopen(f"http://localhost:{port}/__log"))

results = []
def check(name, ok, detail=""):
    results.append((name, bool(ok), detail)); print(("OK  " if ok else "KO  ") + name + (f" — {detail}" if detail else ""))

with sync_playwright() as p:
    b = p.chromium.launch()
    for label, port, vp in [("bureau", 4173, {"width": 1280, "height": 900}), ("mobile", 4173, {"width": 390, "height": 844})]:
        ctx = b.new_context(viewport=vp, locale="fr-FR"); page = ctx.new_page()
        errs = []
        page.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
        page.on("console", lambda m: errs.append("console: " + m.text) if m.type == "error" and "fonts.g" not in m.text and "ERR_" not in m.text else None)
        base = f"http://localhost:{port}/"
        page.goto(base); page.wait_for_selector(".hero-panel", timeout=8000)
        page.wait_for_selector(".listing-grid .listing", timeout=8000)
        if label == "bureau":
            tabs = page.locator("#nav-desktop a span").all_inner_texts()
            check("onglets d'en-tête = référence", tabs == ["Accueil","Annonces","Carte","Favoris","Messages","Partenaires"], str(tabs))
            check("recherche immobilière absente de l'accueil", page.locator(".search-card, .filters, #recherche").count() == 0)
            order = page.evaluate("""() => { const a=document.getElementById('annonces-sponsorisees'), b=document.getElementById('annonces'); return !!(a&&b&&(a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING)); }""")
            check("annonces sponsorisées avant les annonces classiques", order)
            check("2 publications sponsorisées (annonces à la une)", page.locator(".sponsored-post").count() == 2, str(page.locator(".sponsored-post").count()))
            check("mention « Sponsorisé » affichée", page.locator(".sponsored-post", has_text="Sponsorisé").count() == 2)
            check("bureau : pas de défilement horizontal (accueil)", not page.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1"))
            check("bureau : en-tête contenu dans la fenêtre", page.evaluate("(()=>{const r=document.querySelector('.header-actions').getBoundingClientRect();return r.right<=window.innerWidth;})()"))
            check("logo de l'en-tête chargé", page.evaluate("() => { const i=document.querySelector('.brand-logo'); return i && i.complete && i.naturalWidth>0; }"))
            check("icônes de navigation dessinées", page.locator("#nav-desktop svg path").count() == 6)
            page.screenshot(path="captures/home_bureau.png", full_page=True)
            # catégories → Annonces filtrées
            page.locator(".category", has_text="Terrains").click(); page.wait_for_selector(".listing-grid .listing")
            n = page.locator(".listing-grid .listing").count()
            check("catégorie Terrains → page Annonces filtrée", page.url.endswith("#/annonces?category=Terrain") and n == 2, f"{page.url.split('#')[1]} / {n} biens")
            # recherche rapide
            page.goto(base + "#/"); page.wait_for_selector(".hero-panel")
            page.fill("#quickSearchInput", "Hamdallaye"); page.press("#quickSearchInput", "Enter"); page.wait_for_timeout(600)
            page.wait_for_selector(".listing-grid .listing")
            check("recherche rapide de l'en-tête appliquée", page.locator(".listing-grid .listing").count() == 2 and "q=Hamdallaye" in page.url, str(page.locator(".listing-grid .listing").count()))
            # Annonces : filtres existants
            page.click(".search-tab[data-mode='Location']"); page.click(".filter-submit"); page.wait_for_timeout(500)
            check("Annonces : filtre Louer + recherche", all("Location" in t for t in page.locator(".listing-grid .tag-tr").all_inner_texts()) or page.locator(".listing-grid .listing").count() >= 1)
            page.screenshot(path="captures/annonces_bureau.png", full_page=True)
            # Carte
            page.goto(base + "#/carte"); page.wait_for_selector("#recherche .search-card"); page.wait_for_selector(".listing-grid .listing")
            check("Carte contient le bloc Recherche immobilière", page.locator("#recherche .search-card").count() == 1)
            check("Carte : Tous / Acheter / Louer", page.locator("#recherche .search-tab").all_inner_texts() == ["Tous","Acheter","Louer"])
            labels = page.locator("#recherche label.field").all_inner_texts()
            check("Carte : champs du formulaire", len(labels) == 3 and "Type de bien" in labels[0] and "Ville ou quartier" in labels[1] and "Budget maximum (FCFA)" in labels[2], str([l.split(chr(10))[0] for l in labels]))
            before = len(log(4173))
            page.click("#recherche .search-tab[data-mode='Vente']")
            page.select_option("#recherche select", "Terrain")
            page.fill("#recherche input[type=search]", "ACI")
            page.fill("#recherche input[inputmode=numeric]", "45000000")
            page.click("#recherche .filter-submit"); page.wait_for_timeout(700)
            req = [r for r in log(4173)[before:] if r.startswith("GET /listings")]
            ok = bool(req) and all(k in req[-1] for k in ["transaction=Vente","category=Terrain","q=ACI","maxPrice=45000000"])
            check("Carte : la recherche appelle /listings avec tous les filtres", ok, req[-1] if req else "aucune requête")
            check("Carte : résultat filtré affiché (1 bien)", page.locator(".listing-grid .listing").count() == 1, str(page.locator(".listing-grid .listing").count()))
            check("Carte : carte des annonces présente", page.locator(".map-wrap .map, .map-wrap [class*=map]").count() > 0)
            page.screenshot(path="captures/carte_bureau.png", full_page=True)
            # Partenaires
            page.goto(base + "#/partenaires"); page.wait_for_selector(".sponsor-card")
            check("Partenaires : 3 cartes + bannière", page.locator(".sponsor-card").count() == 3 and page.locator(".sponsor-banner").count() == 1)
            page.screenshot(path="captures/partenaires_bureau.png", full_page=True)
            # autres routes : pas de régression d'affichage
            for route, sel in [("#/favoris", "main"), ("#/connexion", "main"), ("#/confiance", "main"), ("#/publier", "main")]:
                page.goto(base + route); page.wait_for_timeout(500)
                check(f"route {route} affiche du contenu", len(page.locator("main").inner_text().strip()) > 20, str(len(page.locator("main").inner_text().strip())))
            page.goto(base + "#/"); page.click("#themeToggle"); page.wait_for_timeout(200)
            check("bascule thème sombre", page.evaluate("document.documentElement.dataset.theme") == "dark")
            page.screenshot(path="captures/home_sombre.png")
        else:
            nav = page.locator("#nav-bottom a").count()
            check("mobile : barre d'onglets à 6 entrées", nav == 6, str(nav))
            overflow = page.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
            check("mobile : pas de défilement horizontal (accueil)", not overflow)
            page.screenshot(path="captures/home_mobile.png", full_page=True)
            for route in ["#/annonces", "#/carte", "#/partenaires"]:
                page.goto(base + route); page.wait_for_timeout(900)
                check(f"mobile : {route} sans défilement horizontal", not page.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1"))
            page.goto(base + "#/carte"); page.wait_for_timeout(700); page.screenshot(path="captures/carte_mobile.png", full_page=True)
        check(f"[{label}] aucune erreur JavaScript", not errs, "; ".join(errs[:3]))
        ctx.close()
    # utilisateur connecté
    ctx = b.new_context(viewport={"width": 1280, "height": 900}); page = ctx.new_page(); errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    base = "http://localhost:4174/"
    page.goto(base); page.wait_for_selector(".hero-panel"); page.wait_for_timeout(600)
    check("connecté : pastille de profil + bouton Publier", page.locator(".profile").count() == 1 and page.locator(".header-publish").count() == 1)
    check("connecté : badge de messages non lus", page.locator("#nav-desktop .notification").inner_text() == "3")
    page.goto(base + "#/carte"); page.wait_for_selector("#recherche .search-card"); page.wait_for_timeout(700)
    check("connecté : section « Mes biens localisés » conservée", page.locator("text=Mes biens localisés").count() >= 1)
    check("connecté : aucune erreur JavaScript", not errs, "; ".join(errs[:3]))
    b.close()
ko = [r for r in results if not r[1]]
print(f"\n{len(results)-len(ko)}/{len(results)} contrôles réussis"); 
