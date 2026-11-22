// Alertes programmées : recherches enregistrées avec période de surveillance, pause, suspension par l'équipe et historique.
// Le moteur de détection reste celui d'engagement.onPublished (un seul moteur). Réglages = conditions officielles du superadmin.
import { badRequest, conflict, forbidden, notFound } from "../lib/errors.js";
import { cleanSearchFilters } from "../lib/search.js";
import { newId } from "../lib/security.js";

const DAY = 86_400_000;
const isoDay = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d ?? "").slice(0, 10));
const parseDay = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) ? String(v) : null);
const today = () => new Date().toISOString().slice(0, 10);
const days = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);

/** Statut affiché : l'expiration est calculée d'après la date de fin, sans tâche de fond. */
export function effectiveStatus(row, now = today()) {
  if (row.status !== "ACTIVE") return row.status;
  const end = isoDay(row.ends_on), start = isoDay(row.starts_on);
  if (end && end < now) return "EXPIRED";
  if (start && start > now) return "SCHEDULED";
  return "ACTIVE";
}

export function createAlerts({ db, accounts, rules, moderationAudit, engagement }) {
  const log = (searchId, userId, actorId, action, details = null) =>
    db.query("insert into ika_alert_history (id, search_id, user_id, actor_id, action, details) values ($1,$2,$3,$4,$5,$6::jsonb)", [newId("ah"), searchId, userId, actorId, action, details ? JSON.stringify(details) : null]).catch(() => {});
  const view = (r) => ({ id: r.id, label: r.label, filters: r.filters, startsOn: isoDay(r.starts_on) || null, endsOn: isoDay(r.ends_on) || null, status: effectiveStatus(r), reason: r.status === "SUSPENDED" ? r.status_reason || null : null, createdAt: r.created_at, notified: Number(r.notified ?? 0) });

  /** Valide la période : les deux dates ensemble, fin après début, durée maximale fixée par le superadmin. */
  function period(startsOn, endsOn, r) {
    const s = parseDay(startsOn), e = parseDay(endsOn);
    if (!s && !e) return { s: null, e: null };
    if (!s) throw badRequest("Indiquez la date de début.");
    if (!e) throw badRequest("Indiquez la date de fin.");
    if (e < s) throw badRequest("La date de fin doit être après la date de début.");
    if (e < today()) throw badRequest("La date de fin est déjà passée.");
    if (r.alertsMaxDays && days(s, e) + 1 > r.alertsMaxDays) throw badRequest(`Une alerte dure ${r.alertsMaxDays} jours au maximum.`);
    return { s, e };
  }
  async function own(userId, id) {
    const row = (await db.query("select * from ika_saved_searches where id = $1 and user_id = $2", [String(id), userId]))[0];
    if (!row) throw notFound("Alerte introuvable.");
    return row;
  }
  const cols = "s.id, s.label, s.filters, s.starts_on, s.ends_on, s.status, s.status_reason, s.created_at, (select count(*)::int from ika_alert_history h where h.search_id = s.id and h.action = 'NOTIFIED') as notified";

  return {
    async list(userId) {
      const r = await rules.official();
      const rows = (await db.query(`select ${cols} from ika_saved_searches s where s.user_id = $1 order by s.created_at desc`, [userId])).map(view);
      const count = (st) => rows.filter((x) => x.status === st).length;
      const plans = await db.query("select code, label, description, price_xof, days, priority from ika_boost_plans where active order by sort, price_xof");
      return { enabled: r.alertsEnabled, maxAlerts: r.alertsMaxPerUser, maxDays: r.alertsMaxDays, alerts: rows,
        stats: { total: rows.length, active: count("ACTIVE") + count("SCHEDULED"), expired: count("EXPIRED"), paused: count("PAUSED") + count("SUSPENDED"), notified: rows.reduce((n, x) => n + x.notified, 0) },
        boost: { open: false, plans: plans.map((p) => ({ code: p.code, label: p.label, description: p.description, priceXof: p.price_xof, days: p.days, priority: p.priority })) } };
    },

    async create(userId, { label, filters, startsOn, endsOn } = {}) {
      await accounts.requireActive(userId);
      const r = await rules.official();
      if (!r.alertsEnabled) throw forbidden("Les alertes sont temporairement indisponibles.");
      const clean = cleanSearchFilters(filters);
      const { s, e } = period(startsOn, endsOn, r);
      if (!s && !Object.keys(clean).length) throw badRequest("Choisissez au moins un critère ou une période.");
      const n = Number((await db.query("select count(*)::int as n from ika_saved_searches where user_id = $1", [userId]))[0].n);
      if (n >= r.alertsMaxPerUser) throw conflict(`Vous avez déjà ${r.alertsMaxPerUser} alertes. Supprimez-en une.`);
      if (clean.minPrice && clean.maxPrice && clean.minPrice > clean.maxPrice) throw badRequest("Le prix minimum dépasse le prix maximum.");
      const text = String(label ?? "").trim().slice(0, 80) || [clean.category, clean.transaction, clean.zone].filter(Boolean).join(" · ") || "Toutes les annonces";
      const id = newId("ss");
      await db.query("insert into ika_saved_searches (id, user_id, label, filters, starts_on, ends_on) values ($1,$2,$3,$4::jsonb,$5,$6)", [id, userId, text, JSON.stringify(clean), s, e]);
      await log(id, userId, userId, "CREATED", { filters: clean, startsOn: s, endsOn: e });
      return { id, label: text };
    },

    async update(userId, id, { label, filters, startsOn, endsOn } = {}) {
      const row = await own(userId, id);
      if (row.status === "SUSPENDED") throw forbidden("Cette alerte est suspendue par l'équipe.");
      const r = await rules.official();
      const clean = cleanSearchFilters(filters);
      const { s, e } = period(startsOn, endsOn, r);
      if (clean.minPrice && clean.maxPrice && clean.minPrice > clean.maxPrice) throw badRequest("Le prix minimum dépasse le prix maximum.");
      if (!s && !Object.keys(clean).length) throw badRequest("Choisissez au moins un critère ou une période.");
      const text = String(label ?? "").trim().slice(0, 80) || row.label;
      await db.query("update ika_saved_searches set label = $3, filters = $4::jsonb, starts_on = $5, ends_on = $6, updated_at = now() where id = $1 and user_id = $2", [row.id, userId, text, JSON.stringify(clean), s, e]);
      await log(row.id, userId, userId, "UPDATED", { before: { filters: row.filters, startsOn: isoDay(row.starts_on), endsOn: isoDay(row.ends_on) }, after: { filters: clean, startsOn: s, endsOn: e } });
      return { ok: true };
    },

    /** Pause / reprise par la personne. Une alerte suspendue par l'équipe ne peut pas être reprise ici. */
    async setPaused(userId, id, paused) {
      const row = await own(userId, id);
      if (row.status === "SUSPENDED") throw forbidden("Cette alerte est suspendue par l'équipe.");
      if (!paused && effectiveStatus({ ...row, status: "ACTIVE" }) === "EXPIRED") throw badRequest("Cette alerte est expirée : prolongez-la d'abord.");
      await db.query("update ika_saved_searches set status = $3, updated_at = now() where id = $1 and user_id = $2", [row.id, userId, paused ? "PAUSED" : "ACTIVE"]);
      await log(row.id, userId, userId, paused ? "PAUSED" : "RESUMED");
      return { ok: true };
    },

    async extend(userId, id, endsOn) {
      const row = await own(userId, id);
      if (row.status === "SUSPENDED") throw forbidden("Cette alerte est suspendue par l'équipe.");
      const r = await rules.official();
      const start = isoDay(row.starts_on) || today();
      const { e } = period(start, endsOn, r);
      if (isoDay(row.ends_on) && e <= isoDay(row.ends_on)) throw badRequest("La nouvelle date de fin doit être après l'actuelle.");
      await db.query("update ika_saved_searches set ends_on = $3, starts_on = coalesce(starts_on, $4::date), updated_at = now() where id = $1 and user_id = $2", [row.id, userId, e, start]);
      await log(row.id, userId, userId, "EXTENDED", { endsOn: e });
      return { ok: true, endsOn: e };
    },

    async remove(userId, id) {
      const row = await own(userId, id);
      await log(row.id, userId, userId, "DELETED", { label: row.label });
      await db.query("delete from ika_saved_searches where id = $1 and user_id = $2", [row.id, userId]);
      return { ok: true };
    },

    async history(userId, id) {
      await own(userId, id);
      const rows = await db.query("select action, details, created_at from ika_alert_history where search_id = $1 and user_id = $2 and action <> 'NOTIFIED' order by created_at desc limit 50", [String(id), userId]);
      return rows.map((x) => ({ action: x.action, details: x.details, at: x.created_at }));
    },

    // ---------- Équipe ----------
    async listAll(actorId, { status } = {}) {
      await accounts.requireStaff(actorId, "ADMIN");
      const rows = await db.query(`select ${cols}, s.user_id, p.full_name from ika_saved_searches s left join ika_profiles p on p.user_id = s.user_id order by s.created_at desc limit 200`);
      const out = rows.map((x) => ({ ...view(x), userId: x.user_id, userName: x.full_name }));
      return status ? out.filter((x) => x.status === status) : out;
    },

    async suspend(actorId, id, reason, suspend = true) {
      await accounts.requireStaff(actorId, "ADMIN");
      const why = String(reason ?? "").trim();
      if (suspend && why.length < 3) throw badRequest("Indiquez le motif de la suspension.");
      const row = (await db.query("select id, user_id, status from ika_saved_searches where id = $1", [String(id)]))[0];
      if (!row) throw notFound("Alerte introuvable.");
      await db.query("update ika_saved_searches set status = $2, status_reason = $3, updated_at = now() where id = $1", [row.id, suspend ? "SUSPENDED" : "ACTIVE", suspend ? why.slice(0, 300) : null]);
      await log(row.id, row.user_id, actorId, suspend ? "SUSPENDED_BY_STAFF" : "UNSUSPENDED_BY_STAFF", { reason: why });
      await moderationAudit?.log(actorId, { action: suspend ? "ALERT_SUSPEND" : "ALERT_UNSUSPEND", targetType: "alert", targetId: row.id, details: { reason: why, owner: row.user_id } }).catch(() => {});
      return { ok: true };
    },

    async plans(actorId) {
      await accounts.requireStaff(actorId, "ADMIN");
      return (await db.query("select code, label, description, price_xof, days, priority, active, sort from ika_boost_plans order by sort, price_xof")).map((p) => ({ code: p.code, label: p.label, description: p.description, priceXof: p.price_xof, days: p.days, priority: p.priority, active: p.active, sort: p.sort }));
    },

    /** Modification d'une formule : tracée avec l'ancien état. Les achats passés ne dépendront jamais de cette table (instantané copié à l'achat). */
    async savePlan(actorId, code, input = {}) {
      await accounts.requireStaff(actorId, "SUPERADMIN");
      const c = String(code ?? "").toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 20);
      if (!c) throw badRequest("Code de formule invalide.");
      const int = (v, min, max, name) => { const n = Math.floor(Number(v)); if (!Number.isFinite(n) || n < min || n > max) throw badRequest(`${name} invalide.`); return n; };
      const label = String(input.label ?? "").trim().slice(0, 40);
      if (label.length < 2) throw badRequest("Nom de formule trop court.");
      const before = (await db.query("select * from ika_boost_plans where code = $1", [c]))[0] ?? null;
      const price = int(input.priceXof, 0, 10_000_000, "Prix"), d = int(input.days, 1, 365, "Durée"), prio = int(input.priority, 0, 100, "Priorité"), sort = int(input.sort ?? 0, 0, 1000, "Ordre");
      await db.query(`insert into ika_boost_plans (code, label, description, price_xof, days, priority, active, sort, updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,now())
        on conflict (code) do update set label = $2, description = $3, price_xof = $4, days = $5, priority = $6, active = $7, sort = $8, updated_at = now()`,
      [c, label, String(input.description ?? "").slice(0, 300) || null, price, d, prio, input.active === true, sort]);
      await moderationAudit?.log(actorId, { action: "BOOST_PLAN_SAVE", targetType: "boost_plan", targetId: c, details: { before, after: { label, price, days: d, priority: prio, active: input.active === true } } }).catch(() => {});
      return { ok: true };
    },
  };
}
