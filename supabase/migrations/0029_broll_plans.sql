-- Wave 2I / #518: persist assemble_broll dry-run plans across reload (ADR-0047).

create table if not exists public.broll_plans (
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

create index if not exists broll_plans_project_created_idx
  on public.broll_plans (project_id, created_at desc);

create index if not exists broll_plans_project_status_idx
  on public.broll_plans (project_id, status);

create unique index if not exists broll_plans_draft_idempotent_idx
  on public.broll_plans (project_id, project_revision, input_hash)
  where status = 'draft';

comment on table public.broll_plans is
  'Preview-first B-roll assembly plans (ADR-0047). Survives modal close / reload.';

alter table public.broll_plans enable row level security;

grant select, insert, update, delete on public.broll_plans to service_role;
