-- Per-project video generator override (same pattern as reasoner_model_id / ADR-0007).
-- null = use the active Model Profile's video.modelId.
alter table public.studio_projects
  add column if not exists video_model_id text;

comment on column public.studio_projects.video_model_id is
  'Optional Gateway video model id for generate_video_clip; null uses model profile video.';
