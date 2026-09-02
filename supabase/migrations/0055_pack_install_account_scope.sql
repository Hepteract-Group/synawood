-- #954 Account vs Product pack install scope (ADR-0080).

alter table public.pack_installs
  alter column product_id drop not null;

alter table public.pack_installs
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table public.pack_installs
  drop constraint if exists pack_installs_product_id_pack_version_id_key;

alter table public.pack_installs
  drop constraint if exists pack_installs_scope_xor;

alter table public.pack_installs
  add constraint pack_installs_scope_xor check (
    (product_id is not null and user_id is null)
    or (product_id is null and user_id is not null)
  );

create unique index if not exists pack_installs_product_version_uidx
  on public.pack_installs (product_id, pack_version_id)
  where product_id is not null;

create unique index if not exists pack_installs_user_version_uidx
  on public.pack_installs (user_id, pack_version_id)
  where user_id is not null;

create index if not exists pack_installs_user_id_idx on public.pack_installs (user_id);

comment on column public.pack_installs.user_id is
  'Account-scoped install (this user, every Product they can edit). XOR with product_id.';

-- Service-role dashboard is the v1 writer. Authenticated policies still fail closed.
drop policy if exists pack_installs_select on public.pack_installs;
create policy pack_installs_select on public.pack_installs
  for select to authenticated
  using (
    (product_id is not null and public.is_product_member(product_id, 'viewer'))
    or (user_id is not null and user_id = auth.uid())
  );

drop policy if exists pack_installs_write on public.pack_installs;
create policy pack_installs_write on public.pack_installs
  for all to authenticated
  using (
    (product_id is not null and public.is_product_member(product_id, 'editor'))
    or (user_id is not null and user_id = auth.uid())
  )
  with check (
    (product_id is not null and public.is_product_member(product_id, 'editor'))
    or (user_id is not null and user_id = auth.uid())
  );

grant select, insert, update, delete on public.pack_installs to authenticated;
