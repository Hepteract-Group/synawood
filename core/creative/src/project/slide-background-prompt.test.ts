import { describe, expect, it } from 'vitest'
import { buildSlideBackgroundPrompt } from './slide-background-prompt'

describe('buildSlideBackgroundPrompt', () => {
  it('includes headline and no-text instruction', () => {
    const prompt = buildSlideBackgroundPrompt({ headline: 'Edit PDFs faster' })
    expect(prompt).toContain('Edit PDFs faster')
    expect(prompt).toMatch(/Do not paint headline/i)
  })

  it('appends founder direction when provided', () => {
    const prompt = buildSlideBackgroundPrompt({
      headline: 'Hook',
      direction: 'darker greens, less clutter',
    })
    expect(prompt).toContain('Founder direction: darker greens, less clutter')
  })
})
