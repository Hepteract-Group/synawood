-- Wave 2C / #168 — semantic match over asset_embeddings (service_role).

create or replace function public.match_asset_embeddings(
  p_product_id text,
  p_query extensions.vector(1536),
  p_model_id text,
  p_match_count int default 12,
  p_kind text default 'text'
)
returns table (
  asset_id uuid,
  product_id text,
  kind text,
  model_id text,
  distance double precision
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    e.asset_id,
    e.product_id,
    e.kind,
    e.model_id,
    (e.embedding <=> p_query)::double precision as distance
  from public.asset_embeddings e
  where e.product_id = p_product_id
    and e.kind = p_kind
    and e.model_id = p_model_id
    and e.shot_id is null
  order by e.embedding <=> p_query
  limit greatest(1, least(coalesce(p_match_count, 12), 50));
$$;

comment on function public.match_asset_embeddings is
  'Wave 2C / #168 — cosine distance rank for whole-asset text (or visual) embeddings.';

revoke all on function public.match_asset_embeddings(text, extensions.vector, text, int, text) from public;
grant execute on function public.match_asset_embeddings(text, extensions.vector, text, int, text) to service_role;
