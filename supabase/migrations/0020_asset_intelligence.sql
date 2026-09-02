-- Wave 2C / ADR-0032 / #163 — product-scoped asset intelligence (pgvector).
-- Pipeline behaviour lands in #164+; this migration is schema only.

create extension if not exists vector with schema extensions;

create table public.asset_index_state (
  asset_id uuid primary key references public.assets (id) on delete cascade,
  product_id text not null references public.products (id) on delete cascade,
  status text not null
    check (status in ('pending', 'indexing', 'ready', 'failed')),
  stage text not null default 'queued'
    check (
      stage in (
        'queued',
        'probe',
        'shots',
        'caption',
        'transcribe',
        'embed',
        'ready',
        'failed'
      )
    ),
  caption text,
  transcript_excerpt text,
  last_error text,
  face_detect_ran boolean not null default false,
  indexed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index asset_index_state_product_status_idx
  on public.asset_index_state (product_id, status);

comment on table public.asset_index_state is
  'Per-asset indexing pipeline state (ADR-0032). Product-scoped via product_id.';

create table public.asset_shots (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  product_id text not null references public.products (id) on delete cascade,
  ordinal integer not null check (ordinal >= 0),
  start_ms integer not null default 0 check (start_ms >= 0),
  end_ms integer check (end_ms is null or end_ms >= start_ms),
  thumb_blob_key text,
  created_at timestamptz not null default now(),
  unique (asset_id, ordinal)
);

create index asset_shots_product_asset_idx
  on public.asset_shots (product_id, asset_id);

comment on table public.asset_shots is
  'Shot boundaries / keyframe thumbs for video; single ordinal 0 for images.';

create table public.asset_tags (
  asset_id uuid not null references public.assets (id) on delete cascade,
  product_id text not null references public.products (id) on delete cascade,
  tag text not null check (char_length(tag) between 1 and 64),
  source text not null default 'caption'
    check (source in ('caption', 'manual', 'heuristic')),
  created_at timestamptz not null default now(),
  primary key (asset_id, tag)
);

create index asset_tags_product_tag_idx
  on public.asset_tags (product_id, tag);

comment on table public.asset_tags is
  'Normalized tags for filtering (Story Builder / list_assets_by_tag).';

-- Dim pinned for v1 text embeddings (OpenAI text-embedding-3-small / compatible).
-- Changing dim requires a new migration (#166 docs that model_id).
create table public.asset_embeddings (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets (id) on delete cascade,
  product_id text not null references public.products (id) on delete cascade,
  shot_id uuid references public.asset_shots (id) on delete cascade,
  kind text not null check (kind in ('text', 'visual')),
  model_id text not null,
  embedding extensions.vector(1536) not null,
  created_at timestamptz not null default now()
);

create unique index asset_embeddings_asset_kind_model_whole_uidx
  on public.asset_embeddings (asset_id, kind, model_id)
  where shot_id is null;

create unique index asset_embeddings_asset_kind_model_shot_uidx
  on public.asset_embeddings (asset_id, kind, model_id, shot_id)
  where shot_id is not null;

create index asset_embeddings_product_kind_idx
  on public.asset_embeddings (product_id, kind);

create index asset_embeddings_embedding_hnsw_idx
  on public.asset_embeddings
  using hnsw (embedding extensions.vector_cosine_ops);

comment on table public.asset_embeddings is
  'pgvector embeddings (1536-d v1). Whole-asset rows have shot_id null.';

alter table public.asset_index_state enable row level security;
alter table public.asset_shots enable row level security;
alter table public.asset_tags enable row level security;
alter table public.asset_embeddings enable row level security;

grant select, insert, update, delete on public.asset_index_state to service_role;
grant select, insert, update, delete on public.asset_shots to service_role;
grant select, insert, update, delete on public.asset_tags to service_role;
grant select, insert, update, delete on public.asset_embeddings to service_role;
