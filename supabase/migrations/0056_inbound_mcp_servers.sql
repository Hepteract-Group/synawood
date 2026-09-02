-- #957 Inbound MCP servers (ADR-0081). Product-scoped; secrets encrypted at rest.

create table public.mcp_servers (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id) on delete cascade,
  display_name text not null,
  transport text not null check (transport in ('https', 'stdio', 'loopback')),
  endpoint text not null,
  auth_ciphertext text,
  auth_nonce text,
  status text not null default 'disconnected'
    check (status in ('disconnected', 'connected', 'error')),
  last_health_at timestamptz,
  last_health_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index mcp_servers_product_id_idx on public.mcp_servers (product_id);

comment on table public.mcp_servers is
  'Inbound MCP servers the Studio Agent may call (ADR-0081). Credentials never returned to the browser.';

create table public.mcp_enabled_tools (
  server_id uuid not null references public.mcp_servers (id) on delete cascade,
  tool_name text not null,
  enabled boolean not null default false,
  primary key (server_id, tool_name)
);

comment on table public.mcp_enabled_tools is
  'Per-tool enable flags after tools/list. Default off (ADR-0081). Wired in a follow-up ticket.';

alter table public.mcp_servers enable row level security;
alter table public.mcp_enabled_tools enable row level security;

grant select, insert, update, delete on public.mcp_servers to service_role;
grant select, insert, update, delete on public.mcp_enabled_tools to service_role;

create policy mcp_servers_select on public.mcp_servers
  for select to authenticated
  using (public.is_product_member(product_id, 'viewer'));

create policy mcp_servers_write on public.mcp_servers
  for all to authenticated
  using (public.is_product_member(product_id, 'editor'))
  with check (public.is_product_member(product_id, 'editor'));

create policy mcp_enabled_tools_select on public.mcp_enabled_tools
  for select to authenticated
  using (
    exists (
      select 1 from public.mcp_servers s
      where s.id = server_id and public.is_product_member(s.product_id, 'viewer')
    )
  );

create policy mcp_enabled_tools_write on public.mcp_enabled_tools
  for all to authenticated
  using (
    exists (
      select 1 from public.mcp_servers s
      where s.id = server_id and public.is_product_member(s.product_id, 'editor')
    )
  )
  with check (
    exists (
      select 1 from public.mcp_servers s
      where s.id = server_id and public.is_product_member(s.product_id, 'editor')
    )
  );

grant select, insert, update, delete on public.mcp_servers to authenticated;
grant select, insert, update, delete on public.mcp_enabled_tools to authenticated;
