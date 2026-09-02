import { HOSTED_PLANS, type HostedPlanId } from '../billing/plans'

/** True when the org plan burns a Trial mark into preview/export (#1044). */
export const planWantsTrialWatermark = (planId: string | null | undefined): boolean => {
  if (!planId || !(planId in HOSTED_PLANS)) return false
  return HOSTED_PLANS[planId as HostedPlanId].watermarkExports
}
