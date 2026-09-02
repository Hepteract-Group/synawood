export type CreativeBudgetsGbp = {
  monthlyGeneratorCap: number
  weeklySoftCap: number
  perProjectWarnGbp: number
}

/** Defaults derived from the private example freelanceCreative + tools budgets. */
export const DEFAULT_CREATIVE_BUDGETS: CreativeBudgetsGbp = {
  monthlyGeneratorCap: 100,
  weeklySoftCap: 25,
  perProjectWarnGbp: 5,
}

export const readCreativeBudgets = (
  env: Record<string, string | undefined> = process.env,
): CreativeBudgetsGbp => {
  const parse = (raw: string | undefined, fallback: number): number => {
    if (raw === undefined || raw === '') return fallback
    const value = Number(raw)
    return Number.isFinite(value) ? value : fallback
  }
  return {
    monthlyGeneratorCap: parse(
      env.STUDIO_MONTHLY_GENERATOR_CAP_GBP,
      DEFAULT_CREATIVE_BUDGETS.monthlyGeneratorCap,
    ),
    weeklySoftCap: parse(env.STUDIO_WEEKLY_SOFT_CAP_GBP, DEFAULT_CREATIVE_BUDGETS.weeklySoftCap),
    perProjectWarnGbp: parse(
      env.STUDIO_PER_PROJECT_WARN_GBP,
      DEFAULT_CREATIVE_BUDGETS.perProjectWarnGbp,
    ),
  }
}

export type SpendGateResult =
  { ok: true; remainingMonthlyGbp: number } | { ok: false; error: string }

export const gateSpend = (input: {
  estimatedGbp: number
  spentThisMonthGbp: number
  spentThisWeekGbp: number
  spentThisProjectGbp: number
  budgets: CreativeBudgetsGbp
  /** Video (and other expensive roles) require explicit confirmation above soft caps. */
  requireConfirm: boolean
  confirmSpend?: boolean
  suggestProfile?: string
}): SpendGateResult => {
  const remainingMonthly = input.budgets.monthlyGeneratorCap - input.spentThisMonthGbp
  if (input.estimatedGbp > 0 && input.estimatedGbp > remainingMonthly) {
    return {
      ok: false,
      error: `Estimated £${input.estimatedGbp.toFixed(2)} would breach the monthly generator cap (£${input.budgets.monthlyGeneratorCap}). Remaining ~£${Math.max(0, remainingMonthly).toFixed(2)}. Switch to seedream-lite or use Brand kit stills.`,
    }
  }
  const overSoft =
    input.spentThisWeekGbp + input.estimatedGbp > input.budgets.weeklySoftCap ||
    input.spentThisProjectGbp + input.estimatedGbp > input.budgets.perProjectWarnGbp
  if (input.requireConfirm && overSoft && !input.confirmSpend) {
    return {
      ok: false,
      error: `Estimated £${input.estimatedGbp.toFixed(2)} needs confirmSpend=true (weekly soft £${input.budgets.weeklySoftCap} / project warn £${input.budgets.perProjectWarnGbp}).${input.suggestProfile ? ` Or switch profile to ${input.suggestProfile}.` : ''}`,
    }
  }
  return { ok: true, remainingMonthlyGbp: remainingMonthly - input.estimatedGbp }
}
