/** Hosted SaaS plan catalog (ADR-0082 / #1035). Stripe Price ids stay in env. */

export type HostedPlanId = 'trial' | 'studio' | 'team'

export type HostedPlan = {
  id: HostedPlanId
  seatLimit: number
  includedGrantGbp: number
  listGbpPerMonth: number | null
  paidHostedVideo: boolean
  watermarkExports: boolean
  trialDays: number | null
}

export const HOSTED_PLANS: Record<HostedPlanId, HostedPlan> = {
  trial: {
    id: 'trial',
    seatLimit: 3,
    includedGrantGbp: 0,
    listGbpPerMonth: null,
    paidHostedVideo: false,
    watermarkExports: true,
    trialDays: 14,
  },
  studio: {
    id: 'studio',
    seatLimit: 3,
    includedGrantGbp: 25,
    listGbpPerMonth: 79,
    paidHostedVideo: true,
    watermarkExports: false,
    trialDays: null,
  },
  team: {
    id: 'team',
    seatLimit: 8,
    includedGrantGbp: 80,
    listGbpPerMonth: 199,
    paidHostedVideo: true,
    watermarkExports: false,
    trialDays: null,
  },
}
