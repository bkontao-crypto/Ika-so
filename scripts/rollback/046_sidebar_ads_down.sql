-- Retour arrière de la migration 046 (046_sidebar_ads.sql). ATTENTION : supprime la colonne placement. Le type SIDEBAR disparaît : l'opération ÉCHOUE (et rien n'est modifié) s'il reste des campagnes SIDEBAR. Les supprimer avant.
-- À lancer après sauvegarde, du plus récent au plus ancien : psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/rollback/046_sidebar_ads_down.sql
begin;
drop index if exists ika_campaigns_sidebar_idx;
alter table if exists ika_campaigns drop constraint if exists ika_campaigns_kind_check;
alter table if exists ika_campaigns add constraint ika_campaigns_kind_check check (kind in ('BANNER', 'PROMO', 'SPONSORED', 'NEWS'));
alter table if exists ika_campaigns drop column if exists placement;
delete from _migrations where name = '046_sidebar_ads.sql';
commit;
