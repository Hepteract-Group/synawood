import { afterEach, describe, expect, it, vi } from 'vitest'
import { debitForJob, debitIdempotencyKey } from './debit-for-job'

const stubDb = (input?: {
  balanceGbp?: number
  existingDebit?: boolean
  walletUpdatedBeforeLedger?: boolean
  existingCostEvent?: boolean
}) => {
  const balance = input?.balanceGbp ?? 20
  const wallet = {
    product_id: 'acme',
    balance_gbp: balance,
    updated_at: input?.walletUpdatedBeforeLedger
      ? '2020-01-01T00:00:00.000Z'
      : '2026-01-02T00:00:00.000Z',
  }
  const ledger: Record<string, unknown>[] = input?.existingDebit
    ? [
        {
          id: 'led-existing',
          idempotency_key: debitIdempotencyKey('job-1'),
          cost_event_id: 'ce-existing',
          amount_gbp: -5,
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ]
    : []
  const costEvents: Record<string, unknown>[] = input?.existingCostEvent
    ? [{ id: 'ce-existing', job_id: 'job-1' }]
    : []
  const auditEvents: Record<string, unknown>[] = []

  const client = {
    from: (table: string) => {
      if (table === 'audit_events') {
        return {
          insert: async (row: Record<string, unknown>) => {
            auditEvents.push(row)
            return { error: null }
          },
        }
      }
      if (table === 'wallet_ledger') {
        return {
          select: () => ({
            eq: (_col: string, key: string) => ({
              maybeSingle: async () => ({
                data: ledger.find((row) => row.idempotency_key === key) ?? null,
                error: null,
              }),
            }),
          }),
          insert: async (row: Record<string, unknown>) => {
            ledger.push(row)
            return { error: null }
          },
        }
      }
      if (table === 'product_wallets') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: wallet, error: null }),
            }),
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: async () => {
              if (typeof patch.balance_gbp === 'number') {
                wallet.balance_gbp = patch.balance_gbp
              }
              if (typeof patch.updated_at === 'string') {
                wallet.updated_at = patch.updated_at
              }
              return { error: null }
            },
          }),
        }
      }
      if (table === 'cost_events') {
        return {
          select: () => ({
            eq: (_col: string, jobId: string) => ({
              maybeSingle: async () => ({
                data: costEvents.find((row) => row.job_id === jobId) ?? null,
                error: null,
              }),
            }),
          }),
          insert: async (row: Record<string, unknown>) => {
            costEvents.push(row)
            return { error: null }
          },
        }
      }
      return {}
    },
  }

  return { client, wallet, ledger, costEvents, auditEvents }
}

describe('debitForJob (#1039)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('debits £5 from £20 when confirmSpend is true', async () => {
    vi.stubEnv('BILLING_MODE', 'on')
    const { client, wallet, ledger, auditEvents } = stubDb({ balanceGbp: 20 })
    const result = await debitForJob(client as never, {
      productId: 'acme',
      projectId: 'proj-1',
      jobId: 'job-1',
      role: 'video',
      modelId: 'veo-2',
      units: 8,
      estimatedGbp: 5,
      confirmSpend: true,
    })
    expect(result.ok).toBe(true)
    if (!result.ok || result.skipped) return
    expect(result.balanceGbp).toBe(15)
    expect(wallet.balance_gbp).toBe(15)
    expect(ledger).toHaveLength(1)
    expect(ledger[0]).toMatchObject({
      amount_gbp: -5,
      kind: 'debit',
      idempotency_key: 'debit:job-1',
      job_id: 'job-1',
    })
    expect(auditEvents).toEqual([
      expect.objectContaining({
        product_id: 'acme',
        action: 'billing.wallet_debit',
        payload: expect.objectContaining({
          jobId: 'job-1',
          estimatedGbp: 5,
          balanceGbp: 15,
        }),
      }),
    ])
  })

  it('does not debit twice for the same jobId', async () => {
    vi.stubEnv('BILLING_MODE', 'on')
    const { client, wallet, ledger } = stubDb({ balanceGbp: 20, existingDebit: true })
    wallet.balance_gbp = 15
    const result = await debitForJob(client as never, {
      productId: 'acme',
      jobId: 'job-1',
      role: 'video',
      estimatedGbp: 5,
      confirmSpend: true,
    })
    expect(result.ok).toBe(true)
    if (!result.ok || result.skipped) return
    expect(result.costEventId).toBe('ce-existing')
    expect(ledger).toHaveLength(1)
    expect(wallet.balance_gbp).toBe(15)
  })

  it('skips debit when confirmSpend is false even if estimate > 0', async () => {
    vi.stubEnv('BILLING_MODE', 'on')
    const { client, wallet, ledger } = stubDb({ balanceGbp: 20 })
    const result = await debitForJob(client as never, {
      productId: 'acme',
      jobId: 'job-1',
      role: 'video',
      estimatedGbp: 5,
      confirmSpend: false,
    })
    expect(result).toEqual({ ok: true, skipped: true })
    expect(wallet.balance_gbp).toBe(20)
    expect(ledger).toHaveLength(0)
  })

  it('refuses debit when balance is too low', async () => {
    vi.stubEnv('BILLING_MODE', 'on')
    const { client, wallet, ledger, auditEvents } = stubDb({ balanceGbp: 3 })
    const result = await debitForJob(client as never, {
      productId: 'acme',
      jobId: 'job-1',
      role: 'video',
      estimatedGbp: 5,
      confirmSpend: true,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('wallet_insufficient')
    expect(wallet.balance_gbp).toBe(3)
    expect(ledger).toHaveLength(0)
    expect(auditEvents).toEqual([
      expect.objectContaining({
        product_id: 'acme',
        action: 'billing.wallet_blocked',
        payload: expect.objectContaining({
          jobId: 'job-1',
          estimatedGbp: 5,
          balanceGbp: 3,
        }),
      }),
    ])
  })

  it('skips when BILLING_MODE is off', async () => {
    vi.stubEnv('BILLING_MODE', 'off')
    const { client, wallet, ledger } = stubDb({ balanceGbp: 20 })
    const result = await debitForJob(client as never, {
      productId: 'acme',
      jobId: 'job-1',
      role: 'video',
      estimatedGbp: 5,
      confirmSpend: true,
    })
    expect(result).toEqual({ ok: true, skipped: true })
    expect(wallet.balance_gbp).toBe(20)
    expect(ledger).toHaveLength(0)
  })

  it('reuses existing cost event when ledger insert failed mid-flight', async () => {
    vi.stubEnv('BILLING_MODE', 'on')
    const { client, wallet, ledger, costEvents } = stubDb({
      balanceGbp: 20,
      existingCostEvent: true,
    })
    const result = await debitForJob(client as never, {
      productId: 'acme',
      jobId: 'job-1',
      role: 'video',
      estimatedGbp: 5,
      confirmSpend: true,
    })
    expect(result.ok).toBe(true)
    if (!result.ok || result.skipped) return
    expect(result.costEventId).toBe('ce-existing')
    expect(costEvents).toHaveLength(1)
    expect(ledger).toHaveLength(1)
    expect(wallet.balance_gbp).toBe(15)
  })

  it('completes wallet update when ledger exists but wallet was not decremented', async () => {
    vi.stubEnv('BILLING_MODE', 'on')
    const { client, wallet, ledger } = stubDb({
      balanceGbp: 20,
      existingDebit: true,
      walletUpdatedBeforeLedger: true,
    })
    const result = await debitForJob(client as never, {
      productId: 'acme',
      jobId: 'job-1',
      role: 'video',
      estimatedGbp: 5,
      confirmSpend: true,
    })
    expect(result.ok).toBe(true)
    if (!result.ok || result.skipped) return
    expect(wallet.balance_gbp).toBe(15)
    expect(ledger).toHaveLength(1)
  })
})
