import { describe, expect, it } from 'vitest'
import { decideChatSpendSend } from './chat-spend-send'

const ready = {
  billingEnabled: true,
  billingLoading: false,
  generationFrozen: false,
  walletBalanceGbp: 12,
  paidHostedVideo: true,
  liveVideoSelected: false,
}

describe('decideChatSpendSend (#1328)', () => {
  it('sends immediately when Allow paid models is on and the wallet can cover', () => {
    expect(decideChatSpendSend({ ...ready, confirmSpendAllowed: true })).toEqual({
      action: 'send',
      confirmSpend: true,
    })
  })

  it('sends without confirmSpend when Allow paid models is off — no modal', () => {
    expect(decideChatSpendSend({ ...ready, confirmSpendAllowed: false })).toEqual({
      action: 'send',
      confirmSpend: false,
    })
  })

  it('does not pop a modal while billing is still loading', () => {
    expect(
      decideChatSpendSend({
        ...ready,
        confirmSpendAllowed: true,
        billingLoading: true,
        walletBalanceGbp: 0,
      }),
    ).toEqual({ action: 'send', confirmSpend: true })
  })

  it('blocks frozen / empty wallet / trial paid video as banners, not a modal', () => {
    expect(
      decideChatSpendSend({ ...ready, confirmSpendAllowed: true, generationFrozen: true }),
    ).toEqual({ action: 'block', reason: 'frozen' })
    expect(
      decideChatSpendSend({ ...ready, confirmSpendAllowed: true, walletBalanceGbp: 0 }),
    ).toEqual({ action: 'block', reason: 'insufficient' })
    expect(
      decideChatSpendSend({
        ...ready,
        confirmSpendAllowed: true,
        paidHostedVideo: false,
        liveVideoSelected: true,
      }),
    ).toEqual({ action: 'block', reason: 'trial_paid_video' })
  })

  it('sends when billing is off', () => {
    expect(
      decideChatSpendSend({ ...ready, billingEnabled: false, confirmSpendAllowed: true }),
    ).toEqual({ action: 'send', confirmSpend: true })
  })
})
