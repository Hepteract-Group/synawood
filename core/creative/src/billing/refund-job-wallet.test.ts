import { afterEach, describe, expect, it, vi } from 'vitest'
import { refundJobWallet, refundIdempotencyKey, shouldRefundOnJobFail } from './refund-job-wallet'

// --------------------------------------------------------------------------
// Test double helpers
// --------------------------------------------------------------------------

type LedgerRow = {
  id: string
  idempotency_key: string
  cost_event_id: string | null
  amount_gbp: number
  kind: string
  job_id: string | null
  product_id: string
}

const stubDb = (input?: {
  balanceGbp?: number
  existingDebit?: LedgerRow
  existingRefund?: LedgerRow
}) => {
  const balance = input?.balanceGbp ?? 20
  const wallet = { product_id: 'acme', balance_gbp: balance, updated_at: '2026-01-01T00:00:00Z' }
  const ledger: LedgerRow[] = []
  if (input?.existingDebit) ledger.push(input.existingDebit)
  if (input?.existingRefund) ledger.push(input.existingRefund)
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
          select: (_cols: string) => ({
            eq: (_col: string, val: string) => ({
              maybeSingle: async () => ({
                data: ledger.find((row) => row.idempotency_key === val) ?? null,
                error: null,
              }),
            }),
          }),
          insert: async (row: LedgerRow) => {
            ledger.push(row)
            return { error: null }
          },
        }
      }
      if (table === 'product_wallets') {
        return {
          select: (_cols: string) => ({
            eq: () => ({
              maybeSingle: async () => ({ data: wallet, error: null }),
            }),
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: async () => {
              if (typeof patch.balance_gbp === 'number') wallet.balance_gbp = patch.balance_gbp
              if (typeof patch.updated_at === 'string') wallet.updated_at = patch.updated_at
              return { error: null }
            },
          }),
        }
      }
      return {}
    },
  }

  return { client, wallet, ledger, auditEvents }
}

const baseDebit: LedgerRow = {
  id: 'led-debit-1',
  idempotency_key: 'debit:job-1',
  cost_event_id: 'ce-1',
  amount_gbp: -5,
  kind: 'debit',
  job_id: 'job-1',
  product_id: 'acme',
}

// --------------------------------------------------------------------------
// shouldRefundOnJobFail — pure predicate
// --------------------------------------------------------------------------

describe('shouldRefundOnJobFail (#1040)', () => {
  it('returns true for failed job with no vendor actual', () => {
    expect(shouldRefundOnJobFail({ status: 'failed', actualGbp: null })).toBe(true)
    expect(shouldRefundOnJobFail({ status: 'failed', actualGbp: 0 })).toBe(true)
  })

  it('returns true for cancelled job with no vendor actual', () => {
    expect(shouldRefundOnJobFail({ status: 'cancelled', actualGbp: null })).toBe(true)
    expect(shouldRefundOnJobFail({ status: 'cancelled', actualGbp: 0 })).toBe(true)
  })

  it('returns false when vendor actual > 0 (vendor was charged)', () => {
    expect(shouldRefundOnJobFail({ status: 'failed', actualGbp: 0.05 })).toBe(false)
    expect(shouldRefundOnJobFail({ status: 'failed', actualGbp: 5 })).toBe(false)
  })

  it('returns false for non-terminal statuses', () => {
    expect(shouldRefundOnJobFail({ status: 'ready', actualGbp: null })).toBe(false)
    expect(shouldRefundOnJobFail({ status: 'generating', actualGbp: null })).toBe(false)
    expect(shouldRefundOnJobFail({ status: 'queued', actualGbp: null })).toBe(false)
  })
})

// --------------------------------------------------------------------------
// refundIdempotencyKey — consistent key shape
// --------------------------------------------------------------------------

describe('refundIdempotencyKey (#1040)', () => {
  it('follows the refund:{debitLedgerId} pattern', () => {
    expect(refundIdempotencyKey('led-debit-1')).toBe('refund:led-debit-1')
  })
})

// --------------------------------------------------------------------------
// refundJobWallet — DB integration
// --------------------------------------------------------------------------

describe('refundJobWallet (#1040)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('refunds the debit and credits the wallet when job failed with no actual', async () => {
    vi.stubEnv('BILLING_MODE', 'on')
    const { client, wallet, ledger, auditEvents } = stubDb({
      balanceGbp: 15,
      existingDebit: baseDebit,
    })

    const result = await refundJobWallet(client as never, {
      productId: 'acme',
      jobId: 'job-1',
      status: 'failed',
      actualGbp: null,
    })

    expect(result.ok).toBe(true)
    if (!result.ok || result.skipped) throw new Error('expected non-skipped refund')
    expect(result.balanceGbp).toBe(20)
    expect(wallet.balance_gbp).toBe(20)
    expect(ledger).toHaveLength(2)
    expect(ledger[1]).toMatchObject({
      amount_gbp: 5,
      kind: 'refund',
      cost_event_id: 'ce-1',
      job_id: 'job-1',
      product_id: 'acme',
      idempotency_key: refundIdempotencyKey('led-debit-1'),
    })
    expect(auditEvents).toEqual([
      expect.objectContaining({
        product_id: 'acme',
        action: 'billing.wallet_refund',
        payload: expect.objectContaining({
          jobId: 'job-1',
          refundGbp: 5,
          balanceGbp: 20,
        }),
      }),
    ])
  })

  it('is a no-op when called a second time (idempotent)', async () => {
    vi.stubEnv('BILLING_MODE', 'on')
    const existingRefund: LedgerRow = {
      id: 'led-refund-1',
      idempotency_key: refundIdempotencyKey('led-debit-1'),
      cost_event_id: 'ce-1',
      amount_gbp: 5,
      kind: 'refund',
      job_id: 'job-1',
      product_id: 'acme',
    }
    const { client, wallet, ledger } = stubDb({
      balanceGbp: 20,
      existingDebit: baseDebit,
      existingRefund,
    })

    const result = await refundJobWallet(client as never, {
      productId: 'acme',
      jobId: 'job-1',
      status: 'failed',
      actualGbp: null,
    })

    expect(result.ok).toBe(true)
    if (!result.ok || result.skipped) throw new Error('expected non-skipped result')
    expect(result.ledgerId).toBe('led-refund-1')
    expect(ledger).toHaveLength(2)
    expect(wallet.balance_gbp).toBe(20)
  })

  it('skips when actual_gbp > 0 (vendor charged; no refund)', async () => {
    vi.stubEnv('BILLING_MODE', 'on')
    const { client, wallet, ledger } = stubDb({
      balanceGbp: 15,
      existingDebit: baseDebit,
    })

    const result = await refundJobWallet(client as never, {
      productId: 'acme',
      jobId: 'job-1',
      status: 'failed',
      actualGbp: 5,
    })

    expect(result).toEqual({ ok: true, skipped: true, reason: 'no_refund_needed' })
    expect(wallet.balance_gbp).toBe(15)
    expect(ledger).toHaveLength(1)
  })

  it('skips when no debit ledger entry exists for the job', async () => {
    vi.stubEnv('BILLING_MODE', 'on')
    const { client, wallet, ledger } = stubDb({ balanceGbp: 20 })

    const result = await refundJobWallet(client as never, {
      productId: 'acme',
      jobId: 'job-no-debit',
      status: 'failed',
      actualGbp: null,
    })

    expect(result).toEqual({ ok: true, skipped: true, reason: 'no_debit_found' })
    expect(wallet.balance_gbp).toBe(20)
    expect(ledger).toHaveLength(0)
  })

  it('skips when BILLING_MODE is off', async () => {
    vi.stubEnv('BILLING_MODE', 'off')
    const { client, wallet, ledger } = stubDb({
      balanceGbp: 15,
      existingDebit: baseDebit,
    })

    const result = await refundJobWallet(client as never, {
      productId: 'acme',
      jobId: 'job-1',
      status: 'failed',
      actualGbp: null,
    })

    expect(result).toEqual({ ok: true, skipped: true, reason: 'billing_off' })
    expect(wallet.balance_gbp).toBe(15)
    expect(ledger).toHaveLength(1)
  })

  it('skips without error when status is ready (job succeeded)', async () => {
    vi.stubEnv('BILLING_MODE', 'on')
    const { client, wallet, ledger } = stubDb({
      balanceGbp: 15,
      existingDebit: baseDebit,
    })

    const result = await refundJobWallet(client as never, {
      productId: 'acme',
      jobId: 'job-1',
      status: 'ready',
      actualGbp: 5,
    })

    expect(result).toEqual({ ok: true, skipped: true, reason: 'no_refund_needed' })
    expect(wallet.balance_gbp).toBe(15)
    expect(ledger).toHaveLength(1)
  })
})
