-- Précontrôle STRICTEMENT LECTURE SEULE avant migrations/009_stored_files.sql.
-- À exécuter sur une COPIE jetable/restaurée de la base, avant la migration.
-- Usage : psql "$DATABASE_URL_TEST" -X -v ON_ERROR_STOP=1 -f scripts/preflight-stored-files.sql
-- Aucune conversion binaire et aucune opération de modification de données ou de schéma.

BEGIN TRANSACTION READ ONLY;

WITH
legacy_rows AS (
  SELECT 'proof'::text AS source, p.id::text AS record_id,
         p.file_data AS raw_value, p.file_type AS declared_mime,
         substring(p.file_data from '^data:([^;,]+)') AS url_mime,
         CASE WHEN position(',' IN p.file_data) > 0
              THEN split_part(p.file_data, ',', 2) ELSE NULL END AS payload
  FROM ika_proofs p
  WHERE p.file_data LIKE 'data:%'
  UNION ALL
  SELECT 'listing_cover', l.id::text,
         l.image_url, NULL::text,
         substring(l.image_url from '^data:([^;,]+)'),
         CASE WHEN position(',' IN l.image_url) > 0
              THEN split_part(l.image_url, ',', 2) ELSE NULL END
  FROM ika_listings l
  WHERE l.image_url LIKE 'data:%'
  UNION ALL
  SELECT 'listing_photo', p.id::text,
         p.url, NULL::text,
         substring(p.url from '^data:([^;,]+)'),
         CASE WHEN position(',' IN p.url) > 0
              THEN split_part(p.url, ',', 2) ELSE NULL END
  FROM ika_listing_photos p
  WHERE p.url LIKE 'data:%'
),
classified AS (
  SELECT *,
    CASE
      WHEN raw_value !~ '^data:[A-Za-z0-9.+-]+/[A-Za-z0-9.+-]+;base64,[A-Za-z0-9+/]+={0,2}$' THEN 'malformed_data_url'
      WHEN payload IS NULL OR url_mime IS NULL THEN 'malformed_data_url'
      WHEN url_mime NOT IN ('image/png','image/jpeg','image/webp','application/pdf') THEN 'unsupported_mime'
      WHEN source <> 'proof' AND url_mime = 'application/pdf' THEN 'pdf_used_as_listing_image'
      WHEN source = 'proof' AND declared_mime NOT IN ('image/png','image/jpeg','image/webp','application/pdf') THEN 'unsupported_proof_file_type'
      WHEN source = 'proof' AND lower(declared_mime) <> lower(url_mime) THEN 'proof_mime_mismatch'
      WHEN payload = '' OR payload !~ '^[A-Za-z0-9+/]*={0,2}$' OR length(payload) % 4 <> 0 THEN 'invalid_base64_syntax'
      WHEN (length(payload)::bigint * 3 / 4) - length(regexp_replace(payload, '[^=]', '', 'g')) <= 0 THEN 'empty_decoded_content'
      WHEN (length(payload)::bigint * 3 / 4) - length(regexp_replace(payload, '[^=]', '', 'g')) > 2097152 THEN 'file_over_2_mib'
      ELSE 'candidate_compatible'
    END AS classification
  FROM legacy_rows
),
checks AS (
  SELECT 'legacy_data_url_total', count(*), 'INFO', 'Nombre de data URLs historiques candidates à migrer'
  FROM legacy_rows
  UNION ALL
  SELECT classification, count(*),
         CASE WHEN classification = 'candidate_compatible' THEN 'INFO' ELSE 'BLOCKER' END,
         CASE classification
           WHEN 'malformed_data_url' THEN 'Data URL sans MIME ou séparateur virgule exploitable'
           WHEN 'unsupported_mime' THEN 'Type MIME non accepté par stored_files'
           WHEN 'pdf_used_as_listing_image' THEN 'Un PDF apparaît dans une couverture ou galerie photo'
           WHEN 'unsupported_proof_file_type' THEN 'file_type du justificatif non accepté par stored_files'
           WHEN 'proof_mime_mismatch' THEN 'file_type et MIME de la data URL du justificatif sont différents'
           WHEN 'invalid_base64_syntax' THEN 'Payload base64 vide, mal formé ou de longueur non multiple de 4'
           WHEN 'empty_decoded_content' THEN 'Payload qui produirait un fichier vide'
           WHEN 'file_over_2_mib' THEN 'Fichier dépassant la limite de 2 Mio de stored_files'
           ELSE 'Data URL conforme aux contrôles préliminaires (signature binaire non vérifiée ici)'
         END
  FROM classified
  GROUP BY classification
  UNION ALL
  SELECT 'legacy_non_data_payload', count(*), 'WARNING',
         'Contenus historiques non vides qui ne commencent pas par data: ; migration 009 ne les convertit pas'
  FROM ika_proofs
  WHERE coalesce(file_data, '') <> '' AND file_data NOT LIKE 'data:%'
)
SELECT check_name, issue_count, severity, detail
FROM checks
ORDER BY CASE severity WHEN 'BLOCKER' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END, check_name;

COMMIT;
