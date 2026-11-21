
function computeScore(lead) {
  let score = 0;
  // Source (0-20)
  const src = (lead.source || "").toUpperCase();
  if (src === "WHATSAPP" || src === "CALL") score += 20;
  else if (src === "FORM") score += 15;
  else score += 5; // manual or other

  // Complétude (0-20)
  if (lead.contact_phone) score += 10;
  if (lead.contact_email) score += 5;
  if (lead.contact_name) score += 5;

  // Lien annonce (0-15)
  if (lead.listing_id) score += 15;

  // Statut (0-30)
  const st = (lead.status || "NEW").toUpperCase();
  const statusPts = { NEW: 5, CONTACTED: 10, VISIT: 20, NEGOTIATION: 25, WON: 30, LOST: 0 };
  score += statusPts[st] ?? 5;

  // Fraîcheur (0-15) — basée sur created_at
  if (lead.created_at) {
    const ageH = (Date.now() - new Date(lead.created_at).getTime()) / 36e5;
    if (ageH <= 24) score += 15;
    else if (ageH <= 24 * 7) score += 10;
    else if (ageH <= 24 * 30) score += 5;
  }

  // Bonus notes (0-5)
  if (lead.notes && lead.notes.trim()) score += 5;

  return Math.min(100, Math.max(0, score));
}

// Service CRM leads (E07)
export function createCrm({ db }) {
  return {
    /** Synthèse des leads d'un annonceur : total, répartition par statut, taux de conversion (WON / total, en %), leads créés par semaine sur 4 semaines. */
    async stats(advertiserId) {
      const byStatusRows = await db.query(
        "select status, count(*)::int as n from ika_crm_leads where advertiser_id = $1 group by status",
        [advertiserId]
      );
      const byStatus = Object.fromEntries(byStatusRows.map((r) => [r.status, r.n]));
      const total = byStatusRows.reduce((sum, r) => sum + r.n, 0);
      const conversionRate = total ? Math.round(((byStatus.WON ?? 0) / total) * 100) : 0;
      const weeks = await db.query(
        `select to_char(date_trunc('week', created_at), 'YYYY-MM-DD') as week, count(*)::int as count
         from ika_crm_leads
         where advertiser_id = $1 and created_at >= date_trunc('week', now()) - interval '3 weeks'
         group by 1 order by 1`,
        [advertiserId]
      );
      return { total, byStatus, conversionRate, evolution: weeks.map((w) => ({ week: w.week, count: w.count })) };
    },

    async list(advertiserId, { status, limit = 100, offset = 0 } = {}) {
      const params = [advertiserId];
      let where = "advertiser_id = $1";
      if (status) {
        params.push(status);
        where += ` and status = $${params.length}`;
      }
      params.push(Math.min(200, Math.max(1, limit)), Math.max(0, offset));
      const rows = await db.query(
        `select * from ika_crm_leads
         where ${where}
         order by updated_at desc
         limit $${params.length - 1} offset $${params.length}`,
        params
      );
      return rows;
    },

    async create(advertiserId, input) {
      const rows = await db.query(
        `insert into ika_crm_leads
           (advertiser_id, listing_id, contact_name, contact_phone, contact_email, source, status, notes)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         returning *`,
        [
          advertiserId,
          input.listingId || null,
          input.contactName || null,
          input.contactPhone || null,
          input.contactEmail || null,
          input.source || "manual",
          input.status || "NEW",
          input.notes || null,
        ]
      );
      const lead = rows[0];
      if (lead) {
        const score = computeScore(lead);
        await db.query(`update ika_crm_leads set score = $1 where id = $2`, [score, lead.id]);
        lead.score = score;
      }
      return lead;
    },

    async update(advertiserId, id, input) {
      const rows = await db.query(
        `update ika_crm_leads
         set contact_name = coalesce($3, contact_name),
             contact_phone = coalesce($4, contact_phone),
             contact_email = coalesce($5, contact_email),
             status = coalesce($6, status),
             notes = coalesce($7, notes),
             listing_id = coalesce($8, listing_id),
             updated_at = now()
         where id = $1 and advertiser_id = $2
         returning *`,
        [
          id,
          advertiserId,
          input.contactName || null,
          input.contactPhone || null,
          input.contactEmail || null,
          input.status || null,
          input.notes || null,
          input.listingId || null,
        ]
      );
      const lead = rows[0];
      if (lead) {
        const score = computeScore(lead);
        await db.query(`update ika_crm_leads set score = $1 where id = $2`, [score, lead.id]);
        lead.score = score;
      }
      return lead || null;
    },

    async get(advertiserId, id) {
      const rows = await db.query(
        `select * from ika_crm_leads where id = $1 and advertiser_id = $2`,
        [id, advertiserId]
      );
      return rows[0] || null;
    },
  };
}