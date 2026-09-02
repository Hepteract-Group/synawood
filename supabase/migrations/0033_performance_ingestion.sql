-- Wave 2F / ADR-0035 / #238–#244 — outcomes, encrypted tokens, creative_performance.

create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id) on delete cascade,
  provider text not null
    check (provider in (
      'tiktok', 'meta', 'youtube', 'linkedin', 'shopify', 'stripe', 'manual'
    )),
  status text not null default 'disconnected'
    check (status in ('disconnected', 'connected', 'error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, provider)
);

comment on table public.integrations is
  'ADR-0035 product connections. v1 tokens are paste-in; OAuth is #246.';

create table public.integration_secrets (
  integration_id uuid primary key references public.integrations (id) on delete cascade,
  ciphertext text not null,
  nonce text not null,
  key_version integer not null default 1,
  updated_at timestamptz not null default now()
);

comment on table public.integration_secrets is
  'ADR-0035 AES-256-GCM ciphertext. Never store plaintext tokens.';

create table public.outcomes (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id) on delete cascade,
  source text not null
    check (source in ('manual', 'organic', 'commerce')),
  provider text not null,
  metric text not null
    check (metric in ('views', 'clicks', 'signups', 'revenue', 'other')),
  value numeric not null,
  occurred_at timestamptz not null default now(),
  publish_record_id uuid references public.publish_records (id) on delete set null,
  final_asset_id uuid references public.final_assets (id) on delete set null,
  project_id uuid references public.studio_projects (id) on delete set null,
  external_id text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index outcomes_product_occurred_idx
  on public.outcomes (product_id, occurred_at desc);

create index outcomes_final_idx
  on public.outcomes (final_asset_id, occurred_at desc)
  where final_asset_id is not null;

comment on table public.outcomes is
  'ADR-0035 attributed metrics. Manual is the live v1 path.';

create table public.unattributed_activity (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id) on delete cascade,
  provider text not null,
  occurred_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index unattributed_activity_product_idx
  on public.unattributed_activity (product_id, created_at desc);

comment on table public.unattributed_activity is
  'ADR-0035 rows that did not match a publish URL or Final id.';

create materialized view public.creative_performance as
select
  fa.product_id,
  fa.id as final_asset_id,
  fa.project_id,
  fa.creative_structure ->> 'source' as structure_source,
  jsonb_array_length(coalesce(fa.creative_structure -> 'beats', '[]'::jsonb)) as beat_count,
  coalesce(sum(o.value) filter (where o.metric = 'views'), 0) as views,
  coalesce(sum(o.value) filter (where o.metric = 'clicks'), 0) as clicks,
  coalesce(sum(o.value) filter (where o.metric = 'signups'), 0) as signups,
  coalesce(sum(o.value) filter (where o.metric = 'revenue'), 0) as revenue,
  count(o.id) as outcome_count
from public.final_assets fa
left join public.outcomes o on o.final_asset_id = fa.id
group by fa.product_id, fa.id, fa.project_id, fa.creative_structure;

comment on materialized view public.creative_performance is
  'ADR-0035 Final × outcomes rollup. Refresh via refresh_creative_performance().';

create unique index creative_performance_final_idx
  on public.creative_performance (final_asset_id);

create or replace function public.refresh_creative_performance()
returns void
language sql
security definer
set search_path = public
as $$
  refresh materialized view concurrently public.creative_performance;
$$;

alter table public.integrations enable row level security;
alter table public.integration_secrets enable row level security;
alter table public.outcomes enable row level security;
alter table public.unattributed_activity enable row level security;

grant select, insert, update, delete on public.integrations to service_role;
grant select, insert, update, delete on public.integration_secrets to service_role;
grant select, insert, update, delete on public.outcomes to service_role;
grant select, insert, update, delete on public.unattributed_activity to service_role;
grant select on public.creative_performance to service_role;
grant execute on function public.refresh_creative_performance() to service_role;
