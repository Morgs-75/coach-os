create index on public.clients (org_id, created_at desc);
create index on public.activity_events (org_id, client_id, created_at desc);
create index on public.money_events (org_id, event_date desc);
create index on public.inquiries (org_id, status, created_at desc);
create index on public.client_risk (org_id, as_of_date desc, score desc);
create index on public.automation_runs (org_id, fired_at desc);
