-- 080 : un signalement peut être « classé sans suite » par l'équipe ; il ne compte plus dans le blocage automatique.
alter table ika_publication_reports add column if not exists dismissed_at timestamptz;
alter table ika_publication_reports add column if not exists dismissed_by text references ika_users (id);
create index if not exists ika_publication_reports_open_idx on ika_publication_reports (publication_id) where dismissed_at is null;
