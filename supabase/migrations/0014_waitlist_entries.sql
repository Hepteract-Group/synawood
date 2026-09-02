-- Plan 07 / #102 — Public waitlist (ADR-0024). No Auth user is created.

create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_at timestamptz not null default now(),
  constraint waitlist_entries_email_lower_chk check (email = lower(email))
);

create unique index waitlist_entries_email_uidx on public.waitlist_entries (email);

alter table public.waitlist_entries enable row level security;

-- Inserts go through service_role from /api/waitlist. No anon/authenticated policies.
revoke all on table public.waitlist_entries from anon, authenticated;
grant select, insert on table public.waitlist_entries to service_role;
