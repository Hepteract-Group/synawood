import { describe, expect, it } from 'vitest'
import { DEFAULT_CREATIVE_BUDGETS } from '../pricing/limits'
import { gateHostedSpend, hostedSpendHttpStatus } from './gate'

const base = {
  estimatedGbp: 5,
  spentThisMonthGbp: 0,
  spentThisWeekGbp: 0,
  spentThisProjectGbp: 0,
  budgets: DEFAULT_CREATIVE_BUDGETS,
  requireConfirm: false,
  generationFrozen: false,
  spentThisMonthFromWalletGbp: 0,
}

describe('gateHostedSpend (#1038)', () => {
  it('returns 402 wallet_insufficient when the estimate exceeds the wallet', () => {
    const gate = gateHostedSpend({ ...base, walletBalanceGbp: 3 })
    expect(gate.ok).toBe(false)
    if (gate.ok) return
    expect(gate.code).toBe('wallet_insufficient')
    expect(hostedSpendHttpStatus(gate)).toBe(402)
  })

  it('keeps confirm/soft-cap when the wallet covers', () => {
    const covered = gateHostedSpend({
      ...base,
      walletBalanceGbp: 20,
      requireConfirm: true,
      spentThisWeekGbp: 24,
    })
    expect(covered.ok).toBe(false)
    if (covered.ok) return
    expect(covered.code).toBe('needs_confirm')

    const confirmed = gateHostedSpend({
      ...base,
      walletBalanceGbp: 20,
      requireConfirm: true,
      confirmSpend: true,
      spentThisWeekGbp: 24,
    })
    expect(confirmed.ok).toBe(true)
  })

  it('maps a remaining monthly miss to monthly_cap after the wallet covers', () => {
    const gate = gateHostedSpend({
      ...base,
      walletBalanceGbp: 20,
      spentThisMonthGbp: 98,
      spentThisMonthFromWalletGbp: 98,
    })
    expect(gate.ok).toBe(false)
    if (gate.ok) return
    expect(gate.code).toBe('monthly_cap')
    expect(hostedSpendHttpStatus(gate)).toBe(400)
  })

  it('treats generation_frozen as false until a freeze row says otherwise', () => {
    const open = gateHostedSpend({ ...base, walletBalanceGbp: 20 })
    expect(open.ok).toBe(true)
    const frozen = gateHostedSpend({ ...base, walletBalanceGbp: 20, generationFrozen: true })
    expect(frozen.ok).toBe(false)
    if (frozen.ok) return
    expect(frozen.code).toBe('generation_frozen')
    expect(hostedSpendHttpStatus(frozen)).toBe(403)
  })

  it('uses min(settings cap, wallet+spent) as the effective monthly ceiling (#1042)', () => {
    const gate = gateHostedSpend({
      ...base,
      estimatedGbp: 4,
      walletBalanceGbp: 50,
      spentThisMonthGbp: 8,
      spentThisMonthFromWalletGbp: 8,
      budgets: { ...DEFAULT_CREATIVE_BUDGETS, monthlyGeneratorCap: 10 },
      requireConfirm: false,
      confirmSpend: true,
    })
    expect(gate.ok).toBe(false)
    if (gate.ok) return
    expect(gate.code).toBe('monthly_cap')
  })

  it('blocks paid hosted video on trial (#1043)', () => {
    const gate = gateHostedSpend({
      ...base,
      walletBalanceGbp: 50,
      planId: 'trial',
      role: 'video',
      modelId: 'google/veo-3.1-fast-generate-001',
    })
    expect(gate.ok).toBe(false)
    if (gate.ok) return
    expect(gate.code).toBe('trial_paid_video')
    expect(hostedSpendHttpStatus(gate)).toBe(403)
    expect(gate.error).toMatch(/Paid video is off on the trial/)
  })

  it('allows paid video on studio plan when the wallet covers (#1043)', () => {
    const gate = gateHostedSpend({
      ...base,
      walletBalanceGbp: 50,
      planId: 'studio',
      role: 'video',
      modelId: 'google/veo-3.1-fast-generate-001',
      requireConfirm: false,
    })
    expect(gate.ok).toBe(true)
  })

  it('does not treat mock video as paid hosted (#1043)', () => {
    const gate = gateHostedSpend({
      ...base,
      walletBalanceGbp: 50,
      planId: 'trial',
      role: 'video',
      modelId: 'mock-video',
      requireConfirm: false,
    })
    expect(gate.ok).toBe(true)
  })

  it('allows paid video for unknown plan ids (fail-open)', () => {
    const gate = gateHostedSpend({
      ...base,
      walletBalanceGbp: 50,
      planId: 'legacy',
      role: 'video',
      modelId: 'google/veo-3.1-fast-generate-001',
      requireConfirm: false,
    })
    expect(gate.ok).toBe(true)
  })
})
