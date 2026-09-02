-- #1042 Per-org monthly generator cap (ADR-0082 §5). Default matches env/founder budget.

alter table public.product_billing
  add column if not exists monthly_generator_cap_gbp numeric(12,4) not null default 100;

comment on column public.product_billing.monthly_generator_cap_gbp is
  'Org settings monthly generator cap in GBP. Must stay ≤ wallet remaining + spent this period.';
