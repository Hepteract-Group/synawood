-- ADR-0035: pin search_path on the security-definer refresh RPC.
-- Safe to re-run after 0033; CREATE OR REPLACE is idempotent.

create or replace function public.refresh_creative_performance()
returns void
language sql
security definer
set search_path = public
as $$
  refresh materialized view concurrently public.creative_performance;
$$;
