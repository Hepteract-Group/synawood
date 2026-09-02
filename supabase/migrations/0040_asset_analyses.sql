-- Wave 2J / #585 / ADR-0053 — analyze-on-index results (same product index).

create table public.asset_analyses (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  product_id text not null references public.products (id) on delete cascade,
  shot_id uuid references public.asset_shots (id) on delete set null,
  kind text not null check (kind in ('segment', 'compliance', 'highlight', 'custom')),
  schema_id text not null check (char_length(schema_id) between 1 and 64),
  result jsonb not null default '{}'::jsonb,
  model_id text not null,
  start_ms integer check (start_ms is null or start_ms >= 0),
  end_ms integer check (end_ms is null or end_ms >= start_ms),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (asset_id, kind, schema_id)
);

create index asset_analyses_product_asset_idx
  on public.asset_analyses (product_id, asset_id);

comment on table public.asset_analyses is
  'Analyze-on-index JSON (segment / compliance / highlight / custom). Replaces by (asset_id, kind, schema_id).';

alter table public.asset_analyses enable row level security;

grant select, insert, update, delete on public.asset_analyses to service_role;
