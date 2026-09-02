-- Wave 2G / ADR-0039 / #285 — Agent Marketplace pack catalog (Skill + Style packs).
-- Distinct from ADR-0027 stock-media marketplace stubs.

create table public.pack_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  kind text not null check (kind in ('skill', 'style')),
  title text not null,
  summary text not null default '',
  publisher text not null default 'hepteract',
  status text not null default 'draft'
    check (status in ('draft', 'queued', 'published', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pack_catalog_status_idx on public.pack_catalog (status);
create index pack_catalog_kind_idx on public.pack_catalog (kind);

create table public.pack_versions (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.pack_catalog (id) on delete cascade,
  semver text not null,
  blob_key text not null,
  checksum_sha256 text not null,
  signature text,
  manifest jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (pack_id, semver)
);

create index pack_versions_pack_id_idx on public.pack_versions (pack_id);

create table public.pack_installs (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id) on delete cascade,
  pack_version_id uuid not null references public.pack_versions (id) on delete cascade,
  enabled boolean not null default true,
  installed_at timestamptz not null default now(),
  disabled_at timestamptz,
  unique (product_id, pack_version_id)
);

create index pack_installs_product_id_idx on public.pack_installs (product_id);
create index pack_installs_enabled_idx on public.pack_installs (product_id, enabled);

create table public.pack_revocations (
  id uuid primary key default gen_random_uuid(),
  pack_version_id uuid not null references public.pack_versions (id) on delete cascade,
  reason text not null default '',
  revoked_at timestamptz not null default now()
);

create index pack_revocations_version_idx on public.pack_revocations (pack_version_id);
create index pack_revocations_revoked_at_idx on public.pack_revocations (revoked_at);

create table public.pack_submissions (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid references public.pack_catalog (id) on delete set null,
  slug text not null,
  kind text not null check (kind in ('skill', 'style')),
  title text not null,
  blob_key text not null,
  checksum_sha256 text not null,
  signature text,
  manifest jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued', 'approved', 'rejected')),
  submitted_by uuid references auth.users (id) on delete set null,
  curator_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index pack_submissions_status_idx on public.pack_submissions (status);

comment on table public.pack_catalog is
  'Agent Marketplace listings (ADR-0039). Not stock-media adapters.';
comment on table public.pack_versions is
  'Immutable signed pack artifacts (blob + checksum + optional signature).';
comment on table public.pack_installs is
  'Product-scoped installs of a pack version.';
comment on table public.pack_revocations is
  'Revocation events; sync disables installs (#294).';
comment on table public.pack_submissions is
  'Curator queue for unpublished packs (#291).';

alter table public.pack_catalog enable row level security;
alter table public.pack_versions enable row level security;
alter table public.pack_installs enable row level security;
alter table public.pack_revocations enable row level security;
alter table public.pack_submissions enable row level security;

grant select, insert, update, delete on public.pack_catalog to service_role;
grant select, insert, update, delete on public.pack_versions to service_role;
grant select, insert, update, delete on public.pack_installs to service_role;
grant select, insert, update, delete on public.pack_revocations to service_role;
grant select, insert, update, delete on public.pack_submissions to service_role;
