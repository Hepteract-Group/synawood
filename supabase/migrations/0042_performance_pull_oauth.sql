-- Wave 2F / #245–#246 — last pull stamp + how the connection was made.

alter table public.integrations
  add column if not exists last_pull_at timestamptz,
  add column if not exists last_pull_reason text,
  add column if not exists last_pull_row_count integer not null default 0,
  add column if not exists auth_kind text not null default 'token'
    check (auth_kind in ('token', 'oauth'));

comment on column public.integrations.last_pull_at is
  'ADR-0035 / #245 last run of the analytics pull worker (stub or live).';
comment on column public.integrations.auth_kind is
  'token = paste-a-token; oauth = Settings Connect (#246).';
