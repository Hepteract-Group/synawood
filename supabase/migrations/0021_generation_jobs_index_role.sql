-- Wave 2C / ADR-0032 / #164 — allow generation_jobs.role = index
alter table public.generation_jobs
  drop constraint if exists generation_jobs_role_check;

alter table public.generation_jobs
  add constraint generation_jobs_role_check
  check (role in ('image', 'video', 'speech', 'transcribe', 'extract', 'index'));

comment on constraint generation_jobs_role_check on public.generation_jobs is
  'Generator roles plus extract + asset index (ADR-0032).';

