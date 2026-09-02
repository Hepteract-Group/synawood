-- Wave 2D / ADR-0030 / #180 — named branches within a Studio Project.
-- Distinct from ADR-0027 variant child projects (parent_project_id).

create table public.studio_project_branches (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.studio_projects (id) on delete cascade,
  name text not null,
  slug text not null,
  is_main boolean not null default false,
  parent_branch_id uuid references public.studio_project_branches (id) on delete set null,
  forked_from_revision integer,
  project_json jsonb not null default '{}'::jsonb,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, slug),
  unique (project_id, name),
  check (
    (is_main = false)
    or (name = 'main' and slug = 'main')
  )
);

create unique index studio_project_branches_one_main_per_project_idx
  on public.studio_project_branches (project_id)
  where is_main;

create index studio_project_branches_project_id_idx
  on public.studio_project_branches (project_id);

comment on table public.studio_project_branches is
  'Named timeline tips within one Studio Project (ADR-0030). Not variant child projects.';
comment on column public.studio_project_branches.is_main is
  'Exactly one main branch per project; reserved slug/name main.';
comment on column public.studio_project_branches.project_json is
  'Full Studio Project JSON tip for this branch.';

alter table public.studio_projects
  add column if not exists active_branch_id uuid references public.studio_project_branches (id) on delete set null;

comment on column public.studio_projects.active_branch_id is
  'Branch tip currently mirrored in project_json (ADR-0030).';

-- Backfill main from existing project tips.
insert into public.studio_project_branches (
  project_id,
  name,
  slug,
  is_main,
  parent_branch_id,
  forked_from_revision,
  project_json,
  revision,
  created_at,
  updated_at
)
select
  p.id,
  'main',
  'main',
  true,
  null,
  null,
  p.project_json,
  p.revision,
  p.created_at,
  p.updated_at
from public.studio_projects p
where not exists (
  select 1
  from public.studio_project_branches b
  where b.project_id = p.id and b.is_main
);

update public.studio_projects p
set active_branch_id = b.id
from public.studio_project_branches b
where b.project_id = p.id
  and b.is_main
  and p.active_branch_id is null;

-- New projects: ensure main exists when a project row is inserted.
create or replace function public.studio_projects_ensure_main_branch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  branch_id uuid;
begin
  if exists (
    select 1 from public.studio_project_branches b where b.project_id = new.id and b.is_main
  ) then
    return new;
  end if;

  insert into public.studio_project_branches (
    project_id, name, slug, is_main, project_json, revision, created_at, updated_at
  )
  values (
    new.id, 'main', 'main', true, new.project_json, new.revision, new.created_at, new.updated_at
  )
  returning id into branch_id;

  update public.studio_projects
  set active_branch_id = branch_id
  where id = new.id and active_branch_id is null;

  return new;
end;
$$;

drop trigger if exists studio_projects_ensure_main_branch_trg on public.studio_projects;
create trigger studio_projects_ensure_main_branch_trg
  after insert on public.studio_projects
  for each row
  execute function public.studio_projects_ensure_main_branch();

alter table public.studio_project_branches enable row level security;

grant select, insert, update, delete on public.studio_project_branches to service_role;
