/** Pure monthly-cap setting rules (ADR-0082 §5, #1042). */

export type MonthlyCapContext = {
  walletBalanceGbp: number
  spentThisPeriodFromWalletGbp: number
}

export type MonthlyCapValidation =
  { ok: true; maxAllowedGbp: number } | { ok: false; maxAllowedGbp: number; error: string }

/** Hard ceiling: wallet left + already spent from wallet this period. */
export const maxMonthlyCapGbp = (ctx: MonthlyCapContext): number => {
  const wallet = Number.isFinite(ctx.walletBalanceGbp) ? Math.max(0, ctx.walletBalanceGbp) : 0
  const spent = Number.isFinite(ctx.spentThisPeriodFromWalletGbp)
    ? Math.max(0, ctx.spentThisPeriodFromWalletGbp)
    : 0
  return Number((wallet + spent).toFixed(4))
}

export const validateMonthlyCapSetting = (input: {
  requestedCapGbp: number
  walletBalanceGbp: number
  spentThisPeriodFromWalletGbp: number
}): MonthlyCapValidation => {
  const maxAllowedGbp = maxMonthlyCapGbp({
    walletBalanceGbp: input.walletBalanceGbp,
    spentThisPeriodFromWalletGbp: input.spentThisPeriodFromWalletGbp,
  })
  if (!Number.isFinite(input.requestedCapGbp) || input.requestedCapGbp < 0) {
    return {
      ok: false,
      maxAllowedGbp,
      error: 'Monthly cap must be a number of £0 or more.',
    }
  }
  const requested = Number(input.requestedCapGbp.toFixed(4))
  if (requested > maxAllowedGbp) {
    return {
      ok: false,
      maxAllowedGbp,
      error: `Cap cannot exceed £${maxAllowedGbp.toFixed(2)} (wallet £${Number(input.walletBalanceGbp).toFixed(2)} + £${Number(input.spentThisPeriodFromWalletGbp).toFixed(2)} already spent this period).`,
    }
  }
  return { ok: true, maxAllowedGbp }
}
