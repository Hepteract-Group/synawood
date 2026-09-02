-- #861 skippable person profile (ADR-0068). Not membership. Not functional_role.

create table public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  job_title text check (job_title is null or job_title in ('founder', 'marketer', 'editor', 'other')),
  intent text check (intent is null or intent in ('make_ads', 'run_gtm', 'exploring')),
  onboarding_completed_at timestamptz,
  onboarding_skipped boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_user_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.touch_user_profiles_updated_at();

alter table public.user_profiles enable row level security;

create policy user_profiles_select_own
  on public.user_profiles
  for select
  to authenticated
  using (user_id = auth.uid());

create policy user_profiles_insert_own
  on public.user_profiles
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy user_profiles_update_own
  on public.user_profiles
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on public.user_profiles to authenticated;
grant select, insert, update, delete on public.user_profiles to service_role;
