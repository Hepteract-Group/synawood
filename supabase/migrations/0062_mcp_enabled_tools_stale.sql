-- #1086 stale inbound MCP tool rows (ADR-0081).

alter table public.mcp_enabled_tools
  add column stale boolean not null default false;

comment on column public.mcp_enabled_tools.stale is
  'True when tools/list no longer returns this tool. Stale tools stay visible, off, and are not callable.';
