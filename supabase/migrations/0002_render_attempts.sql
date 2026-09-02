-- Additive: track local/cloud render attempts for retry visibility.
alter table public.render_jobs
  add column if not exists attempt_count integer not null default 0;

comment on column public.render_jobs.attempt_count is
  'How many times a worker has attempted this job (Plan 01 local export).';
