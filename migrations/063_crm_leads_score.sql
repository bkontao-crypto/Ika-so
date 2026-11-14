-- Migration additive — Score des leads CRM (E07)
alter table ika_crm_leads
  add column if not exists score integer not null default 0;

create index if not exists ika_crm_leads_score_idx
  on ika_crm_leads (advertiser_id, score desc);
