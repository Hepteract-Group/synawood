-- Wave 2F / ADR-0036 / #251 — insights (Learning Agent proposals).

create table public.insights (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id) on delete cascade,
  kind text not null
    check (kind in (
      'empty_structure',
      'missing_cta',
      'hook_length',
      'beat_count',
      'offer_signups'
    )),
  status text not null default 'open'
    check (status in ('open', 'applied', 'dismissed', 'snoozed')),
  title text not null,
  body text not null,
  evidence jsonb not null default '{}'::jsonb,
  proposed_prior jsonb not null default '{}'::jsonb,
  applied_prior jsonb,
  snooze_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index insights_product_status_idx
  on public.insights (product_id, status, created_at desc);

create unique index insights_open_kind_uniq
  on public.insights (product_id, kind)
  where status = 'open';

comment on table public.insights is
  'ADR-0036 Learning proposals. Humans Apply; nothing auto-writes priors.';

alter table public.insights enable row level security;

grant select, insert, update, delete on public.insights to service_role;
