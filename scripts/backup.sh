#!/usr/bin/env bash
# Sauvegarde PostgreSQL chiffrée et copiée hors de Render.
# Exécution depuis un runner de confiance (poste admin / tâche planifiée dédiée), pas dans le service web.
# Variables obligatoires : DATABASE_URL, BACKUP_REMOTE (destination rclone), BACKUP_AGE_RECIPIENT.
# Exemple : BACKUP_REMOTE='r2:ika-so-backups/prod' BACKUP_AGE_RECIPIENT='age1...' DATABASE_URL='postgresql://...' scripts/backup.sh
set -Eeuo pipefail
umask 077

: "${DATABASE_URL:?DATABASE_URL est requis}"
: "${BACKUP_REMOTE:?BACKUP_REMOTE est requis (destination rclone hors du serveur)}"
: "${BACKUP_AGE_RECIPIENT:?BACKUP_AGE_RECIPIENT est requis (clé publique age)}"

for cmd in pg_dump pg_restore age rclone sha256sum; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "Commande requise absente : $cmd" >&2; exit 127; }
done

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
name="ika-so-${stamp}.dump.age"
tmpdir="$(mktemp -d "${TMPDIR:-/tmp}/ika-so-backup.XXXXXX")"
trap 'rm -rf "$tmpdir"' EXIT
chmod 700 "$tmpdir"
raw="$tmpdir/ika-so-${stamp}.dump"
publish="$tmpdir/publish"
mkdir -m 700 "$publish"
encrypted="$publish/$name"

# pg_dump produit un format custom ; aucun fichier non chiffré ne quitte le répertoire temporaire.
pg_dump --format=custom --no-owner --no-privileges --dbname="$DATABASE_URL" --file="$raw"
pg_restore --list "$raw" >/dev/null
age --recipient "$BACKUP_AGE_RECIPIENT" --output "$encrypted" "$raw"
test -s "$encrypted"
(
  cd "$publish"
  sha256sum "$name" > "$name.sha256"
)

# Destination distante obligatoire : ne pas considérer le disque éphémère Render comme une sauvegarde.
rclone mkdir "$BACKUP_REMOTE"
rclone copyto "$encrypted" "$BACKUP_REMOTE/$name"
rclone copyto "$encrypted.sha256" "$BACKUP_REMOTE/$name.sha256"
# Vérification distante par comparaison du contenu téléchargé, pas seulement du nom ou de la taille.
rclone check "$publish" "$BACKUP_REMOTE" --one-way --download

echo "SAUVEGARDE CHIFFRÉE ET VÉRIFIÉE : $BACKUP_REMOTE/$name"
echo "Empreinte : $BACKUP_REMOTE/$name.sha256"
