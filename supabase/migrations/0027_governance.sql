-- Wave 2H / ADR-0042 / #311 — Governance policies + approval runs/events.

create table public.governance_policies (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id) on delete cascade,
  slug text not null default 'default',
  version integer not null default 1,
  body jsonb not null default '{}'::jsonb,
  source_path text not null default '',
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, slug)
);

create index governance_policies_product_id_idx on public.governance_policies (product_id);

create table public.approval_runs (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id) on delete cascade,
  project_id uuid not null references public.studio_projects (id) on delete cascade,
  policy_id uuid references public.governance_policies (id) on delete set null,
  policy_version integer not null default 1,
  status text not null default 'open'
    check (status in ('open', 'completed', 'rejected', 'overridden', 'cancelled')),
  current_stage_index integer not null default 0,
  stages jsonb not null default '[]'::jsonb,
  claim_scan jsonb not null default '{}'::jsonb,
  disclaimer_text text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index approval_runs_product_status_idx on public.approval_runs (product_id, status);
create index approval_runs_project_id_idx on public.approval_runs (project_id);
create unique index approval_runs_one_open_per_project_idx
  on public.approval_runs (project_id)
  where status = 'open';

create table public.approval_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.approval_runs (id) on delete cascade,
  stage_key text not null default '',
  stage_index integer not null default 0,
  action text not null
    check (action in ('submit', 'sign_off', 'reject', 'override', 'claim_scan')),
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_role text,
  reason text not null default '',
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index approval_events_run_id_idx on public.approval_events (run_id);
create index approval_events_created_at_idx on public.approval_events (created_at);

comment on table public.governance_policies is
  'Mirrored product approval policies (ADR-0042). Git file is source of truth.';
comment on table public.approval_runs is
  'Multi-stage Approve runs; Final only after last stage or owner override.';
comment on table public.approval_events is
  'Audit trail for sign-off / reject / override / claim scan.';

alter table public.governance_policies enable row level security;
alter table public.approval_runs enable row level security;
alter table public.approval_events enable row level security;

-- service_role only (dashboard/workers via requireStudioAccess). No authenticated
-- policies: browser clients must not read these tables directly.

grant select, insert, update, delete on public.governance_policies to service_role;
grant select, insert, update, delete on public.approval_runs to service_role;
grant select, insert, update, delete on public.approval_events to service_role;
