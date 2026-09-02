import { describe, expect, it, vi } from 'vitest'
import {
  billingEventAction,
  hasBillingEvent,
  recordBillingEvent,
  recordBillingEventBestEffort,
  recordBillingEventOnce,
} from './events'

const auditStub = () => {
  const rows: { product_id: string; action: string }[] = []
  let insertShouldFail = false
  const client = {
    from: (table: string) => {
      if (table !== 'audit_events') return {}
      return {
        insert: async (row: Record<string, unknown>) => {
          if (insertShouldFail) return { error: { message: 'rls' } }
          rows.push(row as { product_id: string; action: string })
          return { error: null }
        },
        select: () => ({
          eq: (col: string, val: string) => ({
            eq: (_col2: string, action: string) => ({
              limit: () => ({
                maybeSingle: async () => {
                  const hit = rows.find((row) => {
                    if (col === 'product_id') return row.product_id === val && row.action === action
                    return row.action === val
                  })
                  return { data: hit ? { id: 'e1' } : null, error: null }
                },
              }),
            }),
          }),
        }),
      }
    },
    failNextInsert: () => {
      insertShouldFail = true
    },
  }
  return { client, rows }
}

describe('recordBillingEvent (#1061)', () => {
  it('writes billing.* actions to audit_events', async () => {
    const insert = vi.fn(async () => ({ error: null }))
    const supabase = { from: () => ({ insert }) } as never
    await recordBillingEvent(supabase, {
      productId: 'acme',
      actorUserId: 'u1',
      name: 'org_created',
      payload: { slug: 'acme' },
    })
    expect(insert).toHaveBeenCalledWith({
      product_id: 'acme',
      actor_user_id: 'u1',
      action: 'billing.org_created',
      payload: { slug: 'acme' },
    })
  })

  it('names wallet events with the billing prefix', () => {
    expect(billingEventAction('wallet_debit')).toBe('billing.wallet_debit')
    expect(billingEventAction('wallet_blocked')).toBe('billing.wallet_blocked')
  })
})

describe('recordBillingEventOnce (#1061)', () => {
  it('inserts only the first org_created for a Product', async () => {
    const { client, rows } = auditStub()
    const first = await recordBillingEventOnce(client as never, {
      productId: 'acme',
      name: 'org_created',
    })
    const second = await recordBillingEventOnce(client as never, {
      productId: 'acme',
      name: 'org_created',
    })
    expect(first).toBe(true)
    expect(second).toBe(false)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.action).toBe('billing.org_created')
  })

  it('detects an existing billing event', async () => {
    const { client, rows } = auditStub()
    rows.push({ product_id: 'acme', action: 'billing.wallet_debit' })
    await expect(
      hasBillingEvent(client as never, { productId: 'acme', name: 'wallet_debit' }),
    ).resolves.toBe(true)
    await expect(
      hasBillingEvent(client as never, { productId: 'acme', name: 'wallet_blocked' }),
    ).resolves.toBe(false)
  })
})

describe('recordBillingEventBestEffort (#1061)', () => {
  it('does not throw when audit insert fails', async () => {
    const { client } = auditStub()
    ;(client as { failNextInsert: () => void }).failNextInsert()
    await expect(
      recordBillingEventBestEffort(client as never, {
        productId: 'acme',
        name: 'wallet_blocked',
      }),
    ).resolves.toBeUndefined()
  })
})
