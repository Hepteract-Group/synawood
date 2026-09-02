import { describe, expect, it } from 'vitest'
import { parseVisionQualityScore, scoreScreenshotBytes } from './vision-quality'

describe('parseVisionQualityScore (#1093)', () => {
  it('reads usable / weak / reject fixtures without calling a model', () => {
    expect(parseVisionQualityScore({ quality: 'usable' })).toEqual({ quality: 'usable' })
    expect(parseVisionQualityScore({ quality: 'WEAK', note: 'busy nav' })).toEqual({
      quality: 'weak',
      note: 'busy nav',
    })
    expect(parseVisionQualityScore('{"quality":"reject","note":"login wall"}')).toEqual({
      quality: 'reject',
      note: 'login wall',
    })
  })

  it('fails closed on unknown labels', () => {
    expect(() => parseVisionQualityScore({ quality: 'great' })).toThrow(/usable, weak, or reject/)
  })
})

describe('scoreScreenshotBytes (#1093)', () => {
  it('rejects tiny stills and keeps large ones usable', () => {
    expect(scoreScreenshotBytes(new Uint8Array(100)).quality).toBe('reject')
    expect(scoreScreenshotBytes(new Uint8Array(20 * 1024)).quality).toBe('weak')
    expect(scoreScreenshotBytes(new Uint8Array(80 * 1024)).quality).toBe('usable')
  })
})
