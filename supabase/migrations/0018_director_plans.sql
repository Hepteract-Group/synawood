-- Wave 2A: persist Director plans across reload (ADR-0029 / #139).

create table if not exists public.director_plans (
  id uuid primary key,
  product_id text not null references public.products (id) on delete cascade,
  project_id uuid not null references public.studio_projects (id) on delete cascade,
  status text not null
    check (status in ('draft', 'applied', 'rejected', 'stale')),
  project_revision integer not null check (project_revision > 0),
  input_hash text not null,
  plan_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists director_plans_project_created_idx
  on public.director_plans (project_id, created_at desc);

create index if not exists director_plans_project_status_idx
  on public.director_plans (project_id, status);

-- Idempotent dry-runs: same project revision + input → same draft row.
create unique index if not exists director_plans_draft_idempotent_idx
  on public.director_plans (project_id, project_revision, input_hash)
  where status = 'draft';

comment on table public.director_plans is
  'Preview-first AI Director plans (ADR-0029). Survives modal close / reload.';

alter table public.director_plans enable row level security;

grant select, insert, update, delete on public.director_plans to service_role;
