import { describe, expect, it } from 'vitest'
import { maxMonthlyCapGbp, validateMonthlyCapSetting } from './monthly-cap'

describe('monthly cap vs wallet (#1042)', () => {
  it('max is wallet remaining plus spent this period', () => {
    expect(maxMonthlyCapGbp({ walletBalanceGbp: 12.5, spentThisPeriodFromWalletGbp: 7.25 })).toBe(
      19.75,
    )
  })

  it('rejects a cap above wallet + spent with a readable error', () => {
    const result = validateMonthlyCapSetting({
      requestedCapGbp: 50,
      walletBalanceGbp: 10,
      spentThisPeriodFromWalletGbp: 5,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.maxAllowedGbp).toBe(15)
    expect(result.error).toMatch(/cannot exceed £15\.00/)
    expect(result.error).toMatch(/wallet £10\.00/)
    expect(result.error).toMatch(/£5\.00 already spent/)
  })

  it('accepts a cap at the max', () => {
    const result = validateMonthlyCapSetting({
      requestedCapGbp: 15,
      walletBalanceGbp: 10,
      spentThisPeriodFromWalletGbp: 5,
    })
    expect(result).toEqual({ ok: true, maxAllowedGbp: 15 })
  })

  it('accepts a cap below the max', () => {
    const result = validateMonthlyCapSetting({
      requestedCapGbp: 8,
      walletBalanceGbp: 10,
      spentThisPeriodFromWalletGbp: 5,
    })
    expect(result.ok).toBe(true)
  })

  it('accepts a zero cap (freeze myself)', () => {
    const result = validateMonthlyCapSetting({
      requestedCapGbp: 0,
      walletBalanceGbp: 10,
      spentThisPeriodFromWalletGbp: 0,
    })
    expect(result).toEqual({ ok: true, maxAllowedGbp: 10 })
  })

  it('rejects a negative cap', () => {
    const result = validateMonthlyCapSetting({
      requestedCapGbp: -1,
      walletBalanceGbp: 10,
      spentThisPeriodFromWalletGbp: 0,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/£0 or more/)
  })
})
