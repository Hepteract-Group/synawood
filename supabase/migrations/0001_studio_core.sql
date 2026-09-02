-- Synawood Creative Studio core schema
-- Dedicated Synawood Supabase project; project ref comes from env.

create extension if not exists "pgcrypto";

create table public.products (
  id text primary key,
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.studio_projects (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id),
  composition_id text not null default 'talking_head_60',
  status text not null default 'drafting'
    check (status in ('drafting', 'rendering', 'needs_review', 'approved', 'killed')),
  model_profile_id text not null default 'mock',
  project_json jsonb not null default '{}'::jsonb,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index studio_projects_product_status_idx
  on public.studio_projects (product_id, status);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id),
  project_id uuid references public.studio_projects (id) on delete set null,
  kind text not null check (kind in ('video', 'image', 'audio', 'other')),
  source text not null check (source in ('upload', 'brand_kit', 'generator')),
  blob_key text not null unique,
  content_type text,
  probe jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id),
  project_id uuid references public.studio_projects (id) on delete set null,
  status text not null default 'queued'
    check (status in ('queued', 'generating', 'ready', 'failed')),
  role text not null check (role in ('image', 'video', 'speech', 'transcribe')),
  model_id text,
  model_profile_id text,
  estimated_gbp numeric(12, 4),
  actual_gbp numeric(12, 4),
  input_snapshot jsonb not null default '{}'::jsonb,
  output_asset_id uuid references public.assets (id) on delete set null,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.render_jobs (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id),
  project_id uuid not null references public.studio_projects (id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'rendering', 'completed', 'failed')),
  output_asset_ids uuid[] not null default '{}',
  duration_ms integer,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cost_events (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id),
  project_id uuid references public.studio_projects (id) on delete set null,
  job_id uuid,
  role text not null,
  model_id text,
  units numeric(18, 6),
  estimated_gbp numeric(12, 4),
  actual_gbp numeric(12, 4),
  created_at timestamptz not null default now()
);

create table public.content_slots (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id),
  week_id text not null,
  channel text not null,
  brief_path text,
  project_id uuid references public.studio_projects (id) on delete set null,
  status text not null default 'planned',
  created_at timestamptz not null default now(),
  unique (product_id, week_id, channel, brief_path)
);

create table public.final_assets (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id),
  project_id uuid not null references public.studio_projects (id) on delete cascade,
  content_slot_id uuid references public.content_slots (id) on delete set null,
  render_job_id uuid references public.render_jobs (id) on delete set null,
  primary_asset_id uuid not null references public.assets (id),
  members jsonb not null default '[]'::jsonb,
  week_path_mirror text,
  created_at timestamptz not null default now(),
  unique (project_id, render_job_id)
);

create table public.publish_records (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id),
  final_asset_id uuid not null references public.final_assets (id) on delete cascade,
  content_slot_id uuid references public.content_slots (id) on delete set null,
  channel text not null,
  status text not null default 'ready'
    check (status in ('ready', 'scheduled', 'posted', 'failed', 'skipped', 'manual_posted')),
  scheduled_at timestamptz,
  posted_at timestamptz,
  external_url text,
  postiz_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.studio_projects enable row level security;
alter table public.assets enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.render_jobs enable row level security;
alter table public.cost_events enable row level security;
alter table public.content_slots enable row level security;
alter table public.final_assets enable row level security;
alter table public.publish_records enable row level security;

-- Deny anon/authenticated by default. Server uses service role (bypasses RLS).
-- Operator policies can be added when browser-scoped reads are required.
