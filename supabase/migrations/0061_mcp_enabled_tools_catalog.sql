-- #1084 tools/list catalog metadata (ADR-0081).

alter table public.mcp_enabled_tools
  add column description text,
  add column input_schema jsonb,
  add column discovered_at timestamptz not null default now();

comment on column public.mcp_enabled_tools.description is
  'Remote tool description from tools/list (ADR-0081).';
comment on column public.mcp_enabled_tools.input_schema is
  'JSON Schema from tools/list inputSchema.';
comment on column public.mcp_enabled_tools.discovered_at is
  'Last time this tool was seen on tools/list refresh.';

comment on table public.mcp_enabled_tools is
  'Per-tool enable flags and catalog metadata after tools/list. Default off (ADR-0081).';
