import { describe, expect, it } from 'vitest'
import { loadCriticSkillsExcerpt } from './skills'

describe('loadCriticSkillsExcerpt (#555)', () => {
  it('loads editor-critic rules for the vision judge, not as chat filler', async () => {
    const excerpt = await loadCriticSkillsExcerpt('demo')
    expect(excerpt).toMatch(/editor-critic/)
    expect(excerpt).toMatch(/Never black/i)
    expect(excerpt).toMatch(/Readable type/i)
    expect(excerpt).toMatch(/Product on screen/i)
    expect(excerpt).toMatch(/colour-only/i)
    expect(excerpt).toMatch(/Brand look/i)
    expect(excerpt).toMatch(/marketing-critic/)
    expect(excerpt).toMatch(/one message/i)
    expect(excerpt).not.toMatch(/Live clips/)
    expect(excerpt).not.toMatch(/\bB-roll\b/)
  })
})
