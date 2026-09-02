-- #1089 Product-scoped Extracts (ADR-0089). Public-site stills + copy on the Product.
-- Distinct from extracted_briefs (one-shot Ad Generator) and project library assets.

create table public.product_extracts (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id) on delete cascade,
  kind text not null check (kind in ('screenshot', 'still', 'text')),
  source_url text not null,
  blob_key text,
  text text,
  quality text not null default 'usable'
    check (quality in ('usable', 'weak', 'reject')),
  quality_note text,
  job_id uuid references public.generation_jobs (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (kind = 'text' and text is not null)
    or (kind in ('screenshot', 'still') and blob_key is not null)
  )
);

create index product_extracts_product_created_idx
  on public.product_extracts (product_id, created_at desc);

create index product_extracts_product_quality_idx
  on public.product_extracts (product_id, quality, created_at desc);

create index product_extracts_job_idx
  on public.product_extracts (job_id)
  where job_id is not null;

comment on table public.product_extracts is
  'Product-owned public-page stills and copy for Studio reuse (ADR-0089). Blob bytes in Azure; never hotlink.';

comment on column public.product_extracts.quality is
  'Vision score bucket: usable / weak / reject. Rejected rows stay visible for operator override.';

alter table public.product_extracts enable row level security;

grant select, insert, update, delete on public.product_extracts to service_role;

create policy product_extracts_select on public.product_extracts
  for select to authenticated
  using (public.is_product_member(product_id, 'viewer'));

create policy product_extracts_write on public.product_extracts
  for all to authenticated
  using (public.is_product_member(product_id, 'editor'))
  with check (public.is_product_member(product_id, 'editor'));

grant select, insert, update, delete on public.product_extracts to authenticated;
