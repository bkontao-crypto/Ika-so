-- Diagnostic STRICTEMENT LECTURE SEULE du stockage IKA SO.
-- Prérequis : migrations 001 à 009 déjà appliquées.
-- Usage : psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f scripts/audit-stored-files.sql
-- Ne corrige, ne supprime et ne modifie aucune donnée.

BEGIN TRANSACTION READ ONLY;

WITH
media_refs AS (
  SELECT 'listing_cover'::text AS source, l.id::text AS parent_id,
         substring(l.image_url from '^/api/media/([0-9a-fA-F-]{36})$') AS file_id
  FROM ika_listings l
  WHERE l.image_url ~* '^/api/media/[0-9a-f-]{36}$'
  UNION ALL
  SELECT 'listing_photo', p.listing_id::text,
         substring(p.url from '^/api/media/([0-9a-fA-F-]{36})$')
  FROM ika_listing_photos p
  WHERE p.url ~* '^/api/media/[0-9a-f-]{36}$'
),
checks AS (
  SELECT 'stored_files_total' AS check_name, count(*)::bigint AS issue_count,
         'INFO' AS severity, 'Nombre total de fichiers stockés' AS detail
  FROM stored_files
  UNION ALL
  SELECT 'media_reference_missing_file', count(*), 'CRITICAL',
         'Références /api/media présentes dans les annonces/photos sans ligne correspondante dans stored_files'
  FROM media_refs r LEFT JOIN stored_files f ON f.id::text = r.file_id
  WHERE f.id IS NULL
  UNION ALL
  SELECT 'proof_file_reference_missing', count(*), 'CRITICAL',
         'Justificatifs avec file_id non NULL mais fichier absent (normalement empêché par la clé étrangère)'
  FROM ika_proofs p LEFT JOIN stored_files f ON f.id = p.file_id
  WHERE p.file_id IS NOT NULL AND f.id IS NULL
  UNION ALL
  SELECT 'proof_without_file', count(*), 'WARNING',
         'Justificatifs sans file_id et sans ancien contenu file_data'
  FROM ika_proofs
  WHERE file_id IS NULL AND coalesce(file_data, '') = ''
  UNION ALL
  SELECT 'legacy_proof_data_url', count(*), 'WARNING',
         'Justificatifs contenant encore une ancienne data URL ; migration 009 à examiner'
  FROM ika_proofs
  WHERE file_data LIKE 'data:%;base64,%'
  UNION ALL
  SELECT 'legacy_listing_cover_data_url', count(*), 'WARNING',
         'Photos de couverture encore stockées en data URL'
  FROM ika_listings
  WHERE image_url LIKE 'data:image/%;base64,%'
  UNION ALL
  SELECT 'legacy_listing_photo_data_url', count(*), 'WARNING',
         'Photos de galerie encore stockées en data URL'
  FROM ika_listing_photos
  WHERE url LIKE 'data:image/%;base64,%'
  UNION ALL
  SELECT 'other_legacy_proof_payload', count(*), 'WARNING',
         'Ancien contenu file_data non vide qui ne ressemble pas à une data URL base64'
  FROM ika_proofs
  WHERE coalesce(file_data, '') <> '' AND file_data NOT LIKE 'data:%;base64,%'
  UNION ALL
  SELECT 'stored_file_size_mismatch', count(*), 'CRITICAL',
         'file_size différent de octet_length(content)'
  FROM stored_files
  WHERE file_size <> octet_length(content)
  UNION ALL
  SELECT 'listing_reuses_file_across_listings', count(*), 'WARNING',
         'Fichiers image rattachés à plusieurs annonces distinctes ; vérifier les droits et l''historique'
  FROM (
    SELECT file_id FROM media_refs
    WHERE file_id IS NOT NULL
    GROUP BY file_id HAVING count(DISTINCT parent_id) > 1
  ) reused
  UNION ALL
  SELECT 'proof_file_reused', count(*), 'WARNING',
         'Fichiers justificatifs liés à plusieurs pièces ; vérifier que ce partage est attendu'
  FROM (
    SELECT file_id FROM ika_proofs
    WHERE file_id IS NOT NULL
    GROUP BY file_id HAVING count(*) > 1
  ) reused
  UNION ALL
  SELECT 'listing_references_pdf', count(*), 'CRITICAL',
         'Références d''annonces/photos pointant vers un fichier PDF au lieu d''une image'
  FROM media_refs r JOIN stored_files f ON f.id::text = r.file_id
  WHERE f.mime_type = 'application/pdf'
  UNION ALL
  SELECT 'unreferenced_stored_files', count(*), 'INFO',
         'Fichiers sans référence dans les annonces, galeries ou justificatifs connus ; candidats à examiner, jamais à supprimer automatiquement'
  FROM stored_files f
  WHERE NOT EXISTS (SELECT 1 FROM media_refs r WHERE r.file_id = f.id::text)
    AND NOT EXISTS (SELECT 1 FROM ika_proofs p WHERE p.file_id = f.id)
)
SELECT check_name, issue_count, severity, detail
FROM checks
ORDER BY CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END,
         check_name;

COMMIT;
