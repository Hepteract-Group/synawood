-- Wave 2G / ADR-0037 / #263 — functional roles + audit_events.
-- Tenancy role (owner|editor|viewer) is unchanged. functional_role is additive
-- and nullable until the #271 founder backfill sets NOT NULL.

alter table public.product_members
  add column if not exists functional_role text
  check (
    functional_role is null
    or functional_role in ('founder', 'editor', 'reviewer', 'publisher', 'analyst')
  );

comment on column public.product_members.functional_role is
  'Job function (ADR-0037). Null until #271 backfill. Distinct from tenancy role.';

alter table public.product_invites
  add column if not exists functional_role text
  check (
    functional_role is null
    or functional_role in ('founder', 'editor', 'reviewer', 'publisher', 'analyst')
  );

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_product_id_idx
  on public.audit_events (product_id, created_at desc);

alter table public.audit_events enable row level security;

create policy audit_events_select_members
  on public.audit_events
  for select
  to authenticated
  using (public.is_product_member(product_id, 'viewer'));

grant select on public.audit_events to authenticated;
grant select, insert on public.audit_events to service_role;
