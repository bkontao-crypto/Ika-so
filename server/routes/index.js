import { premiumOrigin } from "../lib/analytics-events.js";
import { Router } from "express";
import { AppError } from "../lib/errors.js";
import { sha256 } from "../lib/security.js";
import { clean, readDraft } from "../lib/web.js";
import { formatReceiptEmail } from "../lib/receipt-email.js";
import { ficheHtml } from "../lib/fiche.js";
import { appFailPage, appReturnPage, authorizationUrl, clearedStateCookie, exchangeCode, fetchProfile, newState, packState, readStateCookie, safeNext, sameState, stateCookie } from "../lib/google-oauth.js";

const LOGIN_FAIL_WINDOW_MS = 15 * 60_000;

export function buildRoutes({ services, config, limiter, logger, counters, requireUser, setSession, clearSession }) {

  // Contrôle d'accès Owner Center avec délégation (DEC-003)
  async function requireOwnerModule(req, module) {
    const userId = requireUser(req);
    const ok = await services.ownerDelegations.canAccess(userId, module);
    if (!ok) {
      const err = new Error("Accès refusé à ce module.");
      err.status = 403;
      throw err;
    }
    return userId;
  }

  const { featuredRequests, accounts, listings, moderation, moderationAudit, crm, whatsapp, superadminSettings, trust, engagement, imports, seo, payments, rights, reviews, notifier, geo, advertiserProfiles, analytics, stats, homepageSettings, partners, places, ownerCenter, advertiserCenter, advertiserApplications } = services;
  // Événement d'usage : meilleur effort, jamais bloquant, éteint par défaut (voir services/analytics.js).
  const track = (req, type, fields) => analytics?.emit(type, fields, req);
  const router = Router();
  const id = (req) => clean(req.params.id, 80);

  // Images publiques stockées durablement dans PostgreSQL/Neon, jamais sur le disque éphémère Render.
  router.get("/media/:id", async (req, res) => {
    const fileId = id(req);
    // Le contenu d'un fichier ne change jamais pour un identifiant donné : l'identifiant sert d'ETag.
    const etag = `"${fileId}"`;
    const sameTag = String(req.headers["if-none-match"] ?? "").split(",").some((t) => t.trim() === etag);
    // Les droits sont toujours revérifiés ; seule la lecture du contenu binaire est évitée sur un 304.
    let file = await listings.publicImage(fileId, req.user?.id ?? null, { metaOnly: sameTag });
    if (!file) return res.status(404).json({ error: "Fichier introuvable." });
    // Image non publique : jamais de 304, le contenu est relu en entier.
    if (sameTag && !file.is_public) file = await listings.publicImage(fileId, req.user?.id ?? null);
    if (!file) return res.status(404).json({ error: "Fichier introuvable." });
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Vary", "Cookie");
    if (file.is_public) {
      // Image d'une annonce publiée : le navigateur la garde 5 minutes (cache privé, jamais partagé), puis revalide.
      res.setHeader("Cache-Control", "private, max-age=300, must-revalidate");
      res.setHeader("ETag", etag);
    } else {
      // Annonce non publiée, vue par son propriétaire ou le personnel : jamais de cache.
      res.setHeader("Cache-Control", "private, no-store");
    }
    if (file.is_public && sameTag) return res.status(304).end();
    res.setHeader("Content-Type", file.mime_type);
    res.setHeader("Content-Length", Buffer.byteLength(file.content));
    res.end(file.content);
  });

  // Erreurs vues par le navigateur : message et lieu seulement, 20 par heure et par adresse (en mémoire).
  router.post("/client-error", (req, res) => {
    limiter.hit(`cerr:${req.ip}`, 20, 60 * 60_000);
    counters.clientErrors += 1;
    logger.warn("erreur_navigateur", { message: clean(req.body?.message, 300), source: clean(req.body?.source, 200), page: clean(req.body?.page, 80) });
    res.status(204).end();
  });

  // ---------- Compte et session ----------
  router.post("/auth/register", async (req, res) => {
    limiter.hit(`auth:${req.ip}`, 10, 10 * 60_000);
    const { token, user } = await accounts.register(req.body ?? {});
    track(req, "user_registered", { userId: user.id });
    ownerCenter?.recordSecurity("REGISTER", { userId: user.id }, req);
    setSession(res, token);
    res.status(201).json({ user });
  });

  router.post("/auth/login", async (req, res) => {
    limiter.hit(`auth:${req.ip}`, 10, 10 * 60_000);
    // Frein par compte (en plus du frein par adresse) : 5 échecs en 15 minutes sur un même e-mail,
    // même si les essais viennent d'adresses différentes. L'e-mail inconnu compte pareil : rien ne révèle si le compte existe.
    const failKey = `loginfail:${sha256(String(req.body?.email ?? "").trim().toLowerCase().slice(0, 200))}`;
    limiter.check(failKey, 5, LOGIN_FAIL_WINDOW_MS);
    let result;
    try {
      result = await accounts.login(req.body ?? {});
    } catch (error) {
      if (error instanceof AppError && error.status === 401) { limiter.record(failKey); ownerCenter?.recordSecurity("LOGIN_FAILED", {}, req); }
      throw error;
    }
    limiter.forget(failKey);
    const { token, user } = result;
    track(req, "user_login", { userId: user.id });
    ownerCenter?.recordSecurity("LOGIN", { userId: user.id }, req);
    setSession(res, token);
    res.json({ user });
  });

  // ---------- Connexion avec Google (flux « code » côté serveur) ----------
  // Retour vers l'accueil (#/) ou la page demandée ; les erreurs reviennent sur /#/connexion?google=<code>.
  const googleBack = (path) => `/#${path}`;
  router.get("/auth/google", (req, res) => {
    limiter.hit(`oauth:${req.ip}`, 20, 10 * 60_000);
    res.setHeader("Cache-Control", "no-store");
    if (!config.google?.enabled) return res.redirect(302, googleBack("/connexion?google=indisponible"));
    // Liaison depuis « Mon profil » : compte déjà connecté, conditions déjà acceptées.
    if (req.query.link === "1") {
      if (!req.user) return res.redirect(302, googleBack("/connexion?google=connexion-requise"));
      const state = newState();
      res.setHeader("Set-Cookie", stateCookie(packState({ s: state, n: "/profil", t: 0, l: 1, a: 0 }), config));
      return res.redirect(302, authorizationUrl({ clientId: config.google.clientId, redirectUri: config.google.redirectUri, state }));
    }
    if (req.query.terms !== "1") return res.redirect(302, googleBack("/connexion?google=conditions"));
    const state = newState();
    // a = 1 : connexion lancée depuis l'application Android (retour par ticket, voir /auth/app-handoff).
    res.setHeader("Set-Cookie", stateCookie(packState({ s: state, n: safeNext(req.query.next), t: 1, l: 0, a: req.query.app === "1" ? 1 : 0 }), config));
    res.redirect(302, authorizationUrl({ clientId: config.google.clientId, redirectUri: config.google.redirectUri, state }));
  });

  router.get("/auth/google/callback", async (req, res) => {
    limiter.hit(`oauth:${req.ip}`, 20, 10 * 60_000);
    res.setHeader("Cache-Control", "no-store");
    const saved = readStateCookie(req.headers.cookie);
    const linking = saved?.l === 1;
    const fail = (code) => {
      res.setHeader("Set-Cookie", clearedStateCookie());
      if (saved?.a === 1 && !linking) { // connexion lancée depuis l'application : on explique l'échec ici, sans ouvrir le site (peut-être connecté à un autre compte)
        res.status(200);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        return res.send(appFailPage(code));
      }
      return res.redirect(302, googleBack(`${linking ? "/profil" : "/connexion"}?google=${code}`));
    };
    if (!config.google?.enabled) return fail("indisponible");
    if (req.query.error) return fail("refus");
    if (!saved || !sameState(req.query.state, saved.s)) return fail("etat");
    try {
      const accessToken = await exchangeCode({ code: String(req.query.code ?? ""), clientId: config.google.clientId, clientSecret: config.google.clientSecret, redirectUri: config.google.redirectUri });
      const profile = await fetchProfile(accessToken);
      if (linking) {
        if (!req.user) return fail("connexion-requise");
        await accounts.linkGoogle(req.user.id, profile);
        ownerCenter?.recordSecurity("GOOGLE_LINK", { userId: req.user.id }, req);
        res.setHeader("Set-Cookie", clearedStateCookie());
        return res.redirect(302, googleBack("/profil?google=lie"));
      }
      if (saved.a === 1) {
        // Application : aucune session dans le navigateur ; un ticket à usage unique ramène l'application à la session.
        const { user } = await accounts.loginWithGoogle(profile, { acceptTerms: saved.t === 1, session: false });
        track(req, "user_login", { userId: user.id });
        ownerCenter?.recordSecurity("LOGIN", { userId: user.id }, req);
        const ticket = await accounts.issueLoginTicket(user.id);
        res.setHeader("Set-Cookie", clearedStateCookie());
        res.status(200);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        return res.send(appReturnPage(ticket));
      }
      const { token, user } = await accounts.loginWithGoogle(profile, { acceptTerms: saved.t === 1 });
      track(req, "user_login", { userId: user.id });
      ownerCenter?.recordSecurity("LOGIN", { userId: user.id }, req);
      setSession(res, token);
      res.append("Set-Cookie", clearedStateCookie());
      res.redirect(302, googleBack(saved.n));
    } catch (error) {
      logger.warn("connexion_google_echec", { status: error?.status ?? 0, liaison: linking });
      const code = linking
        ? (error?.status === 409 ? "deja-lie" : error?.status === 400 ? "email-different" : "echec")
        : (error?.status === 409 ? "compte-existant" : error?.status === 400 ? "conditions" : error?.status === 403 ? "bloque" : "echec");
      fail(code);
    }
  });

  // Application Android : le ticket (60 s, une fois) ouvre la session dans la WebView de l'application.
  router.get("/auth/app-handoff", async (req, res) => {
    limiter.hit(`handoff:${req.ip}`, 20, 10 * 60_000);
    res.setHeader("Cache-Control", "no-store");
    try {
      const { token } = await accounts.consumeLoginTicket(req.query.ticket);
      setSession(res, token);
      res.redirect(302, "/");
    } catch (error) {
      res.redirect(302, googleBack("/connexion?google=ticket-expire"));
    }
  });

  // Mot de passe oublié : réponse identique que le compte existe ou non ; freins par adresse IP et par e-mail.
  router.post("/auth/forgot", async (req, res) => {
    limiter.hit(`forgot:${req.ip}`, 10, 60 * 60_000);
    limiter.hit(`forgotmail:${sha256(String(req.body?.email ?? "").trim().toLowerCase().slice(0, 200))}`, 5, 60 * 60_000);
    res.json(await accounts.requestPasswordReset(req.body ?? {}));
  });
  router.post("/auth/reset", async (req, res) => {
    limiter.hit(`reset:${req.ip}`, 10, 60 * 60_000);
    res.json(await accounts.resetPassword(req.body ?? {}));
  });
  router.post("/staff/accounts/:id/reset-link", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json(await accounts.staffResetLink(requireUser(req), id(req)));
  });

  router.post("/auth/logout", async (req, res) => {
    if (req.user) { track(req, "user_logout", { userId: req.user.id }); ownerCenter?.recordSecurity("LOGOUT", { userId: req.user.id }, req); }
    await accounts.logout(req.sessionToken);
    clearSession(res);
    res.json({ ok: true });
  });

  // Visiteur anonyme : { user: null } (pas une erreur).
  router.get("/me", async (req, res) => {
    if (!req.user) return res.json({ user: null });
    res.json({ user: req.user, meta: await accounts.me(req.user.id) });
  });

  router.post("/me/otp", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`otp:${req.ip}`, 20, 60 * 60_000);
    res.json(await accounts.requestOtp(userId, req.body ?? {}));
  });

  router.post("/me/otp/verify", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`otpv:${userId}`, 20, 60 * 60_000);
    const out = await accounts.verifyOtp(userId, req.body?.code);
    track(req, "verification_completed", { userId, metadata: { from: "phone" } });
    res.json(out);
  });

  // Retrait du lien Google (refusé sans mot de passe, voir accounts.unlinkGoogle).
  router.delete("/me/google", async (req, res) => {
    res.json(await accounts.unlinkGoogle(requireUser(req)));
  });

  // Boutons de connexion affichés selon la configuration (aucun secret).
  router.get("/config/auth", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ google: Boolean(config.google?.enabled) });
  });

  router.get("/config/map", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ mapbox: config.mapbox?.token ? { token: config.mapbox.token } : null });
  });

  // ---------- Mesure de page vue (aucun identifiant visiteur/session sans décision juridique) ----------
  router.post("/e", (req, res) => {
    limiter.hit(`event:${req.ip}`, 30, 60_000);
    const pagePath = String(req.body?.pagePath ?? "/").split("?")[0].split("#")[0];
    if (!pagePath.startsWith("/") || pagePath.length > 160) return res.status(400).json({ error: "Page invalide." });
    track(req, "page_view", { pagePath });
    res.status(204).end();
  });

  // ---------- Catalogue public ----------
  router.get("/listings", async (req, res) => {
    const q = req.query;
    res.json(
      await listings.listPublic({
        transaction: clean(q.transaction), category: clean(q.category), zone: clean(q.zone, 120),
        maxPrice: q.maxPrice, minPrice: q.minPrice, minSurface: q.minSurface, bedrooms: q.bedrooms,
        query: clean(q.q, 80), sort: clean(q.sort, 20), limit: q.limit, offset: q.offset,
      }),
    );
  });


  // ---------- Insights CRM (E10) ----------
  router.get("/me/crm/insights", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const userId = requireUser(req);
    const stats = await crm.stats(userId);
    const leads = await crm.list(userId, { limit: 200 });
    const bySourceConv = {};
    for (const l of leads) {
      const src = l.source || "unknown";
      if (!bySourceConv[src]) bySourceConv[src] = { total: 0, won: 0 };
      bySourceConv[src].total++;
      if (l.status === "WON") bySourceConv[src].won++;
    }
    const conversionBySource = Object.fromEntries(
      Object.entries(bySourceConv).map(([k, v]) => [k, v.total ? Math.round(v.won / v.total * 100) : 0])
    );
    const toRelaunch = leads.filter(l =>
      (l.score || 0) >= 50 && ["NEW", "CONTACTED"].includes(l.status)
    ).slice(0, 10);
    res.json({
      ...stats,
      conversionBySource,
      toRelaunch: toRelaunch.map(l => ({ id: l.id, score: l.score, status: l.status, source: l.source, contact_name: l.contact_name })),
    });
  });

router.get("/listings/:id", async (req, res) => {
    const listing = await listings.getPublic(id(req));
    track(req, "listing_view", { listingId: listing?.id ?? id(req), userId: req.user?.id });
    res.json(listing);
  });
  router.get("/listings/:id/similar", async (req, res) => res.json(await listings.similarPublic(id(req))));
  router.get("/listings/:id/comments", async (req, res) => res.json(await listings.listComments(id(req))));

  // ---------- Cartographie immobilière : position GPS et parcelle (voir server/services/geo.js) ----------
  // Publique : renvoie { geo: null } sauf si l'annonceur a choisi d'afficher la position exacte d'une annonce publiée.
  router.get("/listings/:id/geo", async (req, res) => res.json(await geo.getPublic(id(req))));
  router.get("/me/geo", async (req, res) => res.json(await geo.mine(requireUser(req), { category: clean(req.query.category, 20) })));
  router.get("/me/listings/:id/geo", async (req, res) => res.json(await geo.getMine(requireUser(req), id(req))));
  router.post("/me/listings/:id/geo", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`geo:${userId}`, 60, 60 * 60_000);
    res.json(await geo.save(userId, id(req), { point: req.body?.point, polygon: req.body?.polygon, isPublic: req.body?.isPublic }));
  });
  router.post("/me/listings/:id/geo/delete", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`geo:${userId}`, 60, 60 * 60_000);
    res.json(await geo.remove(userId, id(req), { confirm: req.body?.confirm }));
  });

  // ---------- CRM leads (E07) ----------
  router.get("/me/crm/leads", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json(await crm.list(requireUser(req), {
      status: clean(req.query.status, 20) || undefined,
      limit: Number(req.query.limit) || 100,
      offset: Number(req.query.offset) || 0,
    }));
  });
  router.get("/me/crm/stats", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json(await crm.stats(requireUser(req)));
  });

  // ---------- Rappel leads chauds non traités (E08) ----------
  router.post("/me/crm/remind-hot", async (req, res) => {
    const userId = requireUser(req);
    const leads = await crm.list(userId, { status: "NEW", limit: 50 });
    const hot = leads.filter(l => (l.score || 0) >= 80);
    if (hot.length && notifier?.notify) {
      await notifier.notify(userId, {
        title: `${hot.length} lead(s) chaud(s) en attente`,
        body: `Vous avez ${hot.length} lead(s) prioritaire(s) non traité(s).`,
        channels: ["email", "sms", "whatsapp"],
      }).catch(() => {});
    }
    res.json({ reminded: hot.length });
  });

  router.post("/me/crm/leads", async (req, res) => {
    const userId = requireUser(req);
    const created = await crm.create(userId, {
      listingId: clean(req.body?.listingId, 80),
      contactName: clean(req.body?.contactName, 120),
      contactPhone: clean(req.body?.contactPhone, 40),
      contactEmail: clean(req.body?.contactEmail, 120),
      source: clean(req.body?.source, 30) || "manual",
      status: clean(req.body?.status, 20) || "NEW",
      notes: clean(req.body?.notes, 2000),
    });
    // Notification nouveau lead (E08)
    if (created && notifier?.notify) {
      const isHot = (created.score || 0) >= 80;
      await notifier.notify(userId, {
        title: isHot ? "Lead chaud" : "Nouveau lead",
        body: isHot
          ? `Un lead prioritaire (${created.score}) vient d'arriver.`
          : "Un nouveau lead a été ajouté à votre CRM.",
        channels: ["email", "sms", "whatsapp"],
      }).catch(() => {});
    }
    res.status(201).json(created);
  });
  router.get("/me/crm/leads/:id", async (req, res) => {
    const row = await crm.get(requireUser(req), id(req));
    if (!row) return res.status(404).json({ error: "Lead introuvable" });
    res.json(row);
  });
  router.put("/me/crm/leads/:id", async (req, res) => {
    const updated = await crm.update(requireUser(req), id(req), {
      contactName: clean(req.body?.contactName, 120),
      contactPhone: clean(req.body?.contactPhone, 40),
      contactEmail: clean(req.body?.contactEmail, 120),
      status: clean(req.body?.status, 20),
      notes: clean(req.body?.notes, 2000),
      listingId: clean(req.body?.listingId, 80),
    });
    if (!updated) return res.status(404).json({ error: "Lead introuvable" });
    res.json(updated);
  });


  // ---------- WhatsApp Business (E07) ----------
  router.get("/webhooks/whatsapp", (req, res) => {
    const challenge = whatsapp.verifyWebhook(
      req.query["hub.mode"],
      req.query["hub.verify_token"],
      req.query["hub.challenge"]
    );
    if (challenge) return res.status(200).send(challenge);
    res.sendStatus(403);
  });

  router.post("/webhooks/whatsapp", async (req, res) => {
    // Signature Meta (X-Hub-Signature-256) vérifiée sur le texte exact reçu, avant tout traitement.
    const sig = whatsapp.verifySignature(req.rawBody, req.headers["x-hub-signature-256"]);
    if (sig === "not_configured") return res.sendStatus(503);
    if (sig !== "ok") return res.sendStatus(401);
    // Répondre vite à Meta
    res.sendStatus(200);
    try {
      const messages = whatsapp.parseIncoming(req.body);
      for (const msg of messages) {
        logger?.info?.("WhatsApp incoming", { from: msg.from, type: msg.type });
        if (!msg.from || !msg.text) continue;
        // Association automatique : chercher un lead avec ce numéro
        const phone = msg.from.replace(/\D/g, "");
        const rows = await services.db.query(
          `select id, advertiser_id, notes from ika_crm_leads
           where regexp_replace(contact_phone, '\\D', '', 'g') = $1
           order by updated_at desc limit 1`,
          [phone]
        ).catch(() => []);
        if (rows[0]) {
          const lead = rows[0];
          const note = (lead.notes ? lead.notes + "\n" : "") +
            `[WhatsApp reçu] ${msg.text.slice(0, 300)}`;
          await crm.update(lead.advertiser_id, lead.id, { notes: note, status: "CONTACTED" }).catch(() => {});
        }
      }
    } catch (e) {
      logger?.error?.("WhatsApp webhook error", e);
    }
  });

  router.post("/me/crm/leads/:id/whatsapp", async (req, res) => {
    const userId = requireUser(req);
    const lead = await crm.get(userId, id(req));
    if (!lead) return res.status(404).json({ error: "Lead introuvable" });

  router.get("/me/whatsapp/templates", async (req, res) => {
    requireUser(req);
    if (!whatsapp.isConfigured()) return res.status(503).json({ error: "WhatsApp non configuré" });
    try {
      const data = await whatsapp.listTemplates();
      res.json(data.data || data);
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
    }
  });

  router.post("/me/crm/leads/:id/whatsapp-template", async (req, res) => {
    const userId = requireUser(req);
    const lead = await crm.get(userId, id(req));
    if (!lead) return res.status(404).json({ error: "Lead introuvable" });
    if (!lead.contact_phone) return res.status(400).json({ error: "Pas de téléphone" });
    if (!whatsapp.isConfigured()) return res.status(503).json({ error: "WhatsApp non configuré" });
    const name = clean(req.body?.template, 80);
    if (!name) return res.status(400).json({ error: "Nom de template requis" });
    const out = await whatsapp.sendTemplate(lead.contact_phone, name, clean(req.body?.language, 10) || "fr", req.body?.components || []);
    await crm.update(userId, id(req), {
      notes: (lead.notes ? lead.notes + "\n" : "") + `[Template WhatsApp] ${name}`,
    }).catch(() => {});
    res.json({ ok: true, messageId: out.messages?.[0]?.id });
  });

    if (!lead.contact_phone) return res.status(400).json({ error: "Pas de téléphone sur ce lead" });
    if (!whatsapp.isConfigured()) return res.status(503).json({ error: "WhatsApp Business non configuré" });
    const text = clean(req.body?.text, 1000) || "Bonjour, suite à votre intérêt sur Ika So.";
    const out = await whatsapp.sendText(lead.contact_phone, text);
    // Journaliser dans les notes du lead
    await crm.update(userId, id(req), {
      notes: (lead.notes ? lead.notes + "\n" : "") + `[WhatsApp envoyé] ${text.slice(0, 200)}`,
    }).catch(() => {});
    res.json({ ok: true, messageId: out.messages?.[0]?.id });
  });

  // ---------- Biens (DEC-004) ----------
  router.get("/me/properties", async (req, res) => {
    res.json(await services.properties.mine(requireUser(req)));
  });
  router.post("/me/properties", async (req, res) => {
    const userId = requireUser(req);
    const title = String(req.body?.title || "").trim();
    if (!title) return res.status(400).json({ error: "Titre requis" });
    res.json(await services.properties.create(userId, req.body));
  });
  router.get("/me/properties/:id", async (req, res) => {
    const row = await services.properties.get(requireUser(req), id(req));
    if (!row) return res.status(404).json({ error: "Bien introuvable" });
    res.json(row);
  });

  // Fiche imprimable (HTML, propriétaire seulement, jamais mise en cache ni indexée).
  router.get("/me/listings/:id/fiche", async (req, res) => {
    const { geo: shape, listing } = await geo.fiche(requireUser(req), id(req));
    res.status(200).setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(ficheHtml({ geo: shape, listing, mapboxToken: config.mapbox?.token ?? "" }));
  });
  router.get("/staff/listings/:id/geo", async (req, res) => res.json(await geo.getForStaff(requireUser(req), id(req))));

  // ---------- Annonceur ----------
  router.get("/me/listings", async (req, res) => res.json(await listings.listMine(requireUser(req))));
  router.get("/me/listings/:id", async (req, res) => res.json(await listings.getOwn(requireUser(req), id(req))));
  router.get("/me/favorites", async (req, res) => res.json(await listings.listFavorites(requireUser(req))));

  // Brouillon « nouvelle annonce » : un par compte, remplacé à chaque enregistrement automatique.
  router.get("/me/draft", async (req, res) => res.json(await listings.getDraft(requireUser(req))));
  router.put("/me/draft", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`draft:${userId}`, 120, 10 * 60_000);
    res.json(await listings.saveDraft(userId, req.body));
  });
  router.delete("/me/draft", async (req, res) => res.json(await listings.deleteDraft(requireUser(req))));

  router.post("/listings", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`create:${userId}`, 10, 60 * 60_000);
    const draft = readDraft(req.body);
    const created = await listings.create(userId, draft);
    const propertyId = clean(req.body?.propertyId, 80) || clean(req.body?.property_id, 80);
    if (propertyId && created?.id) {
      await services.properties.linkListing(userId, propertyId, created.id).catch(() => {});
    }
    track(req, "listing_created", { userId, listingId: created?.id });
    res.status(201).json(created);
  });

  router.put("/listings/:id", async (req, res) => {
    const userId = requireUser(req);
    const out = await listings.update(userId, id(req), readDraft(req.body));
    const propertyId = clean(req.body?.propertyId, 80) || clean(req.body?.property_id, 80);
    if (propertyId) {
      await services.properties.linkListing(userId, propertyId, id(req)).catch(() => {});
    }
    track(req, "listing_updated", { userId, listingId: id(req) });
    res.json(out);
  });

  router.post("/listings/:id/outcome", async (req, res) => {
    const userId = requireUser(req);
    const outcome = clean(req.body?.outcome);
    const out = await listings.setOutcome(userId, id(req), outcome);
    if (outcome === "ARCHIVED") track(req, "listing_archived", { userId, listingId: id(req) });
    res.json(out);
  });

  // ---------- Engagement ----------
  router.post("/listings/:id/favorite", async (req, res) => {
    const userId = requireUser(req);
    const out = await listings.toggleFavorite(userId, id(req));
    track(req, out?.on ? "listing_favorite_added" : "listing_favorite_removed", { userId, listingId: id(req) });
    res.json(out);
  });

  router.post("/listings/:id/contact", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`contact:${userId}`, 30, 10 * 60_000);
    const whatsapp = req.body?.kind === "WHATSAPP";
    const source = whatsapp ? "WHATSAPP" : "CALL";
    const out = await listings.recordContact(userId, id(req), source);
    track(req, "contact_clicked", { userId, listingId: id(req), metadata: { from: "listing" } });
    track(req, whatsapp ? "whatsapp_clicked" : "phone_clicked", { userId, listingId: id(req), metadata: { from: "listing" } });
    // Création automatique d'un lead pour le propriétaire de l'annonce
    const listing = await listings.get(id(req)).catch(() => null);
    const ownerId = listing?.ownerId || listing?.userId || listing?.owner_id;
    if (ownerId) {
      await crm.create(ownerId, {
        listingId: id(req),
        source,
        status: "NEW",
        notes: `Contact depuis la fiche annonce (${source})`,
      }).catch(() => {});
    }
    res.json(out);
  });

  router.post("/listings/:id/comments", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`comment:${userId}`, 10, 10 * 60_000);
    const comment = await listings.addComment(userId, id(req), clean(req.body?.body, 1000));
    track(req, "comment_created", { userId, listingId: id(req) });
    res.status(201).json(comment);
  });

  router.post("/listings/:id/report", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`report:${userId}`, 10, 60 * 60_000);
    const out = await listings.report(userId, id(req), { reason: clean(req.body?.reason), details: clean(req.body?.details, 1000) });
    track(req, "report_created", { userId, listingId: id(req), metadata: { target: "listing" } });
    res.status(201).json(out);
  });

  // Consentement aux statistiques : disponible même collecte éteinte (le choix est enregistré d'avance).
  router.get("/me/analytics-consent", async (req, res) => res.json(await analytics.getConsent(requireUser(req))));
  router.put("/me/analytics-consent", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`consent:${userId}`, 20, 60 * 60_000);
    res.json(await analytics.setConsent(userId, req.body?.accepted === true));
  });

  // ---------- Profil public de l'annonceur et avis ----------
  // ---------- Annuaire des annonceurs et centre de contrôle Premium ----------
  router.get("/advertisers", async (req, res) => {
    res.setHeader("Cache-Control", "public, max-age=60");
    res.json(await advertiserCenter.directory({ q: clean(req.query.q, 80), kind: clean(req.query.kind, 20), limit: req.query.limit, offset: req.query.offset }));
  });
  router.get("/me/score", async (req, res) => { res.setHeader("Cache-Control", "no-store"); res.json(await advertiserCenter.myScore(requireUser(req))); });
  router.put("/me/identity", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`identity:${userId}`, 10, 60 * 60_000);
    res.json(await accounts.updateName(userId, req.body?.fullName));
  });
  router.get("/me/center/access", async (req, res) => { res.setHeader("Cache-Control", "no-store"); res.json(await advertiserCenter.access(requireUser(req))); });
  router.get("/me/center", async (req, res) => { res.setHeader("Cache-Control", "no-store"); res.json(await advertiserCenter.overview(requireUser(req), { days: Number(req.query.days) || 7 })); });
  router.get("/me/center/standard", async (req, res) => { res.setHeader("Cache-Control", "no-store"); res.json(await advertiserCenter.standardOverview(requireUser(req))); });

  // Demandes pour devenir annonceur
  router.get("/me/featured-requests", async (req, res) => res.json(await featuredRequests.mine(requireUser(req))));
  router.post("/me/featured-requests", async (req, res) => res.status(201).json(await featuredRequests.create(requireUser(req), { listingId: clean(req.body?.listingId, 80), message: clean(req.body?.message, 500) })));
  router.get("/staff/featured-requests", async (req, res) => res.json(await featuredRequests.listForStaff(requireUser(req), { status: req.query?.status === "DONE" ? "DONE" : "PENDING" })));
  router.post("/staff/featured-requests/:id/decision", async (req, res) => res.json(await featuredRequests.decide(requireUser(req), id(req), { action: clean(req.body?.action, 10), note: clean(req.body?.note, 500) })));
  router.get("/me/advertiser-applications", async (req, res) => res.json(await advertiserApplications.listMine(requireUser(req))));
  router.post("/me/advertiser-applications", async (req, res) => res.status(201).json(await advertiserApplications.submit(requireUser(req), req.body ?? {})));
  router.post("/me/advertiser-applications/:id/documents", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`appdoc:${userId}`, 10, 60 * 60_000);
    res.status(201).json(await advertiserApplications.addDocument(userId, id(req), { label: clean(req.body?.label, 30), fileData: String(req.body?.fileData ?? "").slice(0, 1_000_000) }));
  });
  router.post("/me/advertiser-applications/:id/documents/renew", async (req, res) => res.json(await advertiserApplications.renewDocuments(requireUser(req), id(req))));
  router.get("/staff/advertiser-applications/:id/documents/:documentId", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json(await advertiserApplications.viewDocument(requireUser(req), id(req), clean(req.params.documentId, 80)));
  });
  router.get("/staff/advertiser-applications", async (req, res) => res.json(await advertiserApplications.listForStaff(requireUser(req), { status: req.query.status || "PENDING" })));
  router.post("/staff/advertiser-applications/:id/decide", async (req, res) => res.json(await advertiserApplications.decide(requireUser(req), req.params.id, req.body ?? {})));
  router.get("/me/center/map", async (req, res) => { res.setHeader("Cache-Control", "no-store"); res.json(await advertiserCenter.mapPins(requireUser(req))); });
  router.post("/staff/premium/:id", async (req, res) => res.json(await advertiserCenter.grantPremium(requireUser(req), id(req), { days: req.body?.days, reason: clean(req.body?.reason, 300) })));

  router.get("/advertisers/:id", async (req, res) => res.json(await reviews.publicProfile(id(req), req.user?.id ?? null)));
  router.post("/advertisers/:id/follow", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`follow:${userId}`, 30, 60 * 60_000);
    res.json(await reviews.toggleFollow(userId, id(req), { anonymous: typeof req.body?.anonymous === "boolean" ? req.body.anonymous : undefined }));
  });
  router.put("/advertisers/:id/follow", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`follow:${userId}`, 30, 60 * 60_000);
    res.json(await reviews.setFollowAnonymity(userId, id(req), req.body?.anonymous === true));
  });
  // Mes abonnés (visibles par moi seul) et mes abonnements avec le choix « identité visible / anonyme ».
  router.get("/me/followers", async (req, res) => { res.setHeader("Cache-Control", "no-store"); res.json(await reviews.followers(requireUser(req), { limit: req.query.limit, offset: req.query.offset })); });
  router.get("/me/following", async (req, res) => { res.setHeader("Cache-Control", "no-store"); res.json(await reviews.following(requireUser(req))); });
  router.get("/me/follow-settings", async (req, res) => { res.setHeader("Cache-Control", "no-store"); res.json(await reviews.followSettings(requireUser(req))); });
  router.put("/me/follow-settings", async (req, res) => res.json(await reviews.setFollowSettings(requireUser(req), { anonymousByDefault: req.body?.anonymousByDefault === true, applyToExisting: req.body?.applyToExisting === true })));
  // Équipes entre comptes
  router.post("/advertisers/:id/team-request", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`teamreq:${userId}`, 20, 60 * 60_000);
    res.status(201).json(await reviews.sendTeamRequest(userId, id(req), { role: clean(req.body?.role, 80) }));
  });
  router.get("/me/team-requests", async (req, res) => { res.setHeader("Cache-Control", "no-store"); res.json(await reviews.myTeam(requireUser(req))); });
  router.post("/me/team-requests/:id/accept", async (req, res) => res.json(await reviews.respondTeamRequest(requireUser(req), id(req), true)));
  router.post("/me/team-requests/:id/decline", async (req, res) => res.json(await reviews.respondTeamRequest(requireUser(req), id(req), false)));
  router.post("/me/team-requests/:id/remove", async (req, res) => res.json(await reviews.removeTeamLink(requireUser(req), id(req))));
  router.post("/me/publications", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`pub:${userId}`, 20, 60 * 60_000);
    res.status(201).json(await reviews.addPublication(userId, { content: clean(req.body?.content, 2000), imageUrl: clean(req.body?.imageUrl, 500) }));
  });
  router.post("/me/publications/:id/delete", async (req, res) => res.json(await reviews.deletePublication(requireUser(req), id(req))));
  router.post("/me/team", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`team:${userId}`, 20, 60 * 60_000);
    res.status(201).json(await reviews.addTeamMember(userId, { name: clean(req.body?.name, 80), role: clean(req.body?.role, 80) }));
  });
  router.post("/me/team/:id/delete", async (req, res) => res.json(await reviews.deleteTeamMember(requireUser(req), id(req))));
  router.post("/me/services", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`svc:${userId}`, 20, 60 * 60_000);
    res.status(201).json(await reviews.addService(userId, { title: clean(req.body?.title, 120), description: clean(req.body?.description, 500) }));
  });
  router.post("/me/services/:id/delete", async (req, res) => res.json(await reviews.deleteService(requireUser(req), id(req))));
  router.get("/advertisers/:id/reviews", async (req, res) =>
    res.json(await reviews.listReviews(id(req), clean(req.query?.kind, 10), { limit: Number(req.query?.limit), offset: Number(req.query?.offset) })));
  router.post("/advertisers/:id/reviews", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`review:${userId}`, 10, 60 * 60_000);
    res.status(201).json(await reviews.submitReview(userId, id(req), { rating: req.body?.rating, body: req.body?.body }));
  });
  // ---------- Profil public : vitrine du titulaire, contact depuis le profil, signalement en cas de litige ----------
  router.get("/me/public-profile", async (req, res) => res.json(await advertiserProfiles.mine(requireUser(req))));
  router.put("/me/public-profile", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`pubprofile:${userId}`, 30, 60 * 60_000);
    res.json(await advertiserProfiles.update(userId, req.body));
  });
  router.post("/me/public-profile/image", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`pubimage:${userId}`, 10, 60 * 60_000);
    res.status(201).json(await advertiserProfiles.setImage(userId, clean(req.body?.kind, 10), String(req.body?.fileData ?? "").slice(0, 3_000_000)));
  });
  router.post("/me/public-profile/image/delete", async (req, res) => res.json(await advertiserProfiles.removeImage(requireUser(req), clean(req.body?.kind, 10))));
  router.post("/advertisers/:id/contact", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`pcontact:${userId}`, 30, 10 * 60_000);
    const whatsapp = req.body?.kind === "WHATSAPP";
    const source = whatsapp ? "WHATSAPP" : "CALL";
    const out = await advertiserProfiles.recordContact(userId, id(req), source);
    track(req, "contact_clicked", { userId, advertiserId: id(req), metadata: { from: "profile" } });
    track(req, whatsapp ? "whatsapp_clicked" : "phone_clicked", { userId, advertiserId: id(req), metadata: { from: "profile" } });
    // Création automatique d'un lead CRM pour l'annonceur contacté
    await crm.create(id(req), {
      source,
      status: "NEW",
      notes: `Contact depuis le profil public (${source})`,
      contactName: null,
      contactPhone: null,
      contactEmail: null,
    }).catch(() => {});
    res.json(out);
  });
  router.post("/advertisers/:id/report", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`preport:${userId}`, 10, 60 * 60_000);
    const out = await advertiserProfiles.report(userId, id(req), { reason: clean(req.body?.reason, 80), details: clean(req.body?.details, 1000) });
    track(req, "report_created", { userId, advertiserId: id(req), metadata: { target: "profile" } });
    res.status(201).json(out);
  });
  router.post("/advertisers/:id/reviews/delete", async (req, res) => res.json(await reviews.deleteMyReview(requireUser(req), id(req))));
  router.post("/reviews/:id/reply", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`rvreply:${userId}`, 20, 60 * 60_000);
    res.json(await reviews.replyToReview(userId, id(req), req.body?.body));
  });
  router.post("/reviews/:id/reply/delete", async (req, res) => res.json(await reviews.deleteMyReply(requireUser(req), id(req))));
  router.post("/reviews/:id/report", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`rvreport:${userId}`, 10, 60 * 60_000);
    res.status(201).json(await reviews.reportReview(userId, id(req), clean(req.body?.reason)));
  });
  router.post("/staff/reviews/:id/hide", async (req, res) => res.json(await reviews.hide(requireUser(req), id(req))));
  router.post("/staff/reviews/:id/dismiss-reports", async (req, res) => res.json(await reviews.dismissReports(requireUser(req), id(req))));

  // ---------- Alertes hors du site (désactivées par défaut ; choix de la personne) ----------
  router.get("/me/notify-prefs", async (req, res) => res.json(await notifier.getPrefs(requireUser(req))));
  router.put("/me/notify-prefs", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`nprefs:${userId}`, 20, 60 * 60_000);
    await accounts.requireActive(userId);
    res.json(await notifier.setPrefs(userId, {
      email: req.body?.email === true,
      sms: req.body?.sms === true,
      whatsapp: req.body?.whatsapp === true,
    }));
  });

  // ---------- Droits des personnes (Loi n° 2013-015) ----------
  router.get("/me/export", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`export:${userId}`, 3, 60 * 60_000);
    const data = await rights.exportData(userId);
    res.setHeader("Content-Disposition", 'attachment; filename="mes-donnees-ika-so.json"');
    res.setHeader("Cache-Control", "no-store");
    res.json(data);
  });
  router.post("/me/delete", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`delacct:${userId}`, 5, 60 * 60_000);
    const result = await rights.deleteAccount(userId, { password: req.body?.password, confirm: req.body?.confirm });
    clearSession(res);
    res.json(result);
  });

  // ---------- Confiance : pièces, signalement de commentaires ----------
  router.post("/me/proofs", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`proof:${userId}`, 10, 60 * 60_000);
    res.status(201).json(await trust.submitProof(userId, { kind: clean(req.body?.kind), listingId: clean(req.body?.listingId, 80), fileData: String(req.body?.fileData ?? "").slice(0, 1_000_000) }));
  });
  router.get("/me/proofs", async (req, res) => res.json(await trust.myProofs(requireUser(req))));
  router.post("/comments/:id/report", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`creport:${userId}`, 10, 60 * 60_000);
    res.status(201).json(await trust.reportComment(userId, id(req), clean(req.body?.reason)));
  });

  // ---------- Engagement : alertes, messages, visites ----------
  router.get("/me/searches", async (req, res) => res.json(await engagement.listSearches(requireUser(req))));
  router.post("/me/searches", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`search:${userId}`, 20, 60 * 60_000);
    res.status(201).json(await engagement.saveSearch(userId, { label: clean(req.body?.label, 80), filters: req.body?.filters ?? {} }));
  });
  router.get("/me/alert-prefs", async (req, res) => res.json(await engagement.getAlertPrefs(requireUser(req))));
  router.put("/me/alert-prefs", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`alertprefs:${userId}`, 20, 60 * 60_000);
    res.json(await engagement.setAlertPrefs(userId, clean(req.body?.mode, 20)));
  });
  router.post("/me/searches/:id/delete", async (req, res) => res.json(await engagement.deleteSearch(requireUser(req), id(req))));
  router.get("/me/notifications", async (req, res) => res.json(await engagement.notifications(requireUser(req))));
  router.get("/me/unread", async (req, res) => res.json(await engagement.unreadCounts(requireUser(req))));
  router.post("/me/notifications/read", async (req, res) => res.json(await engagement.markRead(requireUser(req), clean(req.body?.id, 80))));
  router.post("/listings/:id/messages", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`msg:${userId}`, 30, 60 * 60_000);
    const sent = await engagement.sendToListing(userId, id(req), clean(req.body?.body, 1000));
    track(req, "contact_request_created", { userId, listingId: id(req) });
    track(req, "message_sent", { userId, listingId: id(req), metadata: { from: "listing" } });
    res.status(201).json(sent);
  });
  router.get("/me/threads", async (req, res) => res.json(await engagement.threads(requireUser(req))));
  router.get("/me/threads/:id", async (req, res) => res.json(await engagement.thread(requireUser(req), id(req))));
  router.post("/me/threads/:id/messages", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`msg:${userId}`, 30, 60 * 60_000);
    const sent = await engagement.reply(userId, id(req), clean(req.body?.body, 1000));
    track(req, "message_sent", { userId, metadata: { from: "thread" } });
    res.status(201).json(sent);
  });
  router.post("/me/threads/:id/block", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`block:${userId}`, 30, 60 * 60_000);
    res.json(await engagement.blockFromThread(userId, id(req)));
  });
  router.post("/me/threads/:id/unblock", async (req, res) => res.json(await engagement.unblockFromThread(requireUser(req), id(req))));
  router.post("/me/threads/:id/report", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`ureport:${userId}`, 10, 60 * 60_000);
    const out = await engagement.reportFromThread(userId, id(req), { reason: clean(req.body?.reason), details: clean(req.body?.details, 1000) });
    track(req, "report_created", { userId, metadata: { target: "user" } });
    res.status(201).json(out);
  });
  router.post("/listings/:id/visit", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`visit:${userId}`, 10, 60 * 60_000);
    const visit = await engagement.requestVisit(userId, id(req), { proposedAt: clean(req.body?.proposedAt, 40), note: clean(req.body?.note, 300) });
    track(req, "visit_requested", { userId, listingId: id(req) });
    res.status(201).json(visit);
  });
  router.get("/me/visits", async (req, res) => res.json(await engagement.visits(requireUser(req))));
  router.post("/me/visits/:id/answer", async (req, res) => res.json(await engagement.answerVisit(requireUser(req), id(req), { accept: req.body?.accept === true, note: clean(req.body?.note, 300) })));
  router.post("/me/visits/:id/cancel", async (req, res) => res.json(await engagement.cancelVisit(requireUser(req), id(req))));

  // ---------- Espace agence : import CSV, tableau de bord ; repères de prix publics ----------
  router.get("/prices", async (req, res) => res.json(await seo.benchmarks(clean(req.query.zone, 120) || null)));
  router.get("/me/agency", async (req, res) => res.json(await imports.agencyStats(requireUser(req))));
  router.post("/me/import", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`import:${userId}`, 10, 60 * 60_000);
    res.json(await imports.importCsv(userId, String(req.body?.csv ?? ""), { dryRun: req.body?.dryRun === true }));
  });
  // Import Excel : modèle à remplir (même droit que l'import), statut du droit, envoi du fichier .xlsx en base64.
  router.get("/me/import/statut", async (req, res) => res.json(await imports.importStatus(requireUser(req))));
  router.get("/me/import/modele.xlsx", async (req, res) => {
    await imports.assertCanImport(requireUser(req));
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="modele-import-ika-so.xlsx"');
    res.setHeader("Cache-Control", "no-store");
    res.send(imports.modeleXlsx());
  });
  router.post("/me/import/xlsx", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`import:${userId}`, 10, 60 * 60_000);
    const buffer = Buffer.from(String(req.body?.file ?? ""), "base64");
    res.json(await imports.importXlsx(userId, buffer, { dryRun: req.body?.dryRun === true }));
  });


  // ---------- Personnalisation Superadmin (E09) ----------
  router.get("/staff/superadmin-settings", async (req, res) => {
    await accounts.requireStaff(requireUser(req), "SUPERADMIN");
    res.setHeader("Cache-Control", "no-store");
    res.json(await superadminSettings.getAll());
  });
  router.get("/staff/superadmin-settings/:key", async (req, res) => {
    await accounts.requireStaff(requireUser(req), "SUPERADMIN");
    const value = await superadminSettings.get(req.params.key);
    if (value == null) return res.status(404).json({ error: "Réglage introuvable" });
    res.json({ key: req.params.key, value });
  });
  router.put("/staff/superadmin-settings/:key", async (req, res) => {
    const staffId = requireUser(req);
    await accounts.requireStaff(staffId, "SUPERADMIN");
    const value = req.body?.value ?? req.body;
    const out = await superadminSettings.set(staffId, req.params.key, value);
    await moderationAudit.log(staffId, {
      action: "superadmin_settings_update",
      targetType: "settings",
      targetId: null,
      details: { key: req.params.key, value },
    }).catch(() => {});
    res.json(out);
  });

  // Lecture publique des réglages d'affichage (pour le frontend)
  router.get("/superadmin-settings/public", async (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=60");
    const all = await superadminSettings.getAll();
    res.json(superadminSettings.publicView(all.main));
  });

  // ---------- Paiements (mise à la une) ----------
  router.get("/offers", async (req, res) => res.json(await payments.offers()));
  router.post("/payments/checkout", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`pay:${userId}`, 10, 10 * 60_000);
    const origin = premiumOrigin(clean(req.body?.from, 40));
    const out = await payments.checkout(userId, { offerCode: clean(req.body?.offerCode, 40), listingId: clean(req.body?.listingId, 80), from: origin });
    if (out?.payment?.kind === "PREMIUM") track(req, "premium_checkout_started", { userId, metadata: { from: origin } });
    res.status(201).json(out);
  });
  // Clic sur une invitation Premium (visiteur connecté ou non). Meilleur effort : ne renvoie jamais d'erreur au navigateur.
  router.post("/premium/click", async (req, res) => {
    limiter.hit(`pclick:${req.user?.id ?? req.ip}`, 60, 10 * 60_000);
    track(req, "premium_cta_clicked", { userId: req.user?.id, metadata: { from: premiumOrigin(clean(req.body?.from, 40)) } });
    res.status(204).end();
  });
  router.get("/me/payments", async (req, res) => res.json(await payments.mine(requireUser(req))));
  router.get("/me/payments/:id/invoice", async (req, res) => res.json(await payments.invoice(requireUser(req), id(req))));
  // Appelé par le fournisseur, pas par un navigateur : pas de session, la signature fait foi.
  router.post("/payments/webhook", async (req, res) => {
    limiter.hit(`hook:${req.ip}`, 120, 60_000);
    const result = await payments.webhook(req.rawBody, req.headers);
    // Notification best-effort après paiement réussi (E08)
    if (result?.status === "succeeded" || result?.paid) {
      const userId = result.userId || result.user_id;
      if (userId && notifier?.notify) {
        const receipt = formatReceiptEmail({
          reference: result.reference || result.id,
          amountXof: result.amountXof || result.amount,
          offerName: result.offerName || result.offer,
          date: result.paidAt || result.createdAt,
          invoiceUrl: result.invoiceUrl,
          userName: result.userName,
        });
        await notifier.notify(userId, {
          title: receipt.subject,
          body: receipt.text,
          html: receipt.html,
          channels: ["email", "sms", "whatsapp"],
        }).catch(() => {});
      }
    }
    res.json(result);
  });
  router.get("/staff/offers", async (req, res) => res.json(await payments.adminOffers(requireUser(req))));
  router.post("/staff/offers/:id", async (req, res) => res.json(await payments.setOffer(requireUser(req), id(req), { priceXof: req.body?.priceXof, active: req.body?.active === true })));
  router.get("/staff/payments/reconcile", async (req, res) => res.json(await payments.reconcile(requireUser(req))));
  router.post("/staff/payments/:id/refund", async (req, res) => res.json(await payments.markRefunded(requireUser(req), id(req), clean(req.body?.reason, 300), { refundRef: clean(req.body?.refundRef, 120) })));

  // ---------- Campagnes sponsorisées (public, sans compte) ----------
  router.get("/campaigns/sponsored", async (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=60");
    res.json(await stats.publicSponsored());
  });
  router.get("/campaigns/sidebar", async (req, res) => {
    res.setHeader("Cache-Control", "public, max-age=60");
    const placement = ["home", "annonces", "both"].includes(req.query.placement) ? req.query.placement : "home";
    res.json(await stats.publicSidebar(placement));
  });

  // ---------- Personnalisation de la page d’accueil ----------
  router.get("/homepage-settings", async (_req, res) => res.json(await homepageSettings.get()));
  router.get("/platform-settings", async (_req, res) => res.json(await stats.publicPlatform()));
  router.put("/staff/homepage-settings", async (req, res) => res.json(await homepageSettings.save(requireUser(req), req.body ?? {})));
  router.post("/staff/homepage-image", async (req, res) => res.status(201).json(await homepageSettings.uploadImage(requireUser(req), req.body?.dataUrl)));

  // Partenaires : liste publique (actifs) ; ajout, modification, masquage, retrait et logo réservés aux administrateurs.
  // ---------- Quartiers et pays : lecture publique, gestion SUPERADMIN (contrôlé dans le service) ----------
  router.get("/places", async (_req, res) => { res.setHeader("Cache-Control", "no-store"); res.json(await places.listPublic()); });
  
  // ---------- Délégations Owner Center (DEC-003) ----------
  router.get("/staff/owner/delegations", async (req, res) => {
    res.json(await services.ownerDelegations.list(requireUser(req)));
  });
  router.post("/staff/owner/delegations", async (req, res) => {
    const { userId, module } = req.body ?? {};
    res.json(await services.ownerDelegations.grant(requireUser(req), userId, module));
  });
  router.post("/staff/owner/delegations/revoke", async (req, res) => {
    const { userId, module } = req.body ?? {};
    res.json(await services.ownerDelegations.revoke(requireUser(req), userId, module));
  });

  // ---------- Permissions nommées accordées à titre individuel (BUG-004) : réservé à `permissions.grant`, contrôlé dans le service ----------
  router.get("/staff/permissions", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json(await services.permissionGrants.list(requireUser(req)));
  });
  router.post("/staff/permissions/grant", async (req, res) => {
    const { userId, permission, reason, days } = req.body ?? {};
    res.json(await services.permissionGrants.grant(requireUser(req), { userId, permission, reason, days }));
  });
  router.post("/staff/permissions/revoke", async (req, res) => {
    const { userId, permission } = req.body ?? {};
    res.json(await services.permissionGrants.revoke(requireUser(req), { userId, permission }));
  });

router.get("/staff/owner/places", async (req, res) => { res.setHeader("Cache-Control", "no-store"); res.json(await places.listForOwner(requireUser(req))); });
  router.post("/staff/owner/zones", async (req, res) => res.status(201).json(await places.createZone(requireUser(req), req.body ?? {})));
  router.post("/staff/owner/zones/bulk", async (req, res) => res.status(201).json(await places.createZones(requireUser(req), { countryCode: clean(req.body?.countryCode, 2), lines: clean(req.body?.lines, 30000) })));
  router.put("/staff/owner/zones/:id", async (req, res) => res.json(await places.updateZone(requireUser(req), id(req), req.body ?? {})));
  router.post("/staff/owner/zones/:id/active", async (req, res) => res.json(await places.setZoneActive(requireUser(req), id(req), req.body?.active)));
  router.post("/staff/owner/zones/:id/delete", async (req, res) => res.json(await places.removeZone(requireUser(req), id(req))));
  router.post("/staff/owner/countries", async (req, res) => res.status(201).json(await places.createCountry(requireUser(req), req.body ?? {})));
  router.put("/staff/owner/countries/:code", async (req, res) => res.json(await places.updateCountry(requireUser(req), clean(req.params.code, 2), req.body ?? {})));
  router.post("/staff/owner/countries/:code/active", async (req, res) => res.json(await places.setCountryActive(requireUser(req), clean(req.params.code, 2), req.body?.active)));
  router.post("/staff/owner/countries/:code/delete", async (req, res) => res.json(await places.removeCountry(requireUser(req), clean(req.params.code, 2))));
  router.get("/partners", async (_req, res) => { res.setHeader("Cache-Control", "no-store"); res.json(await partners.listPublic()); });
  router.get("/staff/partners", async (req, res) => { res.setHeader("Cache-Control", "no-store"); res.json(await partners.listForStaff(requireUser(req))); });
  router.post("/staff/partners", async (req, res) => res.status(201).json(await partners.create(requireUser(req), req.body ?? {})));
  router.put("/staff/partners/:id", async (req, res) => res.json(await partners.update(requireUser(req), id(req), req.body ?? {})));
  router.post("/staff/partners/:id/status", async (req, res) => res.json(await partners.setStatus(requireUser(req), id(req), clean(req.body?.status, 10))));
  router.post("/staff/partners/:id/delete", async (req, res) => res.json(await partners.remove(requireUser(req), id(req))));
  router.post("/staff/partner-logo", async (req, res) => res.status(201).json(await partners.uploadLogo(requireUser(req), req.body?.dataUrl)));

  // ---------- Centre de contrôle (droits vérifiés par chaque service) ----------
  router.get("/staff/queue", async (req, res) => res.json(await moderation.queue(requireUser(req))));
  // ---------- Journal d'audit de modération (E09) ----------
  router.get("/staff/moderation-audit", async (req, res) => {
    await accounts.requireStaff(requireUser(req), "ADMIN");
    res.setHeader("Cache-Control", "no-store");
    res.json(await moderationAudit.list({
      targetType: req.query.targetType || undefined,
      targetId: req.query.targetId || undefined,
      actorId: req.query.actorId || undefined,
      limit: Number(req.query.limit) || 50,
      offset: Number(req.query.offset) || 0,
    }));
  });
  // ---------- Owner Control Center v2 : tableau de bord, journal des mouvements, traçage (SUPERADMIN, contrôlé dans le service) ----------
  const feedQuery = (q) => ({ sources: clean(q.sources, 400), categories: clean(q.categories, 200), q: clean(q.q, 80), actor: clean(q.actor, 80), from: clean(q.from, 40), to: clean(q.to, 40), before: clean(q.before, 40), limit: q.limit });
  router.get("/staff/owner/dashboard", async (req, res) => res.json(await ownerCenter.dashboard(await requireOwnerModule(req, "dashboard"), { days: Number(req.query.days) || 30 })));
  router.get("/staff/owner/activity/catalog", async (req, res) => res.json(await ownerCenter.catalog(requireUser(req))));
  router.get("/staff/owner/activity/summary", async (req, res) => res.json(await ownerCenter.summary(requireUser(req), { days: Number(req.query.days) || 7 })));
  router.get("/staff/owner/activity/trace", async (req, res) => res.json(await ownerCenter.trace(requireUser(req), { type: clean(req.query.type, 10), id: clean(req.query.id, 80), before: clean(req.query.before, 40), limit: req.query.limit })));
  router.get("/staff/owner/activity/export.csv", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`activity-export:${userId}`, 10, 60 * 60_000);
    const csv = await ownerCenter.exportCsv(userId, feedQuery(req.query ?? {}));
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=mouvements-ika-so.csv");
    res.setHeader("Cache-Control", "no-store");
    res.send(csv);
  });
  router.get("/staff/owner/activity", async (req, res) => { res.setHeader("Cache-Control", "no-store"); res.json(await ownerCenter.feed(await requireOwnerModule(req, "activity"), feedQuery(req.query ?? {}))); });
  router.get("/staff/owner/security-log", async (req, res) => res.json(await ownerCenter.securityLogStatus(requireUser(req))));
  router.put("/staff/owner/security-log", async (req, res) => res.json(await ownerCenter.setSecurityLog(requireUser(req), req.body?.enabled === true)));
  router.get("/staff/owner/overview", async (req, res) => res.json(await stats.ownerOverview(await requireOwnerModule(req, "overview"))));
  router.get("/staff/owner/crm", async (req, res) => res.json(await stats.crmOverview(await requireOwnerModule(req, "crm"), { limit: Number(req.query.limit) || 50 })));
  router.get("/staff/owner/report.pdf", async (req, res) => { await requireOwnerModule(req, "report.pdf");
    const pdf = await stats.reportPdf(requireUser(req));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=owner-report.pdf");
    res.send(pdf);
  });
  router.get("/staff/owner/premium-funnel", async (req, res) => res.json(await stats.premiumFunnel(await requireOwnerModule(req, "premium-funnel"), req.query.days)));
  router.get("/staff/owner/regions", async (req, res) => res.json(await stats.regionsOverview(await requireOwnerModule(req, "regions"))));
  router.get("/staff/owner/offers", async (req, res) => res.json(await stats.manageOffers(requireUser(req), "list")));
  router.post("/staff/owner/offers", async (req, res) => res.status(201).json(await stats.manageOffers(requireUser(req), "create", req.body ?? {})));
  router.post("/staff/owner/offers/toggle", async (req, res) => res.json(await stats.manageOffers(requireUser(req), "toggle", req.body ?? {})));
  router.get("/staff/owner/restores", async (req, res) => res.json(await stats.listRestores(requireUser(req))));
  router.post("/staff/owner/restores", async (req, res) => res.status(201).json(await stats.logRestore(requireUser(req), req.body?.backupId, req.body?.note)));
  router.get("/staff/owner/subscriptions", async (req, res) => res.json(await stats.subscriptionsOverview(await requireOwnerModule(req, "subscriptions"))));
  router.post("/staff/owner/ai/write", async (req, res) => res.json(await stats.aiWriteAssist(requireUser(req), req.body ?? {})));
  router.get("/staff/owner/ai", async (req, res) => res.json(await stats.aiAssist(requireUser(req))));
  router.get("/staff/owner/report", async (req, res) => res.json(await stats.fullReport(await requireOwnerModule(req, "report"))));
  router.get("/staff/owner/logo", async (req, res) => res.json(await stats.getLogo(requireUser(req))));
  router.put("/staff/owner/logo", async (req, res) => res.json(await stats.saveLogo(requireUser(req), req.body?.logoUrl)));
  router.get("/staff/owner/newsletters", async (req, res) => res.json(await stats.listNewsletters(requireUser(req))));
  router.post("/staff/owner/newsletters", async (req, res) => res.status(201).json(await stats.createNewsletter(requireUser(req), req.body ?? {})));
  router.post("/staff/owner/newsletters/:id/send", async (req, res) => res.json(await stats.sendNewsletter(requireUser(req), id(req))));
  router.get("/staff/owner/legal", async (req, res) => res.json(await stats.getLegalPages(requireUser(req))));
  router.put("/staff/owner/legal", async (req, res) => res.json(await stats.saveLegalPages(requireUser(req), req.body ?? {})));
  // Ancienne adresse du plan du site (URLs en « #/ », non indexables) : le vrai plan est servi par /sitemap.xml (pages rendues côté serveur).
  router.get("/sitemap.xml", (req, res) => res.redirect(301, "/sitemap.xml"));
  router.get("/staff/owner/seo", async (req, res) => res.json(await stats.getSeoSettings(requireUser(req))));
  router.put("/staff/owner/seo", async (req, res) => res.json(await stats.saveSeoSettings(requireUser(req), req.body ?? {})));
  router.post("/staff/owner/broadcast", async (req, res) => {
    const out = await stats.broadcastNotification(requireUser(req), req.body ?? {});
    res.status(201).json(out);
  });
  router.get("/staff/owner/pipeline", async (req, res) => res.json(await stats.crmPipeline(await requireOwnerModule(req, "pipeline"))));
  router.post("/staff/owner/pipeline", async (req, res) => res.status(201).json(await stats.createPipelineItem(await requireOwnerModule(req, "pipeline"), req.body ?? {})));
  router.post("/staff/owner/pipeline/:id/stage", async (req, res) => res.json(await stats.updatePipelineStage(await requireOwnerModule(req, "pipeline"), id(req), String(req.body?.stage || ""))));
  router.get("/staff/owner/languages", async (req, res) => res.json(await stats.getLanguages(requireUser(req))));
  router.post("/staff/owner/languages/toggle", async (req, res) => res.json(await stats.toggleLanguage(requireUser(req), req.body?.code)));
  router.get("/staff/owner/redirects", async (req, res) => res.json(await stats.getRedirects(requireUser(req))));
  router.post("/staff/owner/redirects", async (req, res) => res.status(201).json(await stats.createRedirect(requireUser(req), req.body ?? {})));
  router.get("/staff/owner/categories", async (req, res) => res.json(await stats.getCategories(requireUser(req))));
  router.post("/staff/owner/categories/toggle", async (req, res) => res.json(await stats.toggleCategory(requireUser(req), req.body?.code)));
  router.get("/staff/owner/trends", async (req, res) => res.json(await stats.trends(await requireOwnerModule(req, "trends"), { days: Number(req.query.days) || 90 })));
  router.get("/staff/owner/charts", async (req, res) => res.json(await stats.chartData(await requireOwnerModule(req, "charts"), { days: Number(req.query.days) || 30 })));
  router.post("/staff/owner/visits/:id/status", async (req, res) => {
    const out = await stats.updateVisitStatus(requireUser(req), id(req), String(req.body?.status || ""));
    res.json(out);
  });
  router.get("/me/newsletter", async (req, res) => res.json(await stats.newsletterOptIn(requireUser(req))));
  router.put("/me/newsletter", async (req, res) => res.json(await stats.setNewsletterOptIn(requireUser(req), req.body?.subscribed === true)));
  router.get("/me/complaints", async (req, res) => res.json(await stats.myComplaints(requireUser(req))));
  router.post("/me/complaints", async (req, res) => res.status(201).json(await stats.createMyComplaint(requireUser(req), req.body ?? {})));
  router.get("/me/complaints/:id", async (req, res) => res.json(await stats.myComplaintDetail(requireUser(req), id(req))));
  router.post("/me/complaints/:id/comment", async (req, res) => res.json(await stats.addMyComment(requireUser(req), id(req), req.body?.content)));
  router.get("/staff/owner/complaints/:id", async (req, res) => res.json(await stats.getComplaint(requireUser(req), id(req))));
  router.post("/staff/owner/complaints/:id/assign", async (req, res) => res.json(await stats.assignComplaint(requireUser(req), id(req), req.body?.assigneeId)));
  router.post("/staff/owner/complaints/:id/comment", async (req, res) => res.json(await stats.addComplaintComment(requireUser(req), id(req), req.body?.content, req.body?.visible === true)));
  router.post("/staff/owner/complaints/:id/close", async (req, res) => res.json(await stats.closeComplaint(requireUser(req), id(req))));
  router.post("/staff/owner/complaints/:id/resolve", async (req, res) => res.json(await stats.resolveComplaint(requireUser(req), id(req), req.body?.resolution)));
  router.get("/staff/owner/incidents", async (req, res) => res.json(await stats.listIncidents(requireUser(req))));
  router.post("/staff/owner/incidents", async (req, res) => res.status(201).json(await stats.createIncident(requireUser(req), req.body ?? {})));
  router.post("/staff/owner/incidents/:id/resolve", async (req, res) => res.json(await stats.resolveIncident(requireUser(req), id(req))));
  router.get("/staff/owner/complaints", async (req, res) => res.json(await stats.complaintsOverview(await requireOwnerModule(req, "complaints"))));
  router.post("/staff/owner/backup/auto", async (req, res) => res.json(await stats.autoBackupNow(requireUser(req))));
  router.post("/staff/owner/incidents/check", async (req, res) => res.json(await stats.autoCheckIncidentsNow(requireUser(req))));
  router.get("/staff/owner/backups", async (req, res) => res.json(await stats.listBackups(requireUser(req))));
  router.post("/staff/owner/backups/:id/verify", async (req, res) => res.json(await stats.verifyBackup(requireUser(req), id(req))));
  router.post("/staff/owner/backups", async (req, res) => res.status(201).json(await stats.logBackup(requireUser(req), req.body?.note)));
  router.get("/staff/owner/settings", async (req, res) => res.json(await stats.getSettings(requireUser(req))));
  router.put("/staff/owner/settings", async (req, res) => res.json(await stats.saveSettings(requireUser(req), req.body ?? {})));
  router.put("/staff/owner/campaigns/:id", async (req, res) => res.json(await stats.updateCampaign(requireUser(req), id(req), req.body ?? {})));
  router.post("/staff/owner/campaigns/:id/status", async (req, res) => res.json(await stats.setCampaignStatus(requireUser(req), id(req), clean(req.body?.status, 12))));
  router.get("/staff/owner/marketing", async (req, res) => res.json(await stats.marketingOverview(await requireOwnerModule(req, "marketing"))));
  router.post("/staff/owner/campaigns", async (req, res) => res.status(201).json(await stats.createCampaign(await requireOwnerModule(req, "campaigns"), req.body ?? {})));
  router.get("/staff/owner/monitoring", async (req, res) => res.json(await stats.advancedMonitoring(await requireOwnerModule(req, "monitoring"))));
  router.get("/staff/owner/health", async (req, res) => res.json(await stats.health(await requireOwnerModule(req, "health"))));
  router.get("/staff/owner/agencies", async (req, res) => res.json(await stats.agenciesOverview(await requireOwnerModule(req, "agencies"))));
  router.get("/staff/owner/listings.csv", async (req, res) => {
    const csv = await stats.listingsReportCsv(requireUser(req));
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=listings-report.csv");
    res.send(csv);
  });
  router.get("/staff/owner/export.csv", async (req, res) => {
    const csv = await stats.ownerExportCsv(requireUser(req));
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=owner-overview.csv");
    res.send(csv);
  });
  router.get("/staff/stats/overview", async (req, res) => {
    const q = req.query ?? {};
    res.json(await stats.overview(requireUser(req), { days: Number(q.days), from: clean(q.from, 10) || undefined, to: clean(q.to, 10) || undefined }));
  });
  router.get("/staff/stats/rankings", async (req, res) => {
    const q = req.query ?? {};
    res.json(await stats.rankings(requireUser(req), { days: Number(q.days), from: clean(q.from, 10) || undefined, to: clean(q.to, 10) || undefined }));
  });
  router.get("/staff/stats/advertisers/:id", async (req, res) => {
    const q = req.query ?? {};
    res.json(await stats.advertiserSheet(requireUser(req), id(req), { days: Number(q.days), from: clean(q.from, 10) || undefined, to: clean(q.to, 10) || undefined }));
  });
  router.get("/staff/stats/compare", async (req, res) => {
    const q = req.query ?? {};
    res.json(await stats.compareAdvertisers(requireUser(req), clean(q.a, 80), clean(q.b, 80), { days: Number(q.days), from: clean(q.from, 10) || undefined, to: clean(q.to, 10) || undefined }));
  });
  router.post("/staff/stats/weights", async (req, res) => {
    const userId = requireUser(req);
    limiter.hit(`weights:${userId}`, 20, 60 * 60_000);
    const b = req.body ?? {};
    res.json(await stats.setWeights(userId, { view: b.view, favorite: b.favorite, contactClick: b.contactClick, reason: clean(b.reason, 300) }));
  });
  router.get("/staff/accounts", async (req, res) => res.json(await moderation.listAccounts(requireUser(req))));

  router.post("/staff/listings/:id/decision", async (req, res) => {
    const staffId = requireUser(req);
    const action = clean(req.body?.action);
    const out = await moderation.decide(staffId, id(req), action, clean(req.body?.reason, 500));
    if (action === "APPROVE") track(req, "listing_published", { userId: staffId, listingId: id(req) });
    await moderationAudit.log(staffId, { action: `listing_${action.toLowerCase()}`, targetType: "listing", targetId: id(req), details: { reason: clean(req.body?.reason, 500) } }).catch(() => {});
    res.json(out);
  });
  router.post("/staff/listings/:id/feature", async (req, res) => {
    const staffId = requireUser(req);
    const on = Boolean(req.body?.on);
    const out = await moderation.setFeatured(staffId, id(req), on);
    await moderationAudit.log(staffId, { action: on ? "listing_feature" : "listing_unfeature", targetType: "listing", targetId: id(req) }).catch(() => {});
    res.json(out);
  });
  router.post("/staff/reports/:id/dismiss", async (req, res) => {
    const staffId = requireUser(req);
    const out = await moderation.dismissReport(staffId, id(req));
    await moderationAudit.log(staffId, { action: "report_dismiss", targetType: "report", targetId: id(req) }).catch(() => {});
    res.json(out);
  });
  router.post("/staff/comments/:id/hide", async (req, res) => {
    const staffId = requireUser(req);
    const out = await moderation.hideComment(staffId, id(req));
    track(req, "comment_deleted", { userId: staffId, listingId: out.listingId });
    await moderationAudit.log(staffId, { action: "comment_hide", targetType: "comment", targetId: id(req), details: { listingId: out.listingId } }).catch(() => {});
    res.json({ ok: true });
  });
  router.post("/staff/accounts/:id/status", async (req, res) => {
    const staffId = requireUser(req);
    const status = clean(req.body?.status);
    const reason = clean(req.body?.reason, 500);
    const out = await moderation.setAccountStatus(staffId, id(req), status, reason);
    await moderationAudit.log(staffId, { action: "account_status", targetType: "user", targetId: id(req), details: { status, reason } }).catch(() => {});
    res.json(out);
  });
  router.post("/staff/accounts/:id/role", async (req, res) => {
    const staffId = requireUser(req);
    const role = clean(req.body?.role);
    const out = await moderation.setStaffRole(staffId, id(req), role);
    await moderationAudit.log(staffId, { action: "account_role", targetType: "user", targetId: id(req), details: { role } }).catch(() => {});
    res.json(out);
  });

  router.get("/staff/trust", async (req, res) => {
    const staffId = requireUser(req);
    const [proofs, alerts, commentReports, userReports, reviewReports] = await Promise.all([trust.proofQueue(staffId), trust.alertsOpen(staffId), trust.commentReportsOpen(staffId), engagement.userReportsOpen(staffId), reviews.reportsOpen(staffId)]);
    res.json({ proofs, alerts, commentReports, userReports, reviewReports });
  });
  router.get("/staff/proofs/:id/file", async (req, res) => res.json(await trust.viewProof(requireUser(req), id(req))));
  router.post("/staff/proofs/:id/decision", async (req, res) => {
    const staffId = requireUser(req);
    const action = clean(req.body?.action);
    const note = clean(req.body?.note, 500);
    const out = await trust.decideProof(staffId, id(req), { action, note, agencyName: clean(req.body?.agencyName, 120) });
    if (action === "ACCEPT") track(req, "verification_completed", { userId: out.ownerId, listingId: out.listingId });
    await moderationAudit.log(staffId, {
      action: action === "ACCEPT" ? "badge_grant" : "badge_reject",
      targetType: out.listingId ? "listing" : "user",
      targetId: out.listingId || out.ownerId || null,
      details: { proofId: id(req), action, note, ownerId: out.ownerId, listingId: out.listingId }
    }).catch(() => {});
    res.json({ ok: true });
  });
  router.post("/staff/badges/revoke", async (req, res) => {
    const staffId = requireUser(req);
    const listingId = clean(req.body?.listingId, 80);
    const userId = clean(req.body?.userId, 80);
    const reason = clean(req.body?.reason, 500);
    const out = await trust.revokeBadge(staffId, { listingId, userId, reason });
    await moderationAudit.log(staffId, {
      action: "badge_revoke",
      targetType: listingId ? "listing" : "user",
      targetId: listingId || userId || null,
      details: { listingId, userId, reason }
    }).catch(() => {});
    res.json(out);
  });
  router.post("/staff/alerts/:id/close", async (req, res) => res.json(await trust.closeAlert(requireUser(req), id(req))));
  router.post("/staff/profiles/:id/images", async (req, res) => res.json(await advertiserProfiles.setImagesHidden(requireUser(req), id(req), req.body?.hidden !== false, clean(req.body?.reason, 300))));
  router.post("/staff/user-reports/:id/dismiss", async (req, res) => res.json(await engagement.dismissUserReports(requireUser(req), id(req))));
  router.post("/staff/comments/:id/dismiss-reports", async (req, res) => res.json(await trust.dismissCommentReports(requireUser(req), id(req))));
  router.get("/staff/blacklist", async (req, res) => res.json(await trust.blacklistList(requireUser(req))));
  router.post("/staff/blacklist", async (req, res) =>
    res.status(201).json(await trust.blacklistAdd(requireUser(req), { kind: clean(req.body?.kind), value: clean(req.body?.value, 254), reason: clean(req.body?.reason, 300) })));
  router.post("/staff/blacklist/:id/remove", async (req, res) => res.json(await trust.blacklistRemove(requireUser(req), id(req))));

  return router;
}
