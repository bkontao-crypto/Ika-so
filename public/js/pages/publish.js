import { DOCUMENTS, PHOTO_PRESETS, ROAD_ACCESS, api, h, mount, toast } from "/js/dom.js";
import { DRAFT_KEY, S, app } from "/js/core/state.js";
import { go, needLogin } from "/js/core/router.js";
import { emptyForm, formToBody, listingForm } from "/js/components/listing-form.js";

export async function publishPage() {
  if (needLogin()) return;
  if (S.meta?.accountStatus === "BANNED") return mount(app, h("p", { class: "notice" }, "Ce compte est bloqué."));
  let f = emptyForm();
  // Copie locale (instantanée, marche hors connexion) + copie serveur (suit le compte d'un appareil à l'autre).
  // La plus récente gagne ; si la copie locale est plus récente, elle est renvoyée au serveur.
  let local = {};
  try { local = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}") ?? {}; } catch { localStorage.removeItem(DRAFT_KEY); }
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
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...snapshot(value), savedAt: new Date().toISOString() })); } catch { /* stockage plein ou refusé */ }
    clearTimeout(timer);
    timer = setTimeout(() => pushRemote(value), 1500);
  };
  if (pushLocal) pushRemote(f);

  mount(app, h("div", null, listingForm({
    f, title: "Publier une annonce", submitLabel: "Publier", withPhone: !S.meta?.phoneVerified, saveDraft,
    onSubmit: async () => {
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
      localStorage.removeItem(DRAFT_KEY);
      toast(r.similarCount ? "Annonce envoyée. Une annonce très proche existe déjà : la modération la comparera." : "Annonce envoyée. Elle attend la modération.");
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
  mount(app, h("div", null,
    item.status === "PUBLISHED" ? h("p", { class: "notice" }, "Une annonce publiée repasse en modération après toute modification.") : null,
    listingForm({
      f, title: "Modifier l'annonce", submitLabel: "Enregistrer", withPhone: false,
      onSubmit: async () => {
        const r = await api(`/listings/${encodeURIComponent(id)}`, { method: "PUT", body: formToBody(f, item.ownerRole, S.user.name) });
        toast(r.status === "PENDING" ? "Modification envoyée à la modération." : "Annonce enregistrée.");
        go("/mes-annonces");
      },
    })));
}

