export type ChatSpendBlockReason = 'frozen' | 'insufficient' | 'trial_paid_video'

export type ChatSpendSendDecision =
  { action: 'send'; confirmSpend: boolean } | { action: 'block'; reason: ChatSpendBlockReason }

/** Footer Allow paid models is consent. Ordinary chat must not open Confirm spend. */
export const decideChatSpendSend = (input: {
  confirmSpendAllowed: boolean
  billingEnabled: boolean
  billingLoading: boolean
  generationFrozen: boolean
  walletBalanceGbp: number
  paidHostedVideo: boolean
  liveVideoSelected: boolean
}): ChatSpendSendDecision => {
  if (!input.billingEnabled) {
    return { action: 'send', confirmSpend: input.confirmSpendAllowed }
  }
  if (!input.confirmSpendAllowed) {
    return { action: 'send', confirmSpend: false }
  }
  if (input.billingLoading) {
    return { action: 'send', confirmSpend: true }
  }
  if (input.generationFrozen) return { action: 'block', reason: 'frozen' }
  if (!input.paidHostedVideo && input.liveVideoSelected) {
    return { action: 'block', reason: 'trial_paid_video' }
  }
  if (input.walletBalanceGbp <= 0) return { action: 'block', reason: 'insufficient' }
  return { action: 'send', confirmSpend: true }
}
