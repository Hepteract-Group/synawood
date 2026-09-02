import { describe, expect, it } from 'vitest'
import { isBlockedStingerSrc, isStingerLicenseCleared } from './lottie-stinger'
import { isLottieJson } from '../library/import-guards'
import stinger from './fixtures/stinger.json'

describe('LottieStinger gates (#1193)', () => {
  it('ships a first-party Lottie fixture', () => {
    expect(isLottieJson(stinger)).toBe(true)
  })

  it('rejects GIPHY and GIF src', () => {
    expect(isBlockedStingerSrc('https://giphy.com/media/abc.gif')).toBe(true)
    expect(isBlockedStingerSrc('https://media.giphy.com/media/x/giphy.gif')).toBe(true)
    expect(isBlockedStingerSrc('https://cdn.example.com/stinger.json')).toBe(false)
  })

  it('treats unknown license as not cleared and first-party as cleared', () => {
    expect(isStingerLicenseCleared('unknown')).toBe(false)
    expect(isStingerLicenseCleared('cleared')).toBe(true)
    expect(isStingerLicenseCleared('first-party')).toBe(true)
    expect(isStingerLicenseCleared(undefined, 'first-party')).toBe(true)
    expect(isStingerLicenseCleared(undefined)).toBe(true)
    expect(isStingerLicenseCleared(undefined, undefined, 'https://cdn.example.com/a.json')).toBe(
      false,
    )
  })
})
