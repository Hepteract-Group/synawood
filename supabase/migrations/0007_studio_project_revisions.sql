-- Revision history for Studio undo/redo (ADR-0016).
-- Cursor = studio_projects.revision; tip = history_tip (max recorded revision).
-- Undo moves the cursor back; redo moves it forward; a new edit truncates > cursor.

alter table public.studio_projects
  add column if not exists history_tip integer not null default 1;

update public.studio_projects
set history_tip = greatest(history_tip, revision)
where history_tip < revision;

create table if not exists public.studio_project_revisions (
  project_id uuid not null references public.studio_projects (id) on delete cascade,
  revision integer not null check (revision >= 1),
  project_json jsonb not null,
  created_at timestamptz not null default now(),
  primary key (project_id, revision)
);

create index if not exists studio_project_revisions_project_idx
  on public.studio_project_revisions (project_id, revision desc);

grant select, insert, update, delete on public.studio_project_revisions to service_role;
