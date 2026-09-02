import { describe, expect, it } from 'vitest'
import { debounceMsForTests, APPEARANCE_NEEDS_INDEX_COPY } from './StoryBuilder'

describe('Story Builder (#171)', () => {
  it('debounces search input briefly (Operate: no per-keystroke fetch)', () => {
    expect(debounceMsForTests).toBeGreaterThanOrEqual(200)
    expect(debounceMsForTests).toBeLessThanOrEqual(400)
  })

  it('shows Retry copy on the appearance chip, not a console log (#592)', () => {
    expect(APPEARANCE_NEEDS_INDEX_COPY).toBe('Matching by look isn’t ready yet — Retry')
  })
})
