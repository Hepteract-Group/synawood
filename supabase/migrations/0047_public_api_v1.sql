-- Wave 2G / ADR-0038 / #274 — public API v1 persistence.
-- Keys are hashed. Plaintext is shown once at create (#280). withApiKey is #275.

create table if not exists public.product_api_keys (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  created_by uuid references auth.users (id) on delete set null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists product_api_keys_product_id_idx
  on public.product_api_keys (product_id)
  where revoked_at is null;

create table if not exists public.api_idempotency (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id) on delete cascade,
  api_key_id uuid references public.product_api_keys (id) on delete cascade,
  idempotency_key text not null,
  request_hash text not null,
  status_code integer,
  response jsonb,
  created_at timestamptz not null default now(),
  unique (product_id, idempotency_key)
);

create table if not exists public.product_webhooks (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id) on delete cascade,
  url text not null,
  secret_hash text not null,
  events text[] not null default array['job.ready', 'job.failed']::text[],
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists product_webhooks_product_id_idx
  on public.product_webhooks (product_id)
  where revoked_at is null;

create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null references public.product_webhooks (id) on delete cascade,
  event text not null,
  payload jsonb not null,
  status text not null check (status in ('pending', 'delivered', 'failed')),
  attempt_count integer not null default 0,
  last_error text,
  next_attempt_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists webhook_deliveries_due_idx
  on public.webhook_deliveries (status, next_attempt_at)
  where status = 'pending';

alter table public.product_api_keys enable row level security;
alter table public.api_idempotency enable row level security;
alter table public.product_webhooks enable row level security;
alter table public.webhook_deliveries enable row level security;

create policy product_api_keys_select_owners
  on public.product_api_keys
  for select
  to authenticated
  using (public.is_product_member(product_id, 'owner'));

create policy product_webhooks_select_owners
  on public.product_webhooks
  for select
  to authenticated
  using (public.is_product_member(product_id, 'owner'));

grant select on public.product_api_keys to authenticated;
grant select on public.product_webhooks to authenticated;
grant select, insert, update, delete on public.product_api_keys to service_role;
grant select, insert, update, delete on public.api_idempotency to service_role;
grant select, insert, update, delete on public.product_webhooks to service_role;
grant select, insert, update, delete on public.webhook_deliveries to service_role;
