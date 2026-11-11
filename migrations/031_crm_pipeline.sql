-- Pipeline CRM complet (7 étapes) pour Owner Control.
create table if not exists ika_crm_pipeline (
  id text primary key,
  listing_id text references ika_listings(id) on delete set null,
  contact_name text,
  contact_phone text,
  stage text not null default 'NEW' check (stage in (
    'NEW', 'CONTACTED', 'VISIT_PLANNED', 'VISIT_DONE', 'NEGOTIATION', 'WON', 'LOST'
  )),
  note text,
  assigned_to text references ika_users(id) on delete set null,
  created_by text references ika_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ika_crm_pipeline_stage_idx on ika_crm_pipeline (stage, updated_at desc);
