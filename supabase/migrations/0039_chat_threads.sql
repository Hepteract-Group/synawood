-- #576 / ADR-0056: multiple Studio Agent chats per project (timeline stays project_json).
alter table public.studio_projects
  add column if not exists chat_threads jsonb not null default '{"activeId":null,"threads":[]}'::jsonb;

comment on column public.studio_projects.chat_threads is
  'Studio Agent chat threads { activeId, threads[] }. Active thread is also mirrored to chat_messages.';
