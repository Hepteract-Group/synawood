create or replace function public.append_studio_tool_trace(
  p_project_id uuid,
  p_entries jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  combined jsonb;
begin
  if jsonb_typeof(p_entries) <> 'array' then
    raise exception 'p_entries must be a JSON array';
  end if;

  select coalesce(tool_trace, '[]'::jsonb) || p_entries
  into combined
  from public.studio_projects
  where id = p_project_id
  for update;

  if combined is null then
    raise exception 'Studio project not found: %', p_project_id;
  end if;

  update public.studio_projects
  set
    tool_trace = case
      when jsonb_array_length(combined) <= 100 then combined
      else (
        select jsonb_agg(item order by ordinality)
        from jsonb_array_elements(combined) with ordinality as entries(item, ordinality)
        where ordinality > jsonb_array_length(combined) - 100
      )
    end,
    updated_at = now()
  where id = p_project_id;
end;
$$;

grant execute on function public.append_studio_tool_trace(uuid, jsonb) to service_role;
