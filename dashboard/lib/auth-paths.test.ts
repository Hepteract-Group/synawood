import { describe, expect, it } from 'vitest'
import {
  isOnboardingExemptPath,
  isProtectedPath,
  isPublicPath,
  MIDDLEWARE_MATCHER,
  unauthenticatedLoginNext,
} from './auth-paths'

describe('auth path gates', () => {
  it('keeps marketing, health, waitlist, and auth entry public', () => {
    expect(isPublicPath('/')).toBe(true)
    expect(isPublicPath('/api/health')).toBe(true)
    expect(isPublicPath('/api/v1/health')).toBe(true)
    expect(isPublicPath('/api/v1/projects/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toBe(true)
    expect(isProtectedPath('/api/v1/health')).toBe(false)
    expect(isProtectedPath('/api/v1/projects/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toBe(false)
    expect(isPublicPath('/api/waitlist')).toBe(true)
    expect(isPublicPath('/api/auth/allowlist-check')).toBe(true)
    expect(isPublicPath('/login')).toBe(true)
    expect(isPublicPath('/access-denied')).toBe(true)
    expect(isPublicPath('/auth/callback')).toBe(true)
    expect(isPublicPath('/auth/callback/extra')).toBe(true)
    expect(isPublicPath('/manifest.webmanifest')).toBe(true)
    expect(isPublicPath('/authored-player.html')).toBe(true)
    expect(isProtectedPath('/authored-player.html')).toBe(false)
    expect(isPublicPath('/authored-player.js')).toBe(true)
    expect(isProtectedPath('/authored-player.js')).toBe(false)
    expect(isProtectedPath('/')).toBe(false)
    expect(isProtectedPath('/api/waitlist')).toBe(false)
    expect(isProtectedPath('/login')).toBe(false)
    expect(isProtectedPath('/signup')).toBe(false)
  })

  it('sends unauthenticated /home to login with next=/home, not the waitlist', () => {
    expect(isProtectedPath('/home')).toBe(true)
    expect(isPublicPath('/')).toBe(true)
    expect(unauthenticatedLoginNext('/home')).toBe('/home')
    expect(unauthenticatedLoginNext('/home')).not.toBe('/')
  })

  it('fail-closes operator UI and all /api/* except public', () => {
    expect(isProtectedPath('/home')).toBe(true)
    expect(isProtectedPath('/content')).toBe(true)
    expect(isProtectedPath('/studio/abc')).toBe(true)
    expect(isProtectedPath('/usage')).toBe(true)
    expect(isProtectedPath('/settings')).toBe(true)
    expect(isProtectedPath('/products')).toBe(true)
    expect(isProtectedPath('/ai-media')).toBe(true)
    expect(isProtectedPath('/api/studio/projects')).toBe(true)
    expect(isPublicPath('/api/v1')).toBe(true)
    expect(isProtectedPath('/api/content/board')).toBe(true)
    expect(isProtectedPath('/api/products')).toBe(true)
    expect(isProtectedPath('/api/factory/jobs')).toBe(true)
  })

  it('exports onboarding-exempt paths for zero-membership users', () => {
    expect(isOnboardingExemptPath('/onboarding')).toBe(true)
    expect(isOnboardingExemptPath('/products')).toBe(true)
    expect(isOnboardingExemptPath('/invite/abc')).toBe(true)
    expect(isOnboardingExemptPath('/api/products')).toBe(true)
    expect(isOnboardingExemptPath('/api/invites/tok')).toBe(true)
    expect(isOnboardingExemptPath('/api/me/profile')).toBe(true)
    expect(isOnboardingExemptPath('/api/me/session')).toBe(true)
    expect(isOnboardingExemptPath('/api/me/guides')).toBe(true)
    expect(isOnboardingExemptPath('/api/me/guides/welcome-v1')).toBe(true)
    expect(isOnboardingExemptPath('/access-denied')).toBe(true)
    expect(isOnboardingExemptPath('/studio')).toBe(false)
    expect(isOnboardingExemptPath('/home')).toBe(false)
  })

  it('exports a single matcher source for middleware', () => {
    expect(MIDDLEWARE_MATCHER.length).toBeGreaterThan(0)
    expect(MIDDLEWARE_MATCHER[0]).toContain('_next/static')
  })
})
