import { describe, expect, it } from 'vitest'
import { draftHeadlinesFromBrief } from './draft-headlines'

describe('draftHeadlinesFromBrief (#471)', () => {
  it('returns distinct claim-safe headlines from a brief', () => {
    const headlines = draftHeadlinesFromBrief('Calm focus for people drowning in PDFs', 3)
    expect(headlines).toHaveLength(3)
    expect(new Set(headlines).size).toBe(3)
    expect(headlines.every((h) => h.length > 0 && h.length <= 120)).toBe(true)
    expect(headlines.some((h) => /Creative \d/.test(h))).toBe(false)
  })

  it('rewrites forbidden claim language in templates', () => {
    const headlines = draftHeadlinesFromBrief('Guaranteed #1 PDF tool for everyone', 2)
    const joined = headlines.join(' ').toLowerCase()
    expect(joined).not.toMatch(/guaranteed/)
    expect(joined).not.toMatch(/#\s*1/)
  })
})
