-- Plan 03: generation job cost / attempt metadata.
-- generation_jobs and cost_events already exist from 0001; this evolves them.

alter table public.generation_jobs
  add column if not exists attempt_count integer not null default 0,
  add column if not exists units numeric(18, 6),
  add column if not exists brand_refs_unsupported boolean not null default false;

create index if not exists generation_jobs_product_project_status_idx
  on public.generation_jobs (product_id, project_id, status);

create index if not exists generation_jobs_created_at_idx
  on public.generation_jobs (created_at desc);

create index if not exists cost_events_product_created_idx
  on public.cost_events (product_id, created_at desc);

create index if not exists cost_events_project_created_idx
  on public.cost_events (project_id, created_at desc);
