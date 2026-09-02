-- Wave 2E / ADR-0041 / #192 — music generations + license fields; role=music on jobs.

alter table public.generation_jobs
  drop constraint if exists generation_jobs_role_check;

alter table public.generation_jobs
  add constraint generation_jobs_role_check
  check (role in ('image', 'video', 'speech', 'transcribe', 'extract', 'index', 'music'));

comment on constraint generation_jobs_role_check on public.generation_jobs is
  'Generator roles plus extract, asset index, and music beds (ADR-0041).';

create table public.music_generations (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id),
  project_id uuid references public.studio_projects (id) on delete set null,
  generation_job_id uuid references public.generation_jobs (id) on delete set null,
  asset_id uuid references public.assets (id) on delete set null,
  prompt text,
  model_id text,
  provider text not null
    check (provider in ('elevenlabs', 'mock')),
  duration_ms integer
    check (duration_ms is null or (duration_ms >= 3000 and duration_ms <= 600000)),
  force_instrumental boolean not null default true,
  -- License / commercial-use gate (Approve #196 consumes these).
  license_status text not null default 'pending'
    check (license_status in ('pending', 'cleared', 'mock', 'blocked', 'unknown')),
  license_tier text
    check (license_tier is null or license_tier in ('self_serve', 'enterprise', 'mock')),
  commercial_use_allowed boolean not null default false,
  license_notes text,
  provider_song_id text,
  input_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index music_generations_product_created_idx
  on public.music_generations (product_id, created_at desc);

create index music_generations_project_created_idx
  on public.music_generations (project_id, created_at desc)
  where project_id is not null;

create index music_generations_job_idx
  on public.music_generations (generation_job_id)
  where generation_job_id is not null;

create index music_generations_license_idx
  on public.music_generations (product_id, license_status, commercial_use_allowed);

comment on table public.music_generations is
  'Wave 2E / ADR-0041 — music bed generations with license metadata for Approve gate.';

comment on column public.music_generations.license_status is
  'pending|cleared|mock|blocked|unknown. mock = CI only; cleared + commercial_use_allowed required for Final.';

alter table public.music_generations enable row level security;

grant select, insert, update, delete on public.music_generations to service_role;
