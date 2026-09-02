-- Product Brand Library metadata (seedable from disk kit; Studio imports via API).
alter table public.products
  add column if not exists brand_library jsonb;

comment on column public.products.brand_library is
  'Product Brand Library snapshot: tokens + product-scoped asset ids/blob keys for optional Studio import (ADR-0025).';
