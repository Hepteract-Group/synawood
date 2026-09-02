-- Plan 05 slice 2: durable publish status history + optional caption on publish_records.
alter table public.publish_records
  add column if not exists caption text,
  add column if not exists status_history jsonb not null default '[]'::jsonb;

comment on column public.publish_records.status_history is
  'Append-only [{ status, at, note? }] transitions for manual / Postiz publish.';
