import { describe, expect, it } from 'vitest'
import { pickArtDirection } from './catalog'
import {
  artDirectionPair,
  fingerprintsFromFinals,
  type FinalAttributionRow,
} from './recent-fingerprints'

describe('artDirectionPair', () => {
  it('extracts dialect|layout from a full motion fingerprint', () => {
    expect(artDirectionPair('snappy|full-bleed-type|export default () => null')).toBe(
      'snappy|full-bleed-type',
    )
  })
})

describe('fingerprintsFromFinals', () => {
  it('reads motion_fingerprint from attribution JSON', () => {
    const rows: FinalAttributionRow[] = [
      { attribution: { motion_fingerprint: 'snappy|full-bleed-type|a' } },
      { attribution: {} },
      { attribution: { motion_fingerprint: 'luxury|split-stat|b' } },
      { attribution: null },
    ]
    expect(fingerprintsFromFinals(rows)).toEqual([
      'snappy|full-bleed-type|a',
      'luxury|split-stat|b',
    ])
  })
})

describe('pickArtDirection pair skip (#1192)', () => {
  const recent = [
    'snappy|full-bleed-type|old-source-a',
    'luxury|split-stat|old-source-b',
    'editorial|stacked-proof|old-source-c',
    'comic|device-hero|old-source-d',
    'brutalist|stinger-open|old-source-e',
  ]

  it('five stored snappy/full-bleed-type Finals skip that pair, not snappy itself', () => {
    const recent = [0, 1, 2, 3, 4].map((i) => `snappy|full-bleed-type|old-source-${i}`)
    const picked = pickArtDirection({ seed: 'alpha', recentFingerprints: recent })
    expect(`${picked.dialect}|${picked.layout}`).not.toBe('snappy|full-bleed-type')
    const snappyOther = pickArtDirection({
      seed: 'bravo',
      recentFingerprints: recent,
    })
    if (snappyOther.dialect === 'snappy') {
      expect(snappyOther.layout).not.toBe('full-bleed-type')
    }
  })

  it('skips dialect|layout pairs from recent fingerprints, not whole dialects', () => {
    const picked = pickArtDirection({ seed: 'alpha', recentFingerprints: recent })
    expect(`${picked.dialect}|${picked.layout}`).not.toBe('snappy|full-bleed-type')
    expect(pickArtDirection({ seed: 'alpha', recentFingerprints: recent })).toEqual(picked)
    const snappyOtherLayout = pickArtDirection({
      seed: 'bravo',
      recentFingerprints: ['snappy|full-bleed-type|only-this-blocked'],
    })
    if (snappyOtherLayout.dialect === 'snappy') {
      expect(snappyOtherLayout.layout).not.toBe('full-bleed-type')
    }
  })

  it('allows the same pair when sequel is true', () => {
    const baseline = pickArtDirection({ seed: 'alpha' })
    const pair = `${baseline.dialect}|${baseline.layout}`
    const picked = pickArtDirection({
      seed: 'alpha',
      recentFingerprints: [`${pair}|stored-source`],
      sequel: true,
    })
    expect(picked).toEqual(baseline)
  })

  it('allows any pair when recent is empty (deterministic for seed)', () => {
    const empty = pickArtDirection({ seed: 'charlie' })
    expect(empty).toEqual(pickArtDirection({ seed: 'charlie', recentFingerprints: [] }))
  })

  it('allows all pairs again when every pair is blocked', () => {
    const blocked = [
      'snappy|full-bleed-type|a',
      'snappy|split-stat|b',
      'snappy|stacked-proof|c',
      'snappy|device-hero|d',
      'snappy|stinger-open|e',
      'luxury|full-bleed-type|f',
      'luxury|split-stat|g',
      'luxury|stacked-proof|h',
      'luxury|device-hero|i',
      'luxury|stinger-open|j',
      'editorial|full-bleed-type|k',
      'editorial|split-stat|l',
      'editorial|stacked-proof|m',
      'editorial|device-hero|n',
      'editorial|stinger-open|o',
      'comic|full-bleed-type|p',
      'comic|split-stat|q',
      'comic|stacked-proof|r',
      'comic|device-hero|s',
      'comic|stinger-open|t',
      'brutalist|full-bleed-type|u',
      'brutalist|split-stat|v',
      'brutalist|stacked-proof|w',
      'brutalist|device-hero|x',
      'brutalist|stinger-open|y',
      'kinetic-stack|full-bleed-type|z',
      'kinetic-stack|split-stat|aa',
      'kinetic-stack|stacked-proof|ab',
      'kinetic-stack|device-hero|ac',
      'kinetic-stack|stinger-open|ad',
    ]
    const picked = pickArtDirection({ seed: 'delta', recentFingerprints: blocked })
    expect(picked.dialect).toBeTruthy()
    expect(picked.layout).toBeTruthy()
  })
})
