import { describe, expect, it } from 'vitest'
import { ensureTrialBilling, trialEndsAt } from './ensure-trial'

const stubDb = () => {
  const rows: Record<string, Record<string, unknown>[]> = {
    product_billing: [],
    product_wallets: [],
  }
  const client = {
    from: (table: string) => ({
      upsert: async (
        row: Record<string, unknown>,
        opts: { onConflict: string; ignoreDuplicates: boolean },
      ) => {
        if (opts.onConflict !== 'product_id' || opts.ignoreDuplicates !== true) {
          return { error: { message: 'expected ignoreDuplicates on product_id' } }
        }
        const list = rows[table]
        if (!list) return { error: { message: `unexpected table ${table}` } }
        if (!list.some((existing) => existing.product_id === row.product_id)) {
          list.push(row)
        }
        return { error: null }
      },
    }),
  }
  return { client, rows }
}

describe('ensureTrialBilling (#1034)', () => {
  it('inserts trial billing and a zero wallet; a second call does not duplicate', async () => {
    const { client, rows } = stubDb()
    const now = new Date('2026-08-26T12:00:00.000Z')
    await ensureTrialBilling(client as never, { productId: 'acme', now })
    await ensureTrialBilling(client as never, { productId: 'acme', now })
    expect(rows.product_billing).toHaveLength(1)
    expect(rows.product_wallets).toHaveLength(1)
    expect(rows.product_billing[0]).toMatchObject({
      product_id: 'acme',
      plan_id: 'trial',
      status: 'trialing',
      seat_limit: 3,
      trial_ends_at: '2026-09-09T12:00:00.000Z',
      included_grant_gbp: 0,
      generation_frozen: false,
    })
    expect(rows.product_wallets[0]).toMatchObject({
      product_id: 'acme',
      balance_gbp: 0,
    })
    expect(trialEndsAt(now)).toBe('2026-09-09T12:00:00.000Z')
  })
})
