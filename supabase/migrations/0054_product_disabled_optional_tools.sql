-- #962 first-party Studio Tool catalog: optional generate_* disables per Product.

alter table public.products
  add column if not exists disabled_optional_tools text[] not null default '{}'::text[];

comment on column public.products.disabled_optional_tools is
  'Optional first-party Studio Tool names the operator turned off (ADR-0081). Locked tools cannot appear here.';
