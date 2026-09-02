-- #108: allow assets.source = 'url' (Add from URL ingest; bytes in Blob, no hotlink).

alter table public.assets
  drop constraint if exists assets_source_check;

alter table public.assets
  add constraint assets_source_check
  check (source in ('upload', 'brand_kit', 'generator', 'url'));
