-- Wave 2G / ADR-0040 / #298 — Campaign goals → plans → actions (human-gated).

create table public.campaign_goals (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id) on delete cascade,
  title text not null,
  outcome text not null default '',
  success_metric text not null default '',
  status text not null default 'active'
    check (status in ('active', 'paused', 'completed', 'killed')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paused_at timestamptz,
  killed_at timestamptz,
  completed_at timestamptz
);

create index campaign_goals_product_id_idx on public.campaign_goals (product_id);
create index campaign_goals_status_idx on public.campaign_goals (product_id, status);

create table public.campaign_plans (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.campaign_goals (id) on delete cascade,
  product_id text not null references public.products (id) on delete cascade,
  title text not null,
  summary text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'completed', 'killed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paused_at timestamptz,
  killed_at timestamptz
);

create index campaign_plans_goal_id_idx on public.campaign_plans (goal_id);
create index campaign_plans_product_id_idx on public.campaign_plans (product_id);

create table public.campaign_actions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.campaign_plans (id) on delete cascade,
  goal_id uuid not null references public.campaign_goals (id) on delete cascade,
  product_id text not null references public.products (id) on delete cascade,
  action_type text not null,
  title text not null,
  payload jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  status text not null default 'proposed'
    check (status in (
      'proposed',
      'awaiting_approval',
      'approved',
      'rejected',
      'running',
      'done',
      'failed',
      'killed'
    )),
  requires_approval boolean not null default true,
  error_message text,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users (id) on delete set null,
  started_at timestamptz,
  finished_at timestamptz
);

create index campaign_actions_plan_id_idx on public.campaign_actions (plan_id);
create index campaign_actions_goal_id_idx on public.campaign_actions (goal_id);
create index campaign_actions_product_status_idx on public.campaign_actions (product_id, status);

create table public.campaign_action_events (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.campaign_actions (id) on delete cascade,
  event_type text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  actor_user_id uuid references auth.users (id) on delete set null
);

create index campaign_action_events_action_id_idx on public.campaign_action_events (action_id);

comment on table public.campaign_goals is
  'Autonomous marketing goals (ADR-0040). No silent spend.';
comment on table public.campaign_plans is
  'Plans proposed under a goal; pause/kill cascades to dispatch.';
comment on table public.campaign_actions is
  'Gated work items; approval required before side effects.';
comment on table public.campaign_action_events is
  'Audit trail for action status transitions.';

alter table public.campaign_goals enable row level security;
alter table public.campaign_plans enable row level security;
alter table public.campaign_actions enable row level security;
alter table public.campaign_action_events enable row level security;

grant select, insert, update, delete on public.campaign_goals to service_role;
grant select, insert, update, delete on public.campaign_plans to service_role;
grant select, insert, update, delete on public.campaign_actions to service_role;
grant select, insert, update, delete on public.campaign_action_events to service_role;
