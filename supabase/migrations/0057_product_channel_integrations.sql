-- #797 product_channel_integrations (ADR-0064). Synawood channel → Postiz integration id.
-- Organic channels only. Credentials remain in Postiz.

create table public.product_channel_integrations (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id) on delete cascade,
  channel text not null
    check (channel in ('x_founder', 'linkedin_founder', 'tiktok_organic')),
  postiz_integration_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, channel)
);

create index product_channel_integrations_product_id_idx
  on public.product_channel_integrations (product_id);

comment on table public.product_channel_integrations is
  'Product-scoped map from Synawood organic channel to a Postiz integration id (ADR-0064). Credentials remain in Postiz.';

alter table public.product_channel_integrations enable row level security;

grant select, insert, update, delete on public.product_channel_integrations to service_role;

create policy product_channel_integrations_select on public.product_channel_integrations
  for select to authenticated
  using (public.is_product_member(product_id, 'viewer'));

create policy product_channel_integrations_write on public.product_channel_integrations
  for all to authenticated
  using (public.is_product_member(product_id, 'editor'))
  with check (public.is_product_member(product_id, 'editor'));

grant select, insert, update, delete on public.product_channel_integrations to authenticated;
