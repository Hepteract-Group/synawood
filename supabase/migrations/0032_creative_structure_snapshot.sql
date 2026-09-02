-- Wave 2F / ADR-0034 / #231 — immutable creative structure snapshot on Finals.

alter table public.final_assets
  add column if not exists creative_structure jsonb not null default '{"beats":[],"source":"manual"}'::jsonb;

comment on column public.final_assets.creative_structure is
  'ADR-0034 copy of project.creativeStructure at Approve. Do not rewrite existing rows.';
