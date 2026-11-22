// Réactions sociales communes aux annonces et aux publications Découvrir : « j'aime » (y compris sur les commentaires), commentaires publics, compteurs.
import { badRequest, notFound } from "../lib/errors.js";
import { newId } from "../lib/security.js";

export const TYPES = ["LISTING", "PUBLICATION", "COMMENT"];
const iso = (v) => (v instanceof Date ? v.toISOString() : String(v ?? ""));

export function createSocial({ db, accounts, notify = null }) {
  const SQL = {
    LISTING: "select id, owner_id as author, title as label from ika_listings where id = $1 and status = 'PUBLISHED' and visibility <> 'HIDDEN'",
    PUBLICATION: "select id, user_id as author, left(content, 60) as label from ika_publications where id = $1 and status = 'PUBLISHED'",
    COMMENT: "select id, user_id as author, left(body, 60) as label from ika_comments where id = $1 and status = 'VISIBLE'",
  };
  async function target(type, id) {
    if (!TYPES.includes(type)) throw badRequest("Cible inconnue.");
    const row = (await db.query(SQL[type], [String(id ?? "").slice(0, 80)]))[0];
    if (!row) throw notFound("Contenu introuvable.");
    return row;
  }
  const column = (type) => (type === "LISTING" ? "listing_id" : "publication_id");

  return {
    /** Compteurs (j'aime, commentaires, partages) et « j'aime » du visiteur pour jusqu'à 60 éléments à la fois. */
    async stats(viewerId, items = []) {
      const out = {};
      const byType = {};
      for (const it of (Array.isArray(items) ? items : []).slice(0, 60)) {
        if (!TYPES.includes(it?.type) || typeof it?.id !== "string") continue;
        (byType[it.type] ??= []).push(it.id.slice(0, 80));
        out[`${it.type}:${it.id}`] = { likes: 0, liked: false, comments: 0, shares: 0 };
      }
      for (const [type, ids] of Object.entries(byType)) {
        const likes = await db.query("select target_id, count(*)::int as n, coalesce(bool_or(user_id = $3), false) as me from ika_likes where target_type = $1 and target_id = any($2::text[]) group by target_id", [type, ids, viewerId ?? null]);
        for (const r of likes) out[`${type}:${r.target_id}`] = { ...out[`${type}:${r.target_id}`], likes: r.n, liked: r.me };
        if (type !== "COMMENT") {
          const comments = await db.query(`select ${column(type)} as id, count(*)::int as n from ika_comments where ${column(type)} = any($1::text[]) and status = 'VISIBLE' group by 1`, [ids]);
          for (const r of comments) out[`${type}:${r.id}`].comments = r.n;
          const shares = await db.query("select shared_id as id, count(*)::int as n from ika_publications where shared_type = $1 and shared_id = any($2::text[]) and status = 'PUBLISHED' group by 1", [type, ids]);
          for (const r of shares) out[`${type}:${r.id}`].shares = r.n;
        }
      }
      return out;
    },

    /** Aime ou retire son « j'aime ». Un compte restreint ne peut pas réagir. */
    async toggleLike(userId, type, id) {
      accounts.assertCanPublish(await accounts.ensureProfile(userId));
      const t = await target(type, id);
      const removed = await db.query("delete from ika_likes where user_id = $1 and target_type = $2 and target_id = $3 returning 1", [userId, type, t.id]);
      let liked = false;
      if (!removed[0]) {
        await db.query("insert into ika_likes (user_id, target_type, target_id) values ($1,$2,$3) on conflict do nothing", [userId, type, t.id]);
        liked = true;
      }
      const n = (await db.query("select count(*)::int as n from ika_likes where target_type = $1 and target_id = $2", [type, t.id]))[0].n;
      return { liked, likes: n };
    },

    async listComments(viewerId, type, id) {
      if (type === "COMMENT" || !TYPES.includes(type)) throw badRequest("Cible inconnue.");
      const col = column(type);
      const rows = await db.query(
        `select c.id, c.user_id, c.author_name, c.body, c.created_at,
                (select count(*)::int from ika_likes l where l.target_type = 'COMMENT' and l.target_id = c.id) as likes,
                coalesce((select true from ika_likes l where l.target_type = 'COMMENT' and l.target_id = c.id and l.user_id = $2), false) as liked
           from ika_comments c where c.${col} = $1 and c.status = 'VISIBLE' order by c.created_at asc limit 100`,
        [String(id ?? "").slice(0, 80), viewerId ?? null]);
      return rows.map((r) => ({ id: r.id, authorId: r.user_id, authorName: r.author_name, body: r.body, createdAt: iso(r.created_at), likes: r.likes, liked: r.liked, mine: Boolean(viewerId) && r.user_id === viewerId }));
    },

    async addComment(userId, type, id, body) {
      if (type === "COMMENT" || !TYPES.includes(type)) throw badRequest("On ne commente qu'une annonce ou une publication.");
      const profile = await accounts.ensureProfile(userId);
      accounts.assertCanPublish(profile);
      const text = String(body ?? "").trim().slice(0, 1000);
      if (text.length < 2) throw badRequest("Le commentaire est trop court.");
      const t = await target(type, id);
      const cid = newId("cm");
      await db.query(`insert into ika_comments (id, ${column(type)}, user_id, author_name, body) values ($1, $2, $3, $4, $5)`, [cid, t.id, userId, profile.full_name || "Visiteur", text]);
      if (notify && t.author && t.author !== userId) {
        await notify(t.author, { kind: "COMMENT", title: `${profile.full_name || "Quelqu'un"} a commenté`, body: text.slice(0, 120), link: type === "LISTING" ? `#/annonce/${t.id}` : `#/decouvrir?p=${t.id}` }).catch(() => undefined);
      }
      return { id: cid };
    },
  };
}
