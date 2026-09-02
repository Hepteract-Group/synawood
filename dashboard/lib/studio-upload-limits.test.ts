import { describe, expect, it } from 'vitest'
import {
  formatUploadBytes,
  isStudioUploadOverLimit,
  STUDIO_UPLOAD_MAX_BYTES,
} from './studio-upload-limits'

describe('studio-upload-limits', () => {
  it('flags files over the Studio middleware ceiling', () => {
    expect(isStudioUploadOverLimit(STUDIO_UPLOAD_MAX_BYTES)).toBe(false)
    expect(isStudioUploadOverLimit(STUDIO_UPLOAD_MAX_BYTES + 1)).toBe(true)
  })

  it('formats sizes for error copy', () => {
    expect(formatUploadBytes(900)).toMatch(/KB/)
    expect(formatUploadBytes(12 * 1024 * 1024)).toBe('12 MB')
  })
})
