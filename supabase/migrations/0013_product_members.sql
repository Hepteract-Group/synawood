-- Plan 07 / #99 — Product membership (ADR-0024).
-- Product is the tenancy unit. Example products are data, not seed.
--
-- OPTIONAL DEV CONVENIENCE (not required for productization):
-- After the founder Auth user exists, attach them as owner of a Product they created:
--   insert into public.product_members (user_id, product_id, role)
--   select id, '<product-id>', 'owner' from auth.users
--   where lower(email) = lower('founder@example.com')
--   on conflict (user_id, product_id) do nothing;
-- Production path: signup → create Product (#103) → creator is owner.

create table public.product_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id text not null references public.products (id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create index product_members_product_id_idx on public.product_members (product_id);
create index product_members_user_id_idx on public.product_members (user_id);

-- Invites for #103 (Members UI). Token is opaque; email normalized lowercase.
create table public.product_invites (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id) on delete cascade,
  email text not null,
  role text not null check (role in ('editor', 'viewer')),
  token text not null unique,
  invited_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index product_invites_product_id_idx on public.product_invites (product_id);
create index product_invites_email_idx on public.product_invites (lower(email));

alter table public.product_members enable row level security;
alter table public.product_invites enable row level security;

-- Role rank: viewer < editor < owner
create or replace function public.product_role_rank(p_role text)
returns integer
language sql
immutable
as $$
  select case p_role
    when 'viewer' then 1
    when 'editor' then 2
    when 'owner' then 3
    else 0
  end;
$$;

-- True when the JWT user is a member of product at or above min role.
-- security definer so it can be reused by later table policies without recursion.
create or replace function public.is_product_member(
  p_product_id text,
  p_min_role text default 'viewer'
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.product_members m
    where m.user_id = auth.uid()
      and m.product_id = p_product_id
      and public.product_role_rank(m.role) >= public.product_role_rank(p_min_role)
  );
$$;

revoke all on function public.product_role_rank(text) from public;
revoke all on function public.is_product_member(text, text) from public;
grant execute on function public.product_role_rank(text) to authenticated, service_role;
grant execute on function public.is_product_member(text, text) to authenticated, service_role;

-- Members: users read their own rows; writes stay service_role / future owner APIs.
create policy product_members_select_own
  on public.product_members
  for select
  to authenticated
  using (user_id = auth.uid());

-- Invites: members of the Product (editor+) can read invites for that Product.
create policy product_invites_select_members
  on public.product_invites
  for select
  to authenticated
  using (public.is_product_member(product_id, 'editor'));

grant select on public.product_members to authenticated;
grant select on public.product_invites to authenticated;

grant select, insert, update, delete on public.product_members to service_role;
grant select, insert, update, delete on public.product_invites to service_role;
