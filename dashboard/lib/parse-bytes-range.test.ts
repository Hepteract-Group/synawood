import { describe, expect, it } from 'vitest'
import { parseBytesRange } from './parse-bytes-range'

describe('parseBytesRange', () => {
  it('parses closed ranges', () => {
    expect(parseBytesRange('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 })
  })

  it('caps open-ended ranges when a default length is provided', () => {
    expect(parseBytesRange('bytes=0-', 50_000_000, 2_000_000)).toEqual({
      start: 0,
      end: 1_999_999,
    })
  })

  it('parses suffix ranges', () => {
    expect(parseBytesRange('bytes=-500', 2000)).toEqual({ start: 1500, end: 1999 })
  })

  it('rejects out-of-bounds starts', () => {
    expect(parseBytesRange('bytes=5000-', 1000)).toBeNull()
  })
})
