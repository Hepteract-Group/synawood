import { describe, expect, it } from 'vitest'
import {
  displayMusicBedTitle,
  formatMusicEstimateLabel,
  interpretMusicJobRecovery,
  musicBedLicenseLabel,
} from './music-bed-display'

describe('formatMusicEstimateLabel', () => {
  it('does not call a live £0 estimate a stub', () => {
    expect(formatMusicEstimateLabel({ estimatedGbp: 1.2, stub: false })).toBe('~£1.20')
    expect(formatMusicEstimateLabel({ estimatedGbp: 0, stub: false })).toBe('~£0.00')
    expect(formatMusicEstimateLabel({ estimatedGbp: 0, stub: true })).toBe('£0 (stub)')
    expect(formatMusicEstimateLabel({ estimatedGbp: null })).toBe('…')
  })
})

describe('displayMusicBedTitle', () => {
  it('extracts the operator request from a merged brand-style prompt', () => {
    const merged = [
      'Mood: clean modern underscore',
      'Tempo ~95 BPM',
      'Energy: medium',
      'Genres: lo-fi, ambient',
      'Instrumental only — no vocals or lyrics.',
      'Avoid: vocals, lyrics, choir',
      '',
      'User request: calm instrumental lo-fi bed under voiceover',
    ].join('\n')
    expect(displayMusicBedTitle(merged)).toBe('calm instrumental lo-fi bed under voiceover')
  })

  it('prefers inputSnapshot.userPrompt when present', () => {
    expect(
      displayMusicBedTitle('Mood: x\n\nUser request: ignored', { userPrompt: 'for a PDF tip' }),
    ).toBe('for a PDF tip')
  })

  it('falls back to Untitled bed when empty', () => {
    expect(displayMusicBedTitle(null)).toBe('Untitled bed')
    expect(displayMusicBedTitle('   ')).toBe('Untitled bed')
  })
})

describe('musicBedLicenseLabel', () => {
  it('names Final eligibility without a chip forest', () => {
    expect(musicBedLicenseLabel({ licenseStatus: 'cleared', commercialUseAllowed: true })).toBe(
      'Cleared for Final',
    )
    expect(musicBedLicenseLabel({ licenseStatus: 'mock', commercialUseAllowed: false })).toBe(
      'Mock — not Final',
    )
    expect(musicBedLicenseLabel({ licenseStatus: 'cleared', commercialUseAllowed: false })).toBe(
      'Not Final-eligible',
    )
  })
})

describe('interpretMusicJobRecovery', () => {
  it('treats a finished nested job as recovered', () => {
    expect(interpretMusicJobRecovery({ status: 'ready', bedsAlreadyListed: false })).toEqual({
      kind: 'ready',
      banner: 'Music bed ready — play it under Recent beds.',
      bannerTone: 'ok',
      clearPending: true,
      reload: true,
    })
  })

  it('keeps polling while queued or generating', () => {
    expect(
      interpretMusicJobRecovery({
        status: 'generating',
        bedsAlreadyListed: false,
      }).kind,
    ).toBe('in_progress')
  })

  it('stays silent when verify fails but Recent beds already has a row', () => {
    expect(interpretMusicJobRecovery({ status: undefined, bedsAlreadyListed: true })).toEqual({
      kind: 'silent',
      banner: null,
      bannerTone: null,
      clearPending: true,
      reload: false,
    })
  })

  it('warns (not success-teal) only when the bed is actually missing', () => {
    const result = interpretMusicJobRecovery({
      status: undefined,
      bedsAlreadyListed: false,
    })
    expect(result.kind).toBe('unverified')
    expect(result.bannerTone).toBe('warn')
    expect(result.banner).toMatch(/regenerate/i)
  })
})
