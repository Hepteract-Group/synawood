import { describe, expect, it } from 'vitest'
import { debitWallet, emptyWallet, getBalance, grantWallet, refundWallet } from './wallet'

describe('wallet helpers (#1036)', () => {
  it('debits then refunds the same balance; a second refund is a no-op', () => {
    let state = emptyWallet('acme', 20)
    const debit = debitWallet(state, {
      estimatedGbp: 5,
      costEventId: 'ce-1',
      jobId: 'job-1',
      idempotencyKey: 'debit:job-1',
      ledgerId: 'led-debit',
    })
    expect(debit.ok).toBe(true)
    if (!debit.ok) return
    state = debit.state
    expect(getBalance(state)).toBe(15)

    const refund = refundWallet(state, {
      debitLedgerId: 'led-debit',
      idempotencyKey: 'refund:led-debit',
      ledgerId: 'led-refund',
    })
    expect(refund.ok).toBe(true)
    if (!refund.ok) return
    state = refund.state
    expect(getBalance(state)).toBe(20)

    const again = refundWallet(state, {
      debitLedgerId: 'led-debit',
      idempotencyKey: 'refund:led-debit',
      ledgerId: 'led-refund-2',
    })
    expect(again.ok).toBe(true)
    if (!again.ok) return
    expect(getBalance(again.state)).toBe(20)
    expect(again.state.ledger.filter((row) => row.kind === 'refund')).toHaveLength(1)
  })

  it('refuses a debit that would go negative without writing a row', () => {
    const start = emptyWallet('acme', 3)
    const debit = debitWallet(start, {
      estimatedGbp: 5,
      costEventId: 'ce-1',
      idempotencyKey: 'debit:job-1',
      ledgerId: 'led-debit',
    })
    expect(debit.ok).toBe(false)
    if (debit.ok) return
    expect(debit.code).toBe('wallet_insufficient')
    expect(getBalance(start)).toBe(3)
    expect(start.ledger).toHaveLength(0)
  })

  it('grants are idempotent on the same key', () => {
    let state = emptyWallet('acme', 0)
    const first = grantWallet(state, {
      amountGbp: 25,
      idempotencyKey: 'grant:period-1',
      ledgerId: 'led-grant',
    })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    state = first.state
    const second = grantWallet(state, {
      amountGbp: 25,
      idempotencyKey: 'grant:period-1',
      ledgerId: 'led-grant-2',
    })
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(getBalance(second.state)).toBe(25)
    expect(second.state.ledger).toHaveLength(1)
  })
})
