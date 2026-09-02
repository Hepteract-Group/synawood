import { describe, expect, it } from 'vitest'
import { emailMayAuthenticate, parseAuthAccessMode } from './auth-access-mode'

describe('parseAuthAccessMode', () => {
  it('defaults unknown and empty to invite_or_allowlist', () => {
    expect(parseAuthAccessMode(undefined)).toBe('invite_or_allowlist')
    expect(parseAuthAccessMode('')).toBe('invite_or_allowlist')
    expect(parseAuthAccessMode('nope')).toBe('invite_or_allowlist')
  })

  it('accepts the three documented values, case-insensitive', () => {
    expect(parseAuthAccessMode('saas')).toBe('saas')
    expect(parseAuthAccessMode('ALLOWLIST')).toBe('allowlist')
    expect(parseAuthAccessMode('invite_or_allowlist')).toBe('invite_or_allowlist')
  })
})

describe('emailMayAuthenticate', () => {
  it('lets anyone through in saas mode', () => {
    expect(emailMayAuthenticate({ mode: 'saas', allowlisted: false, hasOpenInvite: false })).toBe(
      true,
    )
  })

  it('keeps allowlist-or-invite as today', () => {
    expect(
      emailMayAuthenticate({
        mode: 'invite_or_allowlist',
        allowlisted: true,
        hasOpenInvite: false,
      }),
    ).toBe(true)
    expect(
      emailMayAuthenticate({
        mode: 'invite_or_allowlist',
        allowlisted: false,
        hasOpenInvite: true,
      }),
    ).toBe(true)
    expect(
      emailMayAuthenticate({
        mode: 'invite_or_allowlist',
        allowlisted: false,
        hasOpenInvite: false,
      }),
    ).toBe(false)
  })

  it('ignores invites in allowlist mode unless the email is listed', () => {
    expect(
      emailMayAuthenticate({ mode: 'allowlist', allowlisted: false, hasOpenInvite: true }),
    ).toBe(false)
    expect(
      emailMayAuthenticate({ mode: 'allowlist', allowlisted: true, hasOpenInvite: false }),
    ).toBe(true)
  })
})
