import { DOCUMENTS, PHOTO_PRESETS, ROAD_ACCESS, api, formatDate, h, mount, toast } from "/js/dom.js";
import { S, app } from "/js/core/state.js";
import { claimLegacyDraft, discardLegacyDraft, draftKey, legacyDraftInfo } from "/js/core/draft.js";
import { go, needLogin } from "/js/core/router.js";
import { emptyForm, formToBody, listingForm } from "/js/components/listing-form.js";
import { field } from "/js/components/ui.js";

const DAY = 86_400_000;
const dayStr = (ms) => new Date(ms).toISOString().slice(0, 10); // jours UTC = jours du Mali (UTC+0)

/**
 * Durée de publication : date de début (facultative) et date de fin (facultative). Le serveur revérifie tout (dates, plafonds, propriétaire).
 * `initial` : dates déjà enregistrées (modification). `lockStart` : le début d'une annonce déjà en ligne ne change plus.
 */
function datesCard(initial = {}, { lockStart = false } = {}) {
  const start = h("input", { class: "input", type: "date", min: dayStr(Date.now()), value: initial.startsAt ? initial.startsAt.slice(0, 10) : "", "aria-label": "Date de début de publication" });
  const end = h("input", { class: "input", type: "date", min: dayStr(Date.now() + DAY), value: initial.expiresAt ? initial.expiresAt.slice(0, 10) : "", "aria-label": "Date de fin de publication" });
  if (lockStart) start.disabled = true;
  const node = h("article", { class: "card pad stack" },
    h("h2", null, "Durée de publication"),
    h("p", { class: "small muted" }, "Facultatif. Une fois validée par la modération, l'annonce devient visible à la date de début et disparaît automatiquement à la date de fin ; vous serez prévenu avant. Sans date de fin, la publication dure 45 jours après la validation."),
    h("div", { class: "grid" },
      field("Visible à partir du", start),
      field("Fin de publication", end)));
  return {
    node,
    /** Dates saisies ; lève une erreur lisible si elles sont incohérentes. `changed` : différent des dates déjà enregistrées. */
    read() {
      const s = start.value, e = end.value;
      if (e && s && e <= s) throw new Error("La date de fin doit être postérieure à la date de début.");
      if (e && e <= dayStr(Date.now())) throw new Error("La date de fin doit être dans le futur.");
      const changed = s !== (initial.startsAt ? initial.startsAt.slice(0, 10) : "") || e !== (initial.expiresAt ? initial.expiresAt.slice(0, 10) : "");
      return { startsAt: s ? `${s}T00:00:00.000Z` : null, expiresAt: e ? `${e}T23:59:59.999Z` : null, any: Boolean(s || e), changed };
    },
  };
}

export async function publishPage() {
  if (needLogin()) return;
  if (S.meta?.accountStatus === "BANNED") return mount(app, h("p", { class: "notice" }, "Ce compte est bloqué."));
  let f = emptyForm();
  // Copie locale (instantanée, marche hors connexion) + copie serveur (suit le compte d'un appareil à l'autre).
  // La plus récente gagne ; si la copie locale est plus récente, elle est renvoyée au serveur.
  // Copie propre à ce compte. L'ancien brouillon sans compte n'est jamais chargé ici : voir legacyNotice().
  const KEY = draftKey(S.user.id);
  let local = {};
  try { local = JSON.parse(localStorage.getItem(KEY) ?? "{}") ?? {}; } catch { localStorage.removeItem(KEY); }
  const { savedAt: localAt, ...localFields } = local;
  let chosen = localFields;
  let pushLocal = false;
  try {
    const remote = await api("/me/draft");
    const remoteTime = remote.updatedAt ? Date.parse(remote.updatedAt) : 0;
    const localTime = localAt ? Date.parse(localAt) : 0;
    if (remote.draft && remoteTime > localTime) chosen = remote.draft;
    else if (Object.keys(localFields).length && localTime > remoteTime) pushLocal = true;
  } catch { /* hors connexion ou erreur : on garde la copie de l'appareil */ }
  Object.assign(f, chosen);
  f.photos = Array.isArray(f.photos) && f.photos.length ? f.photos : [PHOTO_PRESETS[0].url];

  // Enregistrement automatique. Les photos envoyées ne sont pas gardées (trop lourdes) : seules celles du site le sont.
  let timer = null;
  let inflight = Promise.resolve();
  let submitted = false;
  const snapshot = (value) => ({ ...value, photos: value.photos.filter((u) => u.startsWith("/media/")) });
  const pushRemote = (value) => {
    if (submitted) return;
    inflight = inflight.then(() => (submitted ? undefined : api("/me/draft", { method: "PUT", body: snapshot(value) }))).catch(() => undefined);
  };
  const saveDraft = (value) => {
    try { localStorage.setItem(KEY, JSON.stringify({ ...snapshot(value), savedAt: new Date().toISOString() })); } catch { /* stockage plein ou refusé */ }
    clearTimeout(timer);
    timer = setTimeout(() => pushRemote(value), 1500);
  };
  if (pushLocal) pushRemote(f);

  const dates = datesCard();
  mount(app, h("div", null, legacyNotice(KEY), dates.node, listingForm({
    f, title: "Publier une annonce", submitLabel: "Publier", withPhone: !S.meta?.phoneVerified, saveDraft,
    onSubmit: async () => {
      let picked;
      try { picked = dates.read(); } catch (error) { toast(error.message, true); return; } // dates incohérentes : rien n'est envoyé
      // Plus aucun enregistrement automatique après l'envoi : le serveur supprime lui-même le brouillon à la création.
      clearTimeout(timer);
      await inflight;
      let r;
      try {
        r = await api("/listings", { method: "POST", body: formToBody(f, S.meta.displayRole, S.user.name) });
      } catch (error) {
        // Compte pas encore approuvé comme annonceur : on renvoie vers la demande (le brouillon reste gardé).
        if (error?.status === 403 && /annonceur/i.test(error.message)) {
          toast(error.message, true);
          go("/devenir-annonceur");
          return;
        }
        throw error;
      }
      submitted = true;
      localStorage.removeItem(KEY);
      let datesNote = "";
      if (picked.any && r?.id) {
        try { await api(`/listings/${encodeURIComponent(r.id)}/dates`, { method: "PUT", body: { startsAt: picked.startsAt, expiresAt: picked.expiresAt } }); }
        catch (error) { datesNote = ` Les dates n'ont pas pu être enregistrées (${error.message}) : modifiez l'annonce pour les définir.`; }
      }
      toast((r.similarCount ? "Annonce envoyée. Une annonce très proche existe déjà : la modération la comparera." : "Annonce envoyée. Elle attend la modération.") + datesNote);
      go("/mes-annonces");
    },
  })));
}

export async function editPage(id) {
  if (needLogin()) return;
  const item = await api(`/me/listings/${encodeURIComponent(id)}`);
  const f = {
    title: item.title, transaction: item.transactionType, category: item.category, zone: item.neighborhood, country: item.countryCode ?? "ML",
    price: String(item.price), surface: item.surfaceLabel, surfaceM2: item.surfaceM2 == null ? "" : String(item.surfaceM2),
    road: item.roadAccess ?? ROAD_ACCESS[0], bedrooms: item.bedrooms == null ? "" : String(item.bedrooms),
    bathrooms: item.bathrooms == null ? "" : String(item.bathrooms), furnished: item.furnished ? "oui" : "non",
    declaredDocument: item.declaredDocument ?? DOCUMENTS[0], description: item.description, photos: item.photos,
  };
  // Une annonce expirée se remet en ligne par « Prolonger » (30 jours au plus) : ses dates ne se changent pas ici.
  const datable = item.status !== "EXPIRED";
  const current = datable ? await api(`/listings/${encodeURIComponent(id)}/dates`).catch(() => ({})) : {};
  const dates = datable ? datesCard(current, { lockStart: item.status === "PUBLISHED" }) : null;
  mount(app, h("div", null,
    item.status === "PUBLISHED" ? h("p", { class: "notice" }, "Une annonce publiée repasse en modération après toute modification.") : null,
    dates?.node ?? null,
    listingForm({
      f, title: "Modifier l'annonce", submitLabel: "Enregistrer", withPhone: false,
      onSubmit: async () => {
        let picked = null;
        try { picked = dates ? dates.read() : null; } catch (error) { toast(error.message, true); return; }
        // Les dates sont enregistrées avant la modification : tant que l'annonce est en ligne, la règle des 30 jours s'applique à la date de fin.
        if (picked?.changed) await api(`/listings/${encodeURIComponent(id)}/dates`, { method: "PUT", body: { startsAt: picked.startsAt, expiresAt: picked.expiresAt } });
        const r = await api(`/listings/${encodeURIComponent(id)}`, { method: "PUT", body: formToBody(f, item.ownerRole, S.user.name) });
        toast(r.status === "PENDING" ? "Modification envoyée à la modération." : "Annonce enregistrée.");
        go("/mes-annonces");
      },
    })));
}


/** Ancien brouillon sans compte : proposé à l'utilisateur connecté, jamais appliqué ni supprimé sans son clic. */
function legacyNotice(KEY) {
  const legacy = legacyDraftInfo();
  if (!legacy) return null;
  const hasOwn = localStorage.getItem(KEY) != null;
  return h("div", { class: "notice", role: "status" },
    h("p", null, "Un ancien brouillon, non lié à un compte, a été trouvé sur cet appareil",
      legacy.savedAt ? ` (enregistré le ${formatDate(legacy.savedAt)})` : "",
      ". Il n'est ni affiché dans le formulaire ni publié. Récupérez-le uniquement s'il est le vôtre, ou supprimez-le."),
    h("div", { class: "row" },
      hasOwn ? null : h("button", { class: "btn btn-small btn-dark", type: "button", onClick: () => { if (claimLegacyDraft(S.user.id)) location.reload(); else toast("Récupération impossible.", true); } }, "Récupérer dans mon brouillon"),
      h("button", { class: "btn btn-small", type: "button", onClick: () => { if (confirm("Supprimer définitivement cet ancien brouillon ? Cette action est irréversible.")) { discardLegacyDraft(); location.reload(); } } }, "Supprimer définitivement")));
}
