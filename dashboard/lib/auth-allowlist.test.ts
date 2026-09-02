import { describe, expect, it } from 'vitest'
import { isEmailAllowlisted, parseAllowlistEmails } from './auth-allowlist'

describe('parseAllowlistEmails', () => {
  it('splits, trims, and lowercases', () => {
    expect(parseAllowlistEmails(' Ada@Example.com , bob@test.io ')).toEqual([
      'ada@example.com',
      'bob@test.io',
    ])
  })

  it('returns empty for unset', () => {
    expect(parseAllowlistEmails(undefined)).toEqual([])
    expect(parseAllowlistEmails('')).toEqual([])
  })
})

describe('isEmailAllowlisted', () => {
  it('allows listed emails when allowlist is set', () => {
    const env = { AUTH_ALLOWLIST_EMAILS: 'founder@marketing-os.local', NODE_ENV: 'development' }
    expect(isEmailAllowlisted('founder@marketing-os.local', env)).toBe(true)
    expect(isEmailAllowlisted('Founder@Marketing-OS.local', env)).toBe(true)
    expect(isEmailAllowlisted('stranger@example.com', env)).toBe(false)
  })

  it('fails closed in production when allowlist is empty', () => {
    expect(isEmailAllowlisted('anyone@example.com', { NODE_ENV: 'production' })).toBe(false)
    expect(
      isEmailAllowlisted('anyone@example.com', {
        VERCEL_ENV: 'production',
        NODE_ENV: 'development',
      }),
    ).toBe(false)
  })

  it('allows any email in local/dev when allowlist is empty', () => {
    expect(isEmailAllowlisted('dev@example.com', { NODE_ENV: 'development' })).toBe(true)
    expect(isEmailAllowlisted('dev@example.com', { NODE_ENV: 'test' })).toBe(true)
  })

  it('rejects empty email', () => {
    expect(isEmailAllowlisted(null, { NODE_ENV: 'development' })).toBe(false)
    expect(isEmailAllowlisted('  ', { NODE_ENV: 'development' })).toBe(false)
  })
})
