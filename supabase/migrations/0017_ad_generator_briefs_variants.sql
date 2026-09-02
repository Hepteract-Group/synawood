-- Wave 2B / ADR-0027: ExtractedBrief storage, parent/child variant projects, extract job role.

-- generation_jobs: allow extract role
alter table public.generation_jobs
  drop constraint if exists generation_jobs_role_check;

alter table public.generation_jobs
  add constraint generation_jobs_role_check
  check (role in ('image', 'video', 'speech', 'transcribe', 'extract'));

comment on constraint generation_jobs_role_check on public.generation_jobs is
  'Generator roles plus extract (URL/PDF → ExtractedBrief).';

-- Parent / child variant linkage on studio_projects
alter table public.studio_projects
  add column if not exists parent_project_id uuid references public.studio_projects (id) on delete set null,
  add column if not exists variant_spec jsonb;

create index if not exists studio_projects_parent_project_id_idx
  on public.studio_projects (parent_project_id)
  where parent_project_id is not null;

comment on column public.studio_projects.parent_project_id is
  'When set, this project is a variant child of the parent first cut (ADR-0027).';
comment on column public.studio_projects.variant_spec is
  'VariantSpec JSON (platform × hook × CTA × aspect) for child projects.';

-- Extracted briefs
create table if not exists public.extracted_briefs (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id),
  project_id uuid references public.studio_projects (id) on delete set null,
  job_id uuid references public.generation_jobs (id) on delete set null,
  status text not null default 'ready'
    check (status in ('ready', 'applied', 'discarded', 'failed')),
  source_kind text not null check (source_kind in ('url', 'pdf')),
  source_uri text,
  brief_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists extracted_briefs_product_created_idx
  on public.extracted_briefs (product_id, created_at desc);

create index if not exists extracted_briefs_project_idx
  on public.extracted_briefs (project_id)
  where project_id is not null;

comment on table public.extracted_briefs is
  'URL/PDF extraction results (ExtractedBrief). Applied briefs may also mirror onto project_json.brief.';

alter table public.extracted_briefs enable row level security;

grant select, insert, update, delete on public.extracted_briefs to service_role;

-- Optional Final attribution for variant Approves
alter table public.final_assets
  add column if not exists attribution jsonb not null default '{}'::jsonb;

comment on column public.final_assets.attribution is
  'Optional { parent_project_id, variant_spec, extracted_brief_id } for Learning / Performance.';
