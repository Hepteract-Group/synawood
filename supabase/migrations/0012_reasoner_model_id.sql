-- Per-project reasoner override (ADR-0007 single-role override).
-- null = use the active Model Profile's reasoner.modelId.
alter table public.studio_projects
  add column if not exists reasoner_model_id text;

comment on column public.studio_projects.reasoner_model_id is
  'Optional Gateway/chat model id for the Studio Agent reasoner; null uses model profile reasoner.';
