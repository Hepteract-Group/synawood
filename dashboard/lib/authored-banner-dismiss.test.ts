import { describe, expect, it, beforeEach } from 'vitest'
import {
  authoredBannerDismissKey,
  authoredBannerFingerprint,
  markAuthoredBannerDismissed,
  readAuthoredBannerDismissLevel,
} from './authored-banner-dismiss'

const memory = new Map<string, string>()

describe('authored banner dismiss (#1371)', () => {
  beforeEach(() => {
    memory.clear()
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => memory.get(key) ?? null,
        setItem: (key: string, value: string) => {
          memory.set(key, value)
        },
        clear: () => memory.clear(),
      },
    })
  })

  it('persists banner dismiss and full hide across reload-equivalent reads', () => {
    const projectId = '22222222-2222-4222-8222-222222222222'
    const fingerprint = authoredBannerFingerprint('compile', "This motion ad didn't compile.")
    expect(readAuthoredBannerDismissLevel(projectId, fingerprint)).toBe('none')
    markAuthoredBannerDismissed(projectId, fingerprint, 'banner')
    expect(localStorage.getItem(authoredBannerDismissKey(projectId, fingerprint))).toBe('1')
    expect(readAuthoredBannerDismissLevel(projectId, fingerprint)).toBe('banner')
    markAuthoredBannerDismissed(projectId, fingerprint, 'all')
    expect(readAuthoredBannerDismissLevel(projectId, fingerprint)).toBe('all')
  })

  it('treats a new compile message as a different note', () => {
    const projectId = '22222222-2222-4222-8222-222222222222'
    markAuthoredBannerDismissed(projectId, authoredBannerFingerprint('compile', 'old error'), 'all')
    expect(
      readAuthoredBannerDismissLevel(projectId, authoredBannerFingerprint('compile', 'new error')),
    ).toBe('none')
  })
})
