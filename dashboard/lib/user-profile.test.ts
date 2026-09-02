import { describe, expect, it } from 'vitest'
import { isProfileExemptPath, isUserProfileComplete, parseProfilePatch } from './user-profile'

describe('parseProfilePatch', () => {
  it('treats Skip as a completed empty profile', () => {
    expect(parseProfilePatch({ skip: true })).toEqual({
      displayName: null,
      jobTitle: null,
      intent: null,
      skipped: true,
    })
  })

  it('keeps Continue fields and trims the name', () => {
    expect(
      parseProfilePatch({
        displayName: '  Ada  ',
        jobTitle: 'marketer',
        intent: 'make_ads',
      }),
    ).toEqual({
      displayName: 'Ada',
      jobTitle: 'marketer',
      intent: 'make_ads',
      skipped: false,
    })
  })

  it('rejects unknown job titles', () => {
    expect(() => parseProfilePatch({ jobTitle: 'publisher' })).toThrow(/listed roles/)
  })

  it('treats empty Continue as skipped', () => {
    expect(parseProfilePatch({})).toEqual({
      displayName: null,
      jobTitle: null,
      intent: null,
      skipped: true,
    })
  })
})

describe('isProfileExemptPath', () => {
  it('lets the profile step, profile API, and invites through', () => {
    expect(isProfileExemptPath('/onboarding/profile')).toBe(true)
    expect(isProfileExemptPath('/api/me/profile')).toBe(true)
    expect(isProfileExemptPath('/invite/tok')).toBe(true)
    expect(isProfileExemptPath('/home')).toBe(false)
    expect(isProfileExemptPath('/onboarding')).toBe(false)
  })
})

describe('isUserProfileComplete', () => {
  it('is complete only when onboarding_completed_at is set', async () => {
    const completeClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { onboarding_completed_at: '2026-08-23T00:00:00.000Z' },
              error: null,
            }),
          }),
        }),
      }),
    }
    const emptyClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    }
    await expect(isUserProfileComplete(completeClient as never, 'u1')).resolves.toBe(true)
    await expect(isUserProfileComplete(emptyClient as never, 'u1')).resolves.toBe(false)
  })
})
