// Règles « texte du libellé → nom d'icône ». Module pur (aucune dépendance) : testable sans navigateur.
/** Normalise : minuscules, sans accents, sans glyphes de tête (« + », « ← », « ✓ »…). */
export const norm = (text) => String(text ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/^[^a-z0-9]+/, "").trim();

// Première règle qui correspond. Toutes sont ancrées au début du texte : un titre d'annonce ne reçoit jamais d'icône par hasard.
export const RULES = [
  [/^(retour|precedent)/, "arrow-left"],
  [/^(deposer|nouvelle annonce|publier|etape suivante)/, "plus"],
  [/^(voir plus|ajouter)/, "plus"],
  [/^(accueil|le bien)/, "home"],
  [/^(mes favoris|favoris)/, "heart"],
  [/^(mes annonces|annonces? (disponibles|similaires)|\d+ annonces)/, "list"],
  [/^(messagerie|messages?\b|ecrire|nouveau message)/, "message"],
  [/^(boite|adresse e-mail|e-mail)/, "mail"],
  [/^(alertes?|enregistrer cette recherche|mes recherches)/, "bell"],
  [/^(visites?|demander une visite|date et heure|date)/, "calendar"],
  [/^(mon profil|profil|compte|comptes|nom affiche|role|inscription|creer un compte|votre numero)/, "user"],
  [/^(connexion|mot de passe|code a)/, "lock"],
  [/^(centre de controle|confiance|document controle|titre foncier controle|agence verifiee|liste noire)/, "shield-check"],
  [/^(joindre|importer|envoyer le rccm|ou votre photo|ajouter une illustration)/, "upload"],
  [/^(voir la piece|voir le detail|apercu)/, "eye"],
  [/^(pieces? a controler|controler le fichier|document et photos|document declare|titre\b(?! foncier controle)|description|facture|modele|telecharger le modele)/, "file"],
  [/^(appeler|telephone|tel\b|numero)/, "phone"],
  [/^whatsapp/, "message"],
  [/^(signaler|signalements?|personnes signalees|commentaires? signales?)/, "flag"],
  [/^partager/, "share"],
  [/^imprimer/, "print"],
  [/^telecharger/, "download"],
  [/^(refuser|annuler)/, "x"],
  [/^bloquer/, "ban"],
  [/^(accepter|envoyer|enregistrer|valider|confirmer)/, "check"],
  [/^reinitialiser/, "refresh"],
  [/^(quartier|zone|carte|bamako)/, "pin"],
  [/^(mes paiements|paiements?|offres|noter un remboursement|remboursements?|a verifier)/, "card"],
  [/^(prix|budget|historique du prix|tarif)/, "chart"],
  [/^(superficie|surface)/, "ruler"],
  [/^chambres?/, "bed"],
  [/^salles? de bain/, "bath"],
  [/^meuble/, "sofa"],
  [/^(acces|route)/, "road"],
  [/^(type|transaction|trier)/, "sliders"],
  [/^(recherche|quel bien)/, "search"],
  [/^(motif|commentaires?)/, "message"],
  [/^(espace agence|agence)/, "building"],
  [/^(file\b)/, "clock"],
  [/^(en ligne)/, "globe"],
  [/^(journal)/, "journal"],
  [/^(alertes automatiques)/, "alert"],
  [/^(contacts recus)/, "phone"],
  [/^(a la une)/, "star"],
  [/^(annonces moderees|telephones verifies|documents declares)/, "shield-check"],
  [/^(vente|location)\b/, "tag"],
];

export const iconFor = (text) => {
  const key = norm(text);
  for (const [re, name] of RULES) if (re.test(key)) return name;
  return null;
};
