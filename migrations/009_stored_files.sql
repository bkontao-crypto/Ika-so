-- Stockage durable des photos, logos et pièces jointes dans PostgreSQL/Neon.
CREATE TABLE IF NOT EXISTS stored_files (id UUID PRIMARY KEY, storage_key TEXT NOT NULL UNIQUE, mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png','image/jpeg','image/webp','application/pdf')), file_size INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 2097152), content BYTEA NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS stored_files_created_at_idx ON stored_files(created_at);

-- Les justificatifs restent privés : seule la relation avec ika_proofs permet de les retrouver.
-- Les valeurs d'origine (data URLs) sont recopiées dans des colonnes legacy_* avant d'être remplacées :
-- le retour arrière et la comparaison avant/après restent possibles sans restaurer une sauvegarde.
-- Une fois la migration validée en réel, ces colonnes pourront être supprimées par une migration ultérieure.
ALTER TABLE ika_proofs
  ADD COLUMN IF NOT EXISTS file_id UUID REFERENCES stored_files(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ika_proofs_file_id_idx ON ika_proofs(file_id);


ALTER TABLE ika_proofs ADD COLUMN IF NOT EXISTS legacy_file_data TEXT;
ALTER TABLE ika_listings ADD COLUMN IF NOT EXISTS legacy_image_url TEXT;
ALTER TABLE ika_listing_photos ADD COLUMN IF NOT EXISTS legacy_url TEXT;

-- Décodage base64 TOLÉRANT : une valeur mal formée donne NULL (la ligne est simplement laissée telle quelle)
-- au lieu de faire échouer toute la transaction, donc le démarrage du serveur.
-- Fonction temporaire : elle disparaît à la fin de la session, rien ne reste dans le schéma.
CREATE FUNCTION pg_temp.safe_b64(payload text) RETURNS bytea AS $$
BEGIN
  IF payload IS NULL OR payload = '' OR length(payload) % 4 <> 0 OR payload !~ '^[A-Za-z0-9+/]+={0,2}$' THEN
    RETURN NULL;
  END IF;
  RETURN decode(payload, 'base64');
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Migration des anciennes pièces justificatives.
-- La longueur est contrôlée AVANT le décodage ; les lignes illisibles sont ignorées et restent intactes.
WITH candidates AS (
  SELECT id, file_type AS mime_type, split_part(file_data, ',', 2) AS payload
  FROM ika_proofs
  WHERE file_id IS NULL
    AND file_data LIKE 'data:%;base64,%'
    AND file_type IN ('image/png','image/jpeg','image/webp','application/pdf')
), legacy AS (
  SELECT id, mime_type, pg_temp.safe_b64(payload) AS content
  FROM candidates
  WHERE length(payload) <= 2796208
), inserted AS (
  INSERT INTO stored_files (id, storage_key, mime_type, file_size, content)
  SELECT gen_random_uuid(), 'legacy-proof-' || id, mime_type, octet_length(content), content
  FROM legacy
  WHERE content IS NOT NULL AND octet_length(content) BETWEEN 1 AND 2097152
  ON CONFLICT (storage_key) DO NOTHING
  RETURNING id, storage_key
)
UPDATE ika_proofs p
SET file_id = f.id, legacy_file_data = p.file_data, file_data = ''
FROM inserted f
WHERE f.storage_key = 'legacy-proof-' || p.id;

-- Migration des anciennes photos de couverture.
WITH candidates AS (
  SELECT id, lower(split_part(split_part(image_url, ';', 1), ':', 2)) AS mime_type,
         split_part(image_url, ',', 2) AS payload
  FROM ika_listings
  WHERE image_url LIKE 'data:image/%;base64,%'
), legacy AS (
  SELECT id, mime_type, pg_temp.safe_b64(payload) AS content
  FROM candidates
  WHERE mime_type IN ('image/png','image/jpeg','image/webp') AND length(payload) <= 2796208
), inserted AS (
  INSERT INTO stored_files (id, storage_key, mime_type, file_size, content)
  SELECT gen_random_uuid(), 'legacy-listing-cover-' || id, mime_type, octet_length(content), content
  FROM legacy
  WHERE content IS NOT NULL AND octet_length(content) BETWEEN 1 AND 2097152
  ON CONFLICT (storage_key) DO NOTHING
  RETURNING id, storage_key
)
UPDATE ika_listings l
SET legacy_image_url = l.image_url, image_url = '/api/media/' || f.id::text
FROM inserted f
WHERE f.storage_key = 'legacy-listing-cover-' || l.id;

-- Migration des autres photos de chaque annonce.
WITH candidates AS (
  SELECT id, lower(split_part(split_part(url, ';', 1), ':', 2)) AS mime_type,
         split_part(url, ',', 2) AS payload
  FROM ika_listing_photos
  WHERE url LIKE 'data:image/%;base64,%'
), legacy AS (
  SELECT id, mime_type, pg_temp.safe_b64(payload) AS content
  FROM candidates
  WHERE mime_type IN ('image/png','image/jpeg','image/webp') AND length(payload) <= 2796208
), inserted AS (
  INSERT INTO stored_files (id, storage_key, mime_type, file_size, content)
  SELECT gen_random_uuid(), 'legacy-listing-photo-' || id, mime_type, octet_length(content), content
  FROM legacy
  WHERE content IS NOT NULL AND octet_length(content) BETWEEN 1 AND 2097152
  ON CONFLICT (storage_key) DO NOTHING
  RETURNING id, storage_key
)
UPDATE ika_listing_photos p
SET legacy_url = p.url, url = '/api/media/' || f.id::text
FROM inserted f
WHERE f.storage_key = 'legacy-listing-photo-' || p.id;
