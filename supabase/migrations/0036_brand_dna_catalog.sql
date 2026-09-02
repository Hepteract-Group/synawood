-- Brand DNA + Product Catalog cache (ADR-0044 / #104 / #107).
-- Renumbered from 0028 in #558 so Wave 2I `0028_match_shot_embeddings` stays first.
-- Git files remain the seed; hosted edits persist here because Vercel cannot write the repo.

alter table public.products
  add column if not exists brand_dna jsonb,
  add column if not exists brand_dna_draft jsonb,
  add column if not exists brand_dna_draft_url text,
  add column if not exists catalog jsonb;

comment on column public.products.brand_dna is
  'Product Brand DNA cache (tagline, ICP, values, offer). Seed: products/<id>/brand-kit/dna.json (ADR-0044).';
comment on column public.products.brand_dna_draft is
  'Pending URL-ingest DNA draft until Apply or Discard. Survives reload.';
comment on column public.products.brand_dna_draft_url is
  'Source URL for brand_dna_draft.';
comment on column public.products.catalog is
  'Product Catalog cache (offer SKUs / claim bounds). Seed: products/<id>/catalog/catalog.json. Not the Asset Library.';
