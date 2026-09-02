import { describe, expect, it } from 'vitest'
import { isSvgContentType, sanitizeSvgBytes } from './sanitize-svg'

describe('sanitizeSvgBytes', () => {
  it('strips illegal XML control bytes from SVG text', () => {
    const dirty = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><text>the private example\u0014 browser</text></svg>',
    )
    const clean = sanitizeSvgBytes(dirty).toString('utf8')
    expect(clean).toContain('the private example browser')
    expect(clean).not.toContain('\u0014')
  })

  it('leaves non-SVG bytes untouched', () => {
    const pngish = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x14, 0x0a])
    expect(sanitizeSvgBytes(pngish)).toEqual(pngish)
  })
})

describe('isSvgContentType', () => {
  it('detects svg content types', () => {
    expect(isSvgContentType('image/svg+xml')).toBe(true)
    expect(isSvgContentType('image/png')).toBe(false)
    expect(isSvgContentType(undefined)).toBe(false)
  })
})
