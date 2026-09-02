-- Wave 2F / ADR-0034 / #228 — creative structure generated columns from project_json.

alter table public.studio_projects
  add column if not exists creative_structure jsonb
  generated always as (project_json -> 'creativeStructure') stored;

alter table public.studio_projects
  add column if not exists creative_structure_source text
  generated always as (project_json -> 'creativeStructure' ->> 'source') stored;

comment on column public.studio_projects.creative_structure is
  'ADR-0034 generated from project_json.creativeStructure.';

comment on column public.studio_projects.creative_structure_source is
  'ADR-0034 generated source (intent_scenes | manual).';
