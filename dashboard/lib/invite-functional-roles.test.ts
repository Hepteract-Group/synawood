import { describe, expect, it } from 'vitest'
import { resolveInviteFunctionalRole, isInviteFunctionalRole } from './product-onboarding'

describe('invite functional roles (#266)', () => {
  it('defaults editor invites to editor and viewer invites to analyst', () => {
    expect(resolveInviteFunctionalRole('editor', null)).toBe('editor')
    expect(resolveInviteFunctionalRole('viewer', null)).toBe('analyst')
  })

  it('keeps an explicit reviewer or publisher job function', () => {
    expect(resolveInviteFunctionalRole('editor', 'reviewer')).toBe('reviewer')
    expect(resolveInviteFunctionalRole('editor', 'publisher')).toBe('publisher')
    expect(isInviteFunctionalRole('founder')).toBe(false)
  })
})
