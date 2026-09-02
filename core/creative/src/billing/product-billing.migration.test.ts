import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  path.join(process.cwd(), '../../supabase/migrations/0059_product_billing.sql'),
  'utf8',
)

describe('product_billing migration (#1033)', () => {
  it('creates billing, wallet, and ledger with member-read RLS', () => {
    expect(sql).toContain('create table public.product_billing')
    expect(sql).toContain('create table public.product_wallets')
    expect(sql).toContain('create table public.wallet_ledger')
    expect(sql).toContain('product_id text not null')
    expect(sql).toMatch(/plan_id text not null/)
    expect(sql).toContain("plan_id in ('trial', 'studio', 'team')")
    expect(sql).toContain("status in ('trialing', 'active', 'past_due', 'canceled', 'expired')")
    expect(sql).toContain('generation_frozen boolean not null default false')
    expect(sql).toContain('seat_limit integer not null')
    expect(sql).toContain('trial_ends_at timestamptz')
    expect(sql).toContain('balance_gbp numeric(12,4) not null')
    expect(sql).toMatch(/balance_gbp >= 0/)
    expect(sql).toMatch(/kind in \('grant', 'debit', 'refund', 'pack', 'adjustment'\)/)
    expect(sql).toContain('idempotency_key text not null unique')
    expect(sql).toMatch(/alter table public\.product_billing enable row level security/i)
    expect(sql).toMatch(/alter table public\.product_wallets enable row level security/i)
    expect(sql).toMatch(/alter table public\.wallet_ledger enable row level security/i)
    expect(sql).toMatch(/is_product_member\(product_id, 'viewer'\)/)
    expect(sql).toMatch(/grant select on public\.product_billing to authenticated/)
    expect(sql).toMatch(
      /grant select, insert, update, delete on public\.product_billing to service_role/,
    )
    expect(sql).not.toMatch(
      /grant (insert|update|delete) on public\.product_billing to authenticated/,
    )
    expect(sql).not.toMatch(/for (insert|update|delete|all) to authenticated/)
    expect(sql).not.toMatch(/freelanceCreative/)
  })
})

describe('product_billing monthly cap migration (#1042)', () => {
  it('adds monthly_generator_cap_gbp with a £100 default', () => {
    const capSql = readFileSync(
      path.join(process.cwd(), '../../supabase/migrations/0063_product_billing_monthly_cap.sql'),
      'utf8',
    )
    expect(capSql).toContain('monthly_generator_cap_gbp numeric(12,4) not null default 100')
    expect(capSql).toMatch(/alter table public\.product_billing/i)
  })
})
