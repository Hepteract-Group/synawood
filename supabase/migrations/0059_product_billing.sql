-- #1033 Hosted billing wallet (ADR-0082). Next free number after 0058.
-- Members read. Writes are service_role only. No example-product list prices.

create table public.product_billing (
  product_id text primary key references public.products (id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text,
  plan_id text not null check (plan_id in ('trial', 'studio', 'team')),
  status text not null check (status in ('trialing', 'active', 'past_due', 'canceled', 'expired')),
  generation_frozen boolean not null default false,
  seat_limit integer not null,
  period_start timestamptz,
  period_end timestamptz,
  included_grant_gbp numeric(12,4) not null default 0,
  trial_ends_at timestamptz,
  terms_version text,
  privacy_version text,
  consented_at timestamptz,
  updated_at timestamptz not null default now()
);

comment on table public.product_billing is
  'Organisation billing: plan, freeze, trial window (ADR-0082). Stripe ids nullable until checkout.';

create table public.product_wallets (
  product_id text primary key references public.products (id) on delete cascade,
  balance_gbp numeric(12,4) not null check (balance_gbp >= 0),
  updated_at timestamptz not null default now()
);

comment on table public.product_wallets is
  'Prepaid GBP remaining for the Organisation. Never negative.';

create table public.wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id) on delete cascade,
  amount_gbp numeric(12,4) not null,
  kind text not null check (kind in ('grant', 'debit', 'refund', 'pack', 'adjustment')),
  cost_event_id uuid references public.cost_events (id) on delete set null,
  job_id text,
  stripe_event_id text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  check (
    (kind in ('debit', 'refund') and cost_event_id is not null)
    or kind in ('grant', 'pack', 'adjustment')
  )
);

create index wallet_ledger_product_id_idx
  on public.wallet_ledger (product_id, created_at desc);

comment on table public.wallet_ledger is
  'Signed wallet movements. Debit/refund rows point at cost_events.';

alter table public.product_billing enable row level security;
alter table public.product_wallets enable row level security;
alter table public.wallet_ledger enable row level security;

create policy product_billing_select on public.product_billing
  for select to authenticated
  using (public.is_product_member(product_id, 'viewer'));

create policy product_wallets_select on public.product_wallets
  for select to authenticated
  using (public.is_product_member(product_id, 'viewer'));

create policy wallet_ledger_select on public.wallet_ledger
  for select to authenticated
  using (public.is_product_member(product_id, 'viewer'));

grant select on public.product_billing to authenticated;
grant select on public.product_wallets to authenticated;
grant select on public.wallet_ledger to authenticated;

grant select, insert, update, delete on public.product_billing to service_role;
grant select, insert, update, delete on public.product_wallets to service_role;
grant select, insert, update, delete on public.wallet_ledger to service_role;
