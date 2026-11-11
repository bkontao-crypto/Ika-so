#!/usr/bin/env bash
# Teste une restauration dans une NOUVELLE base temporaire dédiée aux tests.
# N'accepte jamais DATABASE_URL comme cible implicite et ne compare jamais au serveur de production.
# Variables obligatoires : RESTORE_TEST_ADMIN_URL, BACKUP_AGE_IDENTITY.
# Usage : scripts/restore-check.sh /chemin/ika-so-....dump.age
set -Eeuo pipefail
umask 077

: "${RESTORE_TEST_ADMIN_URL:?RESTORE_TEST_ADMIN_URL est requis (connexion PostgreSQL de test, jamais production)}"
: "${BACKUP_AGE_IDENTITY:?BACKUP_AGE_IDENTITY est requis (chemin de la clé privée age)}"
: "${RESTORE_TEST_ALLOW_CREATE_DATABASE:?Confirmer le serveur jetable avec RESTORE_TEST_ALLOW_CREATE_DATABASE=YES_I_UNDERSTAND_THIS_IS_A_DISPOSABLE_TEST_SERVER}"
if [ "$RESTORE_TEST_ALLOW_CREATE_DATABASE" != "YES_I_UNDERSTAND_THIS_IS_A_DISPOSABLE_TEST_SERVER" ]; then
  echo "Refus : confirmation explicite du serveur PostgreSQL jetable incorrecte." >&2
  exit 1
fi
archive="${1:?fichier de sauvegarde .dump.age requis}"

for cmd in psql pg_restore age sha256sum python3; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "Commande requise absente : $cmd" >&2; exit 127; }
done
test -f "$archive" || { echo "Archive introuvable : $archive" >&2; exit 1; }
test -f "$archive.sha256" || { echo "Fichier de contrôle SHA-256 absent : $archive.sha256" >&2; exit 1; }
test -r "$BACKUP_AGE_IDENTITY" || { echo "Clé privée age illisible." >&2; exit 1; }

archive_dir="$(cd "$(dirname "$archive")" && pwd)"
archive_base="$(basename "$archive")"
(
  cd "$archive_dir"
  sha256sum --check "$archive_base.sha256"
)

tmpdir="$(mktemp -d "${TMPDIR:-/tmp}/ika-so-restore-check.XXXXXX")"
chmod 700 "$tmpdir"
tmpdb="ika_restore_test_$(date -u +%Y%m%d%H%M%S)_$$"
target_created=0
cleanup() {
  if [ "$target_created" -eq 1 ]; then
    psql "$RESTORE_TEST_ADMIN_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$tmpdb\"" >/dev/null || echo "ATTENTION : suppression de la base temporaire $tmpdb à effectuer manuellement." >&2
  fi
  rm -rf "$tmpdir"
}
trap cleanup EXIT

raw="$tmpdir/restore.dump"
age --decrypt --identity "$BACKUP_AGE_IDENTITY" --output "$raw" "$archive"
pg_restore --list "$raw" >/dev/null

# Le nom est généré localement et limité à [a-z0-9_]. L'URL cible conserve les paramètres TLS.
target_url="$(python3 - "$RESTORE_TEST_ADMIN_URL" "$tmpdb" <<'PY'
import sys
from urllib.parse import urlsplit, urlunsplit
source, database = sys.argv[1:]
parts = urlsplit(source)
if parts.scheme not in ("postgres", "postgresql") or not parts.netloc:
    raise SystemExit("RESTORE_TEST_ADMIN_URL doit être une URL PostgreSQL postgres:// ou postgresql://")
print(urlunsplit((parts.scheme, parts.netloc, "/" + database, parts.query, parts.fragment)))
PY
)"

psql "$RESTORE_TEST_ADMIN_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$tmpdb\""
target_created=1
pg_restore --exit-on-error --no-owner --no-privileges --dbname="$target_url" "$raw"

# Contrôle indépendant minimal : connexion, présence de tables applicatives et lecture de leurs métadonnées.
table_count="$(psql "$target_url" -At -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'")"
case "$table_count" in
  ''|*[!0-9]*) echo "Nombre de tables illisible après restauration : $table_count" >&2; exit 1 ;;
esac
if [ "$table_count" -lt 1 ]; then
  echo "Restauration incomplète : aucune table applicative trouvée." >&2
  exit 1
fi
psql "$target_url" -v ON_ERROR_STOP=1 -c "SELECT current_database() AS base_de_test, count(*) AS tables_applicatives FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
echo "RESTAURATION DE TEST RÉUSSIE dans $tmpdb (base temporaire supprimée à la sortie)."
