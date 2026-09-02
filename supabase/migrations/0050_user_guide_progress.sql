-- #863 Guide progress (ADR-0069). Catalogue stays in application code.

create table public.user_guide_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  guide_id text not null,
  status text not null,
  step_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, guide_id),
  constraint user_guide_progress_status_check
    check (status in ('pending', 'in_progress', 'completed', 'dismissed')),
  constraint user_guide_progress_step_check
    check (step_index >= 0)
);

create or replace function public.touch_user_guide_progress_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_guide_progress_updated_at
before update on public.user_guide_progress
for each row
execute function public.touch_user_guide_progress_updated_at();

alter table public.user_guide_progress enable row level security;

create policy user_guide_progress_select_own
  on public.user_guide_progress
  for select
  to authenticated
  using (user_id = auth.uid());

create policy user_guide_progress_insert_own
  on public.user_guide_progress
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy user_guide_progress_update_own
  on public.user_guide_progress
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on public.user_guide_progress to authenticated;
grant select, insert, update, delete on public.user_guide_progress to service_role;
