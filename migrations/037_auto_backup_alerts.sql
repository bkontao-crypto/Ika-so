-- Extension pour sauvegardes automatiques et alertes.
alter table ika_backup_log add column if not exists auto boolean not null default false;
alter table ika_incidents add column if not exists auto boolean not null default false;
