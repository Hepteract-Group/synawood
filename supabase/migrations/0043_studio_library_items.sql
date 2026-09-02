-- Wave 2K / ADR-0059 / #715 — product-scoped Studio overlay library.
-- Synawood Supabase only. First-party packs list from repo JSON, not this table.

create table public.studio_library_items (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id) on delete cascade,
  kind text not null
    check (kind in ('sticker', 'filter', 'effect', 'text_preset', 'caption_preset')),
  label text not null,
  source text not null
    check (source in ('generated', 'imported')),
  license_status text not null default 'unknown'
    check (license_status in ('unknown', 'cleared', 'blocked', 'generated')),
  commercial_use_allowed boolean not null default false,
  recipe jsonb not null default '{}'::jsonb,
  blob_key text,
  created_by text not null
    check (created_by in ('user', 'agent', 'import')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index studio_library_items_product_kind_idx
  on public.studio_library_items (product_id, kind, created_at desc);

comment on table public.studio_library_items is
  'ADR-0059 product overlay library (stickers, grades, treatments, presets). First-party packs are not stored here.';

comment on column public.studio_library_items.license_status is
  'unknown until founder clears commercial use (#718). generated = agent/user authored tokens. blocked fails Approve.';

comment on column public.studio_library_items.blob_key is
  'Optional Blob key under library/{productId}/{kind}/… — Synawood container only.';

alter table public.studio_library_items enable row level security;

grant select, insert, update, delete on public.studio_library_items to service_role;
