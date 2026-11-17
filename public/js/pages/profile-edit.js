// « Mon profil public » a été remplacé par « Mon profil » (#/profil) : photos, présentation, zones, adresse, horaires et boutons Appeler / WhatsApp y sont désormais.
// L'ancienne adresse (#/mon-profil-public) renvoie simplement vers « Mon profil ».
export async function profileEditPage() {
  location.replace("#/profil");
}
