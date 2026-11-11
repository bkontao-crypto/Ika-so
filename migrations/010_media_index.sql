-- Index pour la lecture des images (/api/media/:id) : readPublicImage filtre sur ces deux colonnes
-- avec une égalité stricte ; sans index, chaque image provoquait un balayage complet de la table.
-- Index de hachage : accepte n'importe quelle longueur de valeur (y compris d'anciennes data URLs
-- non converties, que Btree refuserait au-delà d'environ 2700 octets) et suffit pour une égalité.
CREATE INDEX IF NOT EXISTS ika_listings_image_url_hash_idx ON ika_listings USING hash (image_url);
CREATE INDEX IF NOT EXISTS ika_listing_photos_url_hash_idx ON ika_listing_photos USING hash (url);
