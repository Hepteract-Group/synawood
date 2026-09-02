import { describe, expect, it } from 'vitest'
import { plainEnglishRenderError } from './status'

describe('plainEnglishRenderError', () => {
  it('maps Chromium failures to actionable copy', () => {
    expect(plainEnglishRenderError(new Error('Could not find Chrome'))).toMatch(/Chromium/i)
  })

  it('maps encode failures', () => {
    expect(plainEnglishRenderError(new Error('ffmpeg exited'))).toMatch(/encode/i)
  })

  it('keeps a readable fallback', () => {
    expect(plainEnglishRenderError(new Error('disk full'))).toBe('Render failed: disk full')
  })
})
