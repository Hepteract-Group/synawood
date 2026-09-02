-- Plan 02: persist chat history + tool trace alongside project JSON (source of truth stays project_json).
alter table public.studio_projects
  add column if not exists chat_messages jsonb not null default '[]'::jsonb;

alter table public.studio_projects
  add column if not exists tool_trace jsonb not null default '[]'::jsonb;

comment on column public.studio_projects.chat_messages is
  'Studio Agent chat messages for resume/debug (Plan 02).';
comment on column public.studio_projects.tool_trace is
  'Append-only-ish tool trace for the latest turns (Plan 02).';
