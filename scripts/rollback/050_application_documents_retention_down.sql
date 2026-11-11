-- Retour arrière de 050 : retire l'échéance de conservation des pièces de demandes annonceur (les pièces elles-mêmes ne sont pas touchées).
drop index if exists ika_adv_app_docs_expire_idx;
alter table ika_advertiser_applications drop column if exists documents_expire_at;
