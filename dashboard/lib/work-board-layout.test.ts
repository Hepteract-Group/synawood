import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')
const card = readFileSync(join(process.cwd(), 'components/content/WorkSlotCard.tsx'), 'utf8')

describe('Work board layout (#823)', () => {
  it('caps the task panel at 90dvh', () => {
    expect(css).toMatch(/\.work-detail-panel \{[\s\S]{0,160}?max-height: min\(90dvh/)
  })

  it('sizes Work board primary controls at --sw-touch through tablet', () => {
    expect(css).toMatch(
      /\/\* #823 Work board[\s\S]{0,400}?\.work-board-views button[\s\S]{0,280}?min-height: var\(--sw-touch\)/,
    )
  })

  it('sizes the YouTube thumbnail nudge at --sw-touch', () => {
    expect(css).toMatch(/\.work-slot-thumb-banner \{[\s\S]{0,160}?min-height: var\(--sw-touch\)/)
  })

  it('keeps the thumbnail picker on kanban cards (#965)', () => {
    expect(card).toMatch(/slotShowsThumbnailPicker\(slot\)/)
    expect(card).not.toMatch(/hasFinal && !draggable/)
  })
})
