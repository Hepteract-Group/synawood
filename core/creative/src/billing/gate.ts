import type { SupabaseClient } from '@supabase/supabase-js'
import {
  gateSpend,
  readCreativeBudgets,
  type CreativeBudgetsGbp,
  type SpendGateResult,
} from '../pricing/limits'
import { isPaidHostedVideoModel } from '../model-profiles/video-models'
import { isBillingEnabled } from './billing-mode'
import { HOSTED_PLANS, type HostedPlanId } from './plans'
import { loadHostedSpendContext } from './load-hosted-spend-context'

export type HostedSpendErrorCode =
  'generation_frozen' | 'trial_paid_video' | 'wallet_insufficient' | 'monthly_cap' | 'needs_confirm'

export type HostedSpendInput = {
  estimatedGbp: number
  spentThisMonthGbp: number
  spentThisWeekGbp: number
  spentThisProjectGbp: number
  budgets: CreativeBudgetsGbp
  requireConfirm: boolean
  confirmSpend?: boolean
  walletBalanceGbp: number
  generationFrozen: boolean
  spentThisMonthFromWalletGbp: number
  suggestProfile?: string
  /** product_billing.plan_id when known. */
  planId?: string | null
  /** Generator role for this spend (video triggers trial paid-video gate). */
  role?: string | null
  modelId?: string | null
}

export type HostedSpendResult =
  | { ok: true; remainingMonthlyGbp: number }
  | {
      ok: false
      code: HostedSpendErrorCode
      error: string
      estimateGbp: number
      walletGbp: number
    }

export const TRIAL_PAID_VIDEO_MESSAGE =
  'Paid video is off on the trial. Upload a talking-head take, or use stills. Upgrade to Studio to generate video with our keys.'

const fail = (
  input: HostedSpendInput,
  code: HostedSpendErrorCode,
  error: string,
): HostedSpendResult => ({
  ok: false,
  code,
  error,
  estimateGbp: input.estimatedGbp,
  walletGbp: input.walletBalanceGbp,
})

const hostedCodeFromGateSpend = (error: string): HostedSpendErrorCode =>
  /monthly generator cap/i.test(error) ? 'monthly_cap' : 'needs_confirm'

const planAllowsPaidHostedVideo = (planId: string | null | undefined): boolean => {
  if (!planId || !(planId in HOSTED_PLANS)) return true
  return HOSTED_PLANS[planId as HostedPlanId].paidHostedVideo
}

/** Hosted spend gate including trial paid-video (#1043). */
export const gateHostedSpend = (input: HostedSpendInput): HostedSpendResult => {
  if (input.generationFrozen) {
    return fail(input, 'generation_frozen', 'Generation is paused. Update payment to continue.')
  }
  if (
    input.role === 'video' &&
    input.modelId &&
    isPaidHostedVideoModel(input.modelId) &&
    !planAllowsPaidHostedVideo(input.planId)
  ) {
    return fail(input, 'trial_paid_video', TRIAL_PAID_VIDEO_MESSAGE)
  }
  const effectiveCap = Math.min(
    input.budgets.monthlyGeneratorCap,
    input.walletBalanceGbp + input.spentThisMonthFromWalletGbp,
  )
  if (input.estimatedGbp > input.walletBalanceGbp) {
    return fail(
      input,
      'wallet_insufficient',
      `This job is about £${input.estimatedGbp.toFixed(2)}. Your organisation has £${input.walletBalanceGbp.toFixed(2)} left. Buy credits to run it.`,
    )
  }
  const inner = gateSpend({
    estimatedGbp: input.estimatedGbp,
    spentThisMonthGbp: input.spentThisMonthGbp,
    spentThisWeekGbp: input.spentThisWeekGbp,
    spentThisProjectGbp: input.spentThisProjectGbp,
    budgets: { ...input.budgets, monthlyGeneratorCap: effectiveCap },
    requireConfirm: input.requireConfirm,
    confirmSpend: input.confirmSpend,
    suggestProfile: input.suggestProfile,
  })
  if (!inner.ok) {
    return fail(input, hostedCodeFromGateSpend(inner.error), inner.error)
  }
  return { ok: true, remainingMonthlyGbp: inner.remainingMonthlyGbp }
}

export const hostedSpendHttpStatus = (result: HostedSpendResult): number => {
  if (result.ok) return 200
  if (result.code === 'wallet_insufficient') return 402
  if (result.code === 'generation_frozen' || result.code === 'trial_paid_video') return 403
  return 400
}

export type CreativeSpendGateResult = SpendGateResult | HostedSpendResult

/** gateSpend for local / no wallet; gateHostedSpend when billing + wallet row exist (#1039). */
export const resolveCreativeSpendGate = async (
  supabase: SupabaseClient,
  input: {
    productId: string
    projectId?: string | null
    estimatedGbp: number
    requireConfirm: boolean
    confirmSpend?: boolean
    suggestProfile?: string
    role?: string | null
    modelId?: string | null
  },
): Promise<CreativeSpendGateResult> => {
  const ctx = await loadHostedSpendContext(supabase, {
    productId: input.productId,
    projectId: input.projectId,
  })
  const budgets = readCreativeBudgets()
  const hostedBudgets =
    ctx.monthlyGeneratorCapGbp != null
      ? { ...budgets, monthlyGeneratorCap: ctx.monthlyGeneratorCapGbp }
      : budgets
  if (!isBillingEnabled() || !ctx.hasWallet) {
    return gateSpend({
      estimatedGbp: input.estimatedGbp,
      spentThisMonthGbp: ctx.spentThisMonthGbp,
      spentThisWeekGbp: ctx.spentThisWeekGbp,
      spentThisProjectGbp: ctx.spentThisProjectGbp,
      budgets,
      requireConfirm: input.requireConfirm,
      confirmSpend: input.confirmSpend,
      suggestProfile: input.suggestProfile,
    })
  }
  return gateHostedSpend({
    estimatedGbp: input.estimatedGbp,
    spentThisMonthGbp: ctx.spentThisMonthGbp,
    spentThisWeekGbp: ctx.spentThisWeekGbp,
    spentThisProjectGbp: ctx.spentThisProjectGbp,
    budgets: hostedBudgets,
    requireConfirm: input.requireConfirm,
    confirmSpend: input.confirmSpend,
    suggestProfile: input.suggestProfile,
    walletBalanceGbp: ctx.walletBalanceGbp,
    generationFrozen: ctx.generationFrozen,
    spentThisMonthFromWalletGbp: ctx.spentThisMonthFromWalletGbp,
    planId: ctx.planId,
    role: input.role,
    modelId: input.modelId,
  })
}
