-- Conservation des pièces jointes aux demandes annonceur : une année après la décision, renouvelable par le titulaire.
-- Additive. Les demandes déjà décidées reçoivent une échéance d'un an à partir de leur date de décision.
alter table ika_advertiser_applications add column if not exists documents_expire_at timestamptz;

update ika_advertiser_applications
   set documents_expire_at = reviewed_at + interval '1 year'
 where documents_expire_at is null and reviewed_at is not null
   and status in ('APPROVED', 'REJECTED', 'CANCELLED') and documents <> '[]'::jsonb;

create index if not exists ika_adv_app_docs_expire_idx on ika_advertiser_applications (documents_expire_at) where documents_expire_at is not null;
