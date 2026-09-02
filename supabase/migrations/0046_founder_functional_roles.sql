-- Wave 2G / ADR-0037 / #271 — founder default functional roles.
-- Must run after 0045. Existing owners become founder; editors stay editor;
-- viewers become analyst. After backfill the column is required.

update public.product_members
set functional_role = case role
  when 'owner' then 'founder'
  when 'editor' then 'editor'
  else 'analyst'
end
where functional_role is null;

update public.product_invites
set functional_role = case role
  when 'editor' then 'editor'
  else 'analyst'
end
where functional_role is null;

alter table public.product_members
  alter column functional_role set default 'editor';

alter table public.product_members
  alter column functional_role set not null;

comment on column public.product_members.functional_role is
  'Job function (ADR-0037). Backfilled #271: owner→founder, editor→editor, viewer→analyst.';
