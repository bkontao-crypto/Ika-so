-- Workflow riche des réclamations.
alter table ika_reports add column if not exists assigned_to text references ika_users(id) on delete set null;
alter table ika_reports add column if not exists resolution text;
alter table ika_reports add column if not exists resolved_at timestamptz;
alter table ika_reports add column if not exists closed_at timestamptz;
-- Étendre le statut
alter table ika_reports drop constraint if exists ika_reports_status_check;
alter table ika_reports add constraint ika_reports_status_check check (status in ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'DISMISSED'));

create table if not exists ika_complaint_comments (
  id text primary key,
  report_id text not null references ika_reports(id) on delete cascade,
  author_id text references ika_users(id) on delete set null,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists ika_complaint_comments_idx on ika_complaint_comments (report_id, created_at);
