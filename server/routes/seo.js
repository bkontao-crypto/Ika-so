import { Router } from "express";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AppError } from "../lib/errors.js";
import { listingPath, listingSlug, zoneFromSlug } from "../lib/slug.js";
import { GUIDES } from "../seo/guides.js";
import * as view from "../seo/render.js";
import { renderMarkdown } from "../seo/legal.js";
import { LEGAL_PAGES, legalPage } from "../seo/legal.js";

/** Pages publiques rendues côté serveur, plan du site et robots. */
export function buildSeoRoutes({ seo, config }) {
  const router = Router();
  const baseOf = (req) => config.publicUrl || `http://${req.get("host") ?? "localhost"}`;
  const html = (res, body, status = 200) => {
    res.status(status).setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", status === 200 ? "public, max-age=300" : "no-store");
    res.end(body);
  };
  const missing = (req, res) => html(res, view.notFoundPage({ base: baseOf(req), path: req.originalUrl.split("?")[0] }), 404);
  // Une page qui n'existe pas (annonce retirée) répond 404 ; toute autre erreur suit le chemin normal.
  const guard = (fn) => async (req, res, next) => {
    try { await fn(req, res); } catch (error) { if (error instanceof AppError && error.status === 404) return missing(req, res); next(error); }
  };

  // Réglages du propriétaire lus à chaque requête (cache de 30 s dans le service) : redirections, logo, SEO, textes légaux.
  const normalize = (p) => (p.length > 1 ? p.replace(/\/+$/, "") : p);
  router.use(async (req, res, next) => {
    try {
      const site = seo.siteSettings ? await seo.siteSettings() : {};
      view.setSite(site);
      req.site = site;
      if ((req.method === "GET" || req.method === "HEAD") && site.redirects?.size && !req.path.startsWith("/api/")) {
        const to = site.redirects.get(normalize(req.path));
        if (to) { res.setHeader("Cache-Control", "public, max-age=300"); return res.redirect(301, to); }
      }
      next();
    } catch (error) { next(error); }
  });

  // Page d'accueil : index.html avec le titre, la description, les mots-clés et le logo du propriétaire quand ils sont réglés.
  const INDEX = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "public", "index.html");
  router.get(["/", "/index.html"], async (req, res, next) => {
    try {
      const page = view.brandIndexHtml(await readFile(INDEX, "utf8"), req.site);
      res.status(200).setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.end(page);
    } catch (error) { if (error?.code === "ENOENT") return next(); next(error); }
  });

  router.get("/mentions-legales", (req, res) => {
    const text = String(req.site?.mentions ?? "").trim();
    if (!text) return missing(req, res);
    const md = /^#\s/.test(text) ? text : `# Mentions légales\n\n${text}`;
    html(res, view.layout({ base: baseOf(req), path: "/mentions-legales", title: "Mentions légales | Ika So", description: "Mentions légales du service Ika So (Mali).",
      body: `<article class="stack legal">${renderMarkdown(md).replace("<h2>", '<h1 class="title">').replace("</h2>", "</h1>")}</article>` }));
  });

  router.get("/quartiers", guard(async (req, res) => html(res, view.zonesIndex({ base: baseOf(req), zones: await seo.zones() }))));
  router.get("/quartier/:slug", guard(async (req, res) => {
    const zone = zoneFromSlug(req.params.slug);
    if (!zone) return missing(req, res);
    html(res, view.zonePage({ base: baseOf(req), zone, data: await seo.zonePage(zone.name) }));
  }));
  // /a/<id> et /a/<id>/<titre> : la forme lisible est l'adresse canonique ; toute autre forme y est redirigée (301).
  const listingRoute = guard(async (req, res) => {
    const data = await seo.listingPage(req.params.id);
    // Le titre dans l'adresse est décoratif : s'il manque ou ne correspond plus au titre actuel, on redirige vers la forme canonique.
    if ((req.params.slug ?? "") !== listingSlug(data.card.title)) {
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.redirect(301, listingPath(data.card));
    }
    html(res, view.listingPage({ base: baseOf(req), data }));
  });
  router.get("/a/:id", listingRoute);
  router.get("/a/:id/:slug", listingRoute);
  router.get("/agences", guard(async (req, res) => html(res, view.agenciesPage({ base: baseOf(req), agencies: await seo.agencies() }))));
  router.get("/agence/:id", guard(async (req, res) => html(res, view.agencyPage({ base: baseOf(req), agency: await seo.agency(req.params.id) }))));
  router.get("/guides", guard(async (req, res) => html(res, view.guidesIndex({ base: baseOf(req) }))));
  router.get("/guides/:slug", guard(async (req, res) => {
    const guide = GUIDES.find((g) => g.slug === req.params.slug);
    if (!guide) return missing(req, res);
    html(res, view.guidePage({ base: baseOf(req), guide }));
  }));
  for (const page of LEGAL_PAGES) {
    router.get(page.path, (req, res) => {
      const body = legalPage({ base: baseOf(req), page, site: req.site });
      if (!body) return missing(req, res);
      html(res, body);
    });
  }
  router.get("/sitemap.xml", guard(async (req, res) => {
    res.status(200).setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.end(view.sitemapXml({ base: baseOf(req), entries: await seo.sitemapEntries() }));
  }));
  router.get("/robots.txt", (req, res) => {
    res.status(200).setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(view.robotsTxt(baseOf(req)));
  });
  return router;
}
