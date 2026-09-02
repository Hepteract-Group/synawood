import { describe, expect, it } from 'vitest'
import { isStandaloneDisplay } from './display-mode'

describe('standalone display (#843)', () => {
  it('treats Chromium display-mode and iOS navigator.standalone as installed', () => {
    expect(isStandaloneDisplay({})).toBe(false)
    expect(isStandaloneDisplay({ mediaMatches: false, iosStandalone: false })).toBe(false)
    expect(isStandaloneDisplay({ mediaMatches: true })).toBe(true)
    expect(isStandaloneDisplay({ iosStandalone: true })).toBe(true)
  })
})
