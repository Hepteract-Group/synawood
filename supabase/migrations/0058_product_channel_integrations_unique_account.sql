-- #798: one Postiz account per Product. Same integration cannot map to two Synawood channels.
-- Keep the newest binding per account, then add the unique constraint (idempotent).

delete from public.product_channel_integrations
where id in (
  select id
  from (
    select id,
      row_number() over (
        partition by product_id, postiz_integration_id
        order by updated_at desc, created_at desc, id
      ) as rn
    from public.product_channel_integrations
  ) ranked
  where rn > 1
);

alter table public.product_channel_integrations
  drop constraint if exists product_channel_integrations_product_integration_key;

alter table public.product_channel_integrations
  add constraint product_channel_integrations_product_integration_key
  unique (product_id, postiz_integration_id);
