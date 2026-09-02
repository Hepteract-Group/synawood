import { describe, expect, it } from 'vitest'
import {
  filledInviteDrafts,
  MAX_ONBOARDING_INVITES,
  partitionInviteDrafts,
} from './onboarding-invites'

describe('onboarding invites', () => {
  it('drops blank rows and caps at five', () => {
    expect(MAX_ONBOARDING_INVITES).toBe(5)
    expect(
      filledInviteDrafts([
        { email: '  Ada@Studio.local  ', jobFunction: 'editor' },
        { email: '   ', jobFunction: 'reviewer' },
      ]),
    ).toEqual([{ email: 'ada@studio.local', jobFunction: 'editor' }])
  })

  it('keeps bad emails out of the send list', () => {
    expect(
      partitionInviteDrafts([
        { email: 'ok@studio.local', jobFunction: 'publisher' },
        { email: 'not-an-email', jobFunction: 'analyst' },
      ]),
    ).toEqual({
      valid: [{ email: 'ok@studio.local', jobFunction: 'publisher' }],
      invalid: [{ email: 'not-an-email', jobFunction: 'analyst' }],
    })
  })
})
