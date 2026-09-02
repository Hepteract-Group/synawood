-- Wave 2E / ADR-0033 / #214 — Voice Studio profiles, events, dub jobs.
-- Renumbered from 0029 in #558 so Wave 2I `0029_broll_plans` stays first.

alter table public.generation_jobs
  drop constraint if exists generation_jobs_role_check;

alter table public.generation_jobs
  add constraint generation_jobs_role_check
  check (role in (
    'image', 'video', 'speech', 'transcribe', 'extract', 'index', 'music',
    'voice_clone', 'voice_synth', 'voice_dub', 'voice_lipsync'
  ));

comment on constraint generation_jobs_role_check on public.generation_jobs is
  'Generator roles plus extract, index, music, and Voice Studio (ADR-0033).';

create table public.voice_profiles (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id) on delete cascade,
  name text not null,
  locale text not null default 'en',
  kind text not null default 'synth'
    check (kind in ('synth', 'clone')),
  provider_voice_id text,
  consent_at timestamptz,
  consent_source text,
  status text not null default 'active'
    check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint voice_profiles_clone_consent_chk
    check (kind <> 'clone' or consent_at is not null)
);

create index voice_profiles_product_idx
  on public.voice_profiles (product_id, status, created_at desc);

comment on table public.voice_profiles is
  'Wave 2E / ADR-0033 — product voice profiles. Clone rows require consent_at.';

create table public.voice_events (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id) on delete cascade,
  project_id uuid references public.studio_projects (id) on delete set null,
  profile_id uuid references public.voice_profiles (id) on delete set null,
  asset_id uuid references public.assets (id) on delete set null,
  kind text not null
    check (kind in ('synth', 'clone', 'dub', 'lipsync', 'fillers')),
  model_id text,
  input_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index voice_events_product_created_idx
  on public.voice_events (product_id, created_at desc);

create index voice_events_project_idx
  on public.voice_events (project_id, created_at desc)
  where project_id is not null;

comment on table public.voice_events is
  'Wave 2E / ADR-0033 — audit trail for Voice Studio actions.';

create table public.dub_jobs (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id) on delete cascade,
  project_id uuid references public.studio_projects (id) on delete set null,
  generation_job_id uuid references public.generation_jobs (id) on delete set null,
  profile_id uuid references public.voice_profiles (id) on delete set null,
  asset_id uuid references public.assets (id) on delete set null,
  source_locale text not null default 'en',
  target_locale text not null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'ready', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index dub_jobs_project_idx
  on public.dub_jobs (project_id, created_at desc)
  where project_id is not null;

comment on table public.dub_jobs is
  'Wave 2E / ADR-0033 — translate+dub audio jobs (not lip-sync).';

alter table public.voice_profiles enable row level security;
alter table public.voice_events enable row level security;
alter table public.dub_jobs enable row level security;

grant select, insert, update, delete on public.voice_profiles to service_role;
grant select, insert, update, delete on public.voice_events to service_role;
grant select, insert, update, delete on public.dub_jobs to service_role;
