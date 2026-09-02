-- Nullable Postiz ids must stay unique when present (Phase 2).
create unique index if not exists publish_records_postiz_id_uidx
  on public.publish_records (postiz_id)
  where postiz_id is not null;
