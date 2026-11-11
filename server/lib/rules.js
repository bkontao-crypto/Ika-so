export const CATEGORIES = ["Terrain", "Maison", "Appartement", "Studio", "Local commercial", "Bureau"];
/** Familles de biens : le terrain, les logements (chambres, sanitaires, meublé) et l'immobilier professionnel. */
export const LAND_CATEGORIES = ["Terrain"];
export const DWELLING_CATEGORIES = ["Maison", "Appartement", "Studio"];
export const PROFESSIONAL_CATEGORIES = ["Local commercial", "Bureau"];
export const isLand = (category) => LAND_CATEGORIES.includes(category);
export const isDwelling = (category) => DWELLING_CATEGORIES.includes(category);
export const isProfessional = (category) => PROFESSIONAL_CATEGORIES.includes(category);
export const TRANSACTIONS = ["Vente", "Location"];
export const DOCUMENTS = [
    "Titre Foncier",
    "Lettre d'attribution",
    "Permis d'occuper",
    "Bail",
    "En cours de régularisation",
];
export const ROAD_ACCESS = ["Goudronné", "Piste", "Enclavé"];
export const OWNER_ROLES = [
    "Propriétaire direct",
    "Agence immobilière",
    "Démarcheur mandaté",
];
export const REPORT_REASONS = [
    "Bien déjà vendu ou loué",
    "Prix ou superficie inexacte",
    "Suspicion de fraude ou fausse annonce",
    "Doublon",
    "Autre raison",
];
export const STAFF_ROLES = ["MODERATOR", "ADMIN", "SUPERADMIN"];
export const LISTING_STATUSES = [
    "DRAFT",
    "PENDING",
    "PUBLISHED",
    "REJECTED",
    "EXPIRED",
    "SOLD",
    "RENTED",
    "ARCHIVED",
];
export const DOCUMENT_DISCLAIMER = "Document déclaré par l'annonceur, sans garantie automatique. Ika So ne certifie pas le titre.";
export function isStaff(role) {
    return STAFF_ROLES.includes(role);
}
const STAFF_RANK = { USER: 0, MODERATOR: 1, ADMIN: 2, SUPERADMIN: 3 };
export function staffRank(role) {
    return STAFF_RANK[role] ?? 0;
}
export function hasStaffRank(role, minimum) {
    return staffRank(role) >= staffRank(minimum);
}
/** Un modérateur restreint ; seul un administrateur bannit ; jamais un rang égal ou supérieur. */
export function assertCanSanction(actorRole, targetRole, status) {
    if (!isStaff(actorRole))
        throw new Error("Réservé à la modération.");
    if (status === "BANNED" && !hasStaffRank(actorRole, "ADMIN")) {
        throw new Error("Seul un administrateur peut bloquer un compte.");
    }
    if (staffRank(targetRole) >= staffRank(actorRole)) {
        throw new Error("Vous ne pouvez pas sanctionner un compte de rang égal ou supérieur.");
    }
}
export function assertStaffRoleChange(actorRole, newRole) {
    if (actorRole !== "SUPERADMIN")
        throw new Error("Réservé au super administrateur.");
    if (!["USER", ...STAFF_ROLES].includes(newRole))
        throw new Error("Rôle inconnu.");
}
export const OTP_LENGTH = 6;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_REQUESTS_PER_HOUR = 5;
export const OTP_RESEND_SECONDS = 30;
/** Limite les demandes de code (par compte ou par numéro) : 1 toutes les 30 s, 5 par heure. */
export function otpRequestAllowed(recentCount, lastRequestMs, nowMs) {
    if (recentCount >= OTP_MAX_REQUESTS_PER_HOUR) {
        return { ok: false, message: "Trop de demandes de code. Réessayez dans une heure." };
    }
    if (lastRequestMs != null && nowMs - lastRequestMs < OTP_RESEND_SECONDS * 1000) {
        return { ok: false, message: `Patientez ${OTP_RESEND_SECONDS} secondes avant de redemander un code.` };
    }
    return { ok: true, message: "" };
}
/** Seul un code réellement envoyé par SMS donne le badge « numéro vérifié ». */
export function isSmsVerified(channel) {
    return channel === "SMS";
}
export function assertFeaturedCap(otherFeaturedCount, max) {
    if (otherFeaturedCount >= max) {
        throw new Error(`Maximum de ${max} annonces à la une atteint. Retirez-en une d'abord.`);
    }
}
export function normalizePhone(value) {
    if (typeof value !== "string")
        return null;
    let digits = value.replace(/[^\d+]/g, "");
    if (digits.startsWith("00"))
        digits = `+${digits.slice(2)}`;
    if (!digits.startsWith("+")) {
        if (/^\d{8}$/.test(digits))
            digits = `+223${digits}`;
        else if (/^223\d{8}$/.test(digits))
            digits = `+${digits}`;
        else
            return null;
    }
    if (!/^\+[1-9]\d{7,14}$/.test(digits))
        return null;
    if (digits.startsWith("+223") && !/^\+223\d{8}$/.test(digits))
        return null;
    return digits;
}
export function pricePerSquareMeter(price, surfaceM2, category) {
    if (category !== "Terrain" || !surfaceM2 || surfaceM2 <= 0)
        return null;
    return Math.round(price / surfaceM2);
}
export function validateListing(input) {
    const errors = [];
    if (input.title.trim().length < 5 || input.title.trim().length > 140) {
        errors.push("Le titre doit contenir entre 5 et 140 caractères.");
    }
    if (input.description.trim().length < 20 || input.description.trim().length > 3000) {
        errors.push("La description doit contenir entre 20 et 3 000 caractères.");
    }
    if (!CATEGORIES.includes(input.category)) {
        errors.push("Type de bien invalide.");
    }
    if (!TRANSACTIONS.includes(input.transactionType)) {
        errors.push("Type de transaction invalide.");
    }
    if (!Number.isInteger(input.price) || input.price <= 0 || input.price > 1e13) {
        errors.push("Le prix doit être un nombre entier de FCFA, supérieur à zéro.");
    }
    if (input.surfaceM2 != null &&
        (!Number.isInteger(input.surfaceM2) || input.surfaceM2 <= 0 || input.surfaceM2 > 1_000_000_000)) {
        errors.push("La superficie en m² doit être un nombre entier valide.");
    }
    if (input.neighborhood.trim().length < 2) {
        errors.push("Le quartier ou le repère est obligatoire.");
    }
    if (input.surfaceLabel.trim().length < 2) {
        errors.push("La superficie est obligatoire.");
    }
    if (input.declaredDocument &&
        !DOCUMENTS.includes(input.declaredDocument)) {
        errors.push("Document déclaré inconnu.");
    }
    if (input.category === "Terrain") {
        if (!input.roadAccess || !ROAD_ACCESS.includes(input.roadAccess)) {
            errors.push("L'accès routier est obligatoire pour un terrain.");
        }
        if (!input.declaredDocument) {
            errors.push("Le document déclaré est obligatoire pour un terrain.");
        }
        if (!input.surfaceM2 || input.surfaceM2 <= 0) {
            errors.push("La superficie en m² est obligatoire pour un terrain.");
        }
    }
    else if (isProfessional(input.category)) {
        // Local commercial / bureau : pas de chambres ni de salles de bain ; la superficie en m² et le document (bail, titre…) sont obligatoires.
        if (!input.surfaceM2 || input.surfaceM2 <= 0) {
            errors.push("La superficie en m² est obligatoire pour un local commercial ou un bureau.");
        }
        if (!input.declaredDocument) {
            errors.push("Le document ou le bail doit être précisé pour un local commercial ou un bureau.");
        }
    }
    else if (isDwelling(input.category)) {
        if (input.bedrooms == null || !Number.isInteger(input.bedrooms) || input.bedrooms < 0 || input.bedrooms > 40) {
            errors.push("Le nombre de chambres est obligatoire pour un logement.");
        }
        if (input.bathrooms == null || !Number.isInteger(input.bathrooms) || input.bathrooms < 0 || input.bathrooms > 20) {
            errors.push("Le nombre de salles de bain est obligatoire pour un logement.");
        }
        if (input.furnished == null) {
            errors.push("Précisez si le logement est meublé.");
        }
        if (!input.declaredDocument) {
            errors.push("Le document ou le bail doit être précisé pour un logement.");
        }
    }
    return errors;
}
export function statusAfterOwnerEdit(current, moderationRequired = true) {
    if (current === "PUBLISHED" && moderationRequired)
        return "PENDING";
    if (current === "REJECTED" || current === "EXPIRED")
        return "PENDING";
    return current;
}
export function assertDecision(action, reason) {
    if (action !== "APPROVE" && action !== "REJECT") {
        throw new Error("Décision inconnue.");
    }
    if (action === "REJECT" && reason.trim().length < 3) {
        throw new Error("Le motif de refus est obligatoire.");
    }
}
export function assertSanction(status, reason) {
    if (!["ACTIVE", "RESTRICTED", "BANNED"].includes(status)) {
        throw new Error("Statut de compte inconnu.");
    }
    if (status !== "ACTIVE" && reason.trim().length < 3) {
        throw new Error("Toute sanction exige un motif.");
    }
}
export function canBeFeatured(status, visibility) {
    return status === "PUBLISHED" && visibility === "NORMAL";
}
export function assertImageUrl(url) {
    if (/^\/media\/[a-z0-9][a-z0-9._-]{0,120}\.(?:jpe?g|png|webp)$/i.test(url) || /^\/api\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(url))
        return url;
    if (/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(url) && url.length <= 2_800_000) {
        return url;
    }
    throw new Error("Photo refusée. Choisissez une image JPEG, PNG ou WebP de 2 Mo au maximum.");
}
export function assertPhotoList(urls) {
    const clean = urls.map((url) => String(url ?? "").trim()).filter(Boolean);
    if (clean.length < 1 || clean.length > 5) {
        throw new Error("Une annonce a entre 1 et 5 photos.");
    }
    return clean.map((url) => assertImageUrl(url));
}
export function formatPrice(amount, transaction) {
    const base = `${new Intl.NumberFormat("fr-FR").format(amount)} FCFA`;
    return transaction === "Location" ? `${base} / mois` : base;
}
