-- ADR-0077 / #896: operator-chosen channel still on a Final. Null is allowed (TikTok).
alter table public.final_assets
  add column if not exists thumbnail_asset_id uuid references public.assets (id) on delete set null;

comment on column public.final_assets.thumbnail_asset_id is
  'Channel thumbnail still chosen at Approve / Work board. Null does not block Approve.';
