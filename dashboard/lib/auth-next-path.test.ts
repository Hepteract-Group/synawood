import { describe, expect, it } from 'vitest'
import { isSafeNextPath, resolvePostAuthPath, resolveSignupDestination } from './auth-next-path'

describe('isSafeNextPath', () => {
  it('allows relative app paths', () => {
    expect(isSafeNextPath('/studio')).toBe(true)
    expect(isSafeNextPath('/studio/abc?x=1')).toBe(true)
    expect(isSafeNextPath('/onboarding')).toBe(true)
  })

  it('rejects open redirects and empty values', () => {
    expect(isSafeNextPath(null)).toBe(false)
    expect(isSafeNextPath('')).toBe(false)
    expect(isSafeNextPath('https://evil.example')).toBe(false)
    expect(isSafeNextPath('//evil.example')).toBe(false)
    expect(isSafeNextPath('/\\evil')).toBe(false)
  })
})

describe('resolvePostAuthPath', () => {
  it('defaults unsafe and public marketing paths to /studio', () => {
    expect(resolvePostAuthPath(null)).toBe('/studio')
    expect(resolvePostAuthPath('/')).toBe('/studio')
    expect(resolvePostAuthPath('/login')).toBe('/studio')
    expect(resolvePostAuthPath('/signup?next=/studio')).toBe('/studio')
    expect(resolvePostAuthPath('https://evil.example')).toBe('/studio')
  })

  it('keeps operator destinations', () => {
    expect(resolvePostAuthPath('/studio')).toBe('/studio')
    expect(resolvePostAuthPath('/home')).toBe('/home')
    expect(resolvePostAuthPath('/studio/abc')).toBe('/studio/abc')
  })

  it('defaults standalone windows to /home when next is missing', () => {
    expect(resolvePostAuthPath(null, { standalone: true })).toBe('/home')
    expect(resolvePostAuthPath('/login', { standalone: true })).toBe('/home')
    expect(resolvePostAuthPath('/studio', { standalone: true })).toBe('/studio')
  })
})

describe('resolveSignupDestination', () => {
  it('sends new accounts to create a Product', () => {
    expect(resolveSignupDestination(null)).toBe('/onboarding')
    expect(resolveSignupDestination('/studio')).toBe('/onboarding')
    expect(resolveSignupDestination('/')).toBe('/onboarding')
  })

  it('keeps invite accept links', () => {
    expect(resolveSignupDestination('/invite/abc')).toBe('/invite/abc')
  })
})
