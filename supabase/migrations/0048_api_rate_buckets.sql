-- Wave 2G / ADR-0038 / #275 — per-key rate limit buckets (UTC minute).

create table if not exists public.api_rate_buckets (
  api_key_id uuid not null references public.product_api_keys (id) on delete cascade,
  window_start timestamptz not null,
  hit_count integer not null default 0,
  primary key (api_key_id, window_start)
);

alter table public.api_rate_buckets enable row level security;

grant select, insert, update, delete on public.api_rate_buckets to service_role;

create or replace function public.bump_api_rate(
  p_key uuid,
  p_window timestamptz,
  p_limit integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  insert into public.api_rate_buckets (api_key_id, window_start, hit_count)
  values (p_key, p_window, 1)
  on conflict (api_key_id, window_start)
  do update set hit_count = public.api_rate_buckets.hit_count + 1
  returning public.api_rate_buckets.hit_count into n;

  if n > p_limit then
    return n;
  end if;
  return n;
end;
$$;

revoke all on function public.bump_api_rate(uuid, timestamptz, integer) from public;
grant execute on function public.bump_api_rate(uuid, timestamptz, integer) to service_role;
