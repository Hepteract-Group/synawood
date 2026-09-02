import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')
const page = readFileSync(join(process.cwd(), 'components/AiMediaJobs.tsx'), 'utf8')

describe('AI Media empty states (#782 / ADR-0061)', () => {
  it('sizes the empty panel, CTA, and in-flight banner at --sw-touch', () => {
    expect(css).toMatch(/\.ai-media-empty \{[\s\S]{0,280}?min-height: var\(--sw-touch\)/)
    expect(css).toMatch(/\.ai-media-empty \.btn \{[\s\S]{0,160}?min-height: var\(--sw-touch\)/)
    expect(css).toMatch(/\.ai-media-banner \{[\s\S]{0,220}?min-height: var\(--sw-touch\)/)
  })

  it('uses cannot-miss copy for no Product, no jobs, and load failure', () => {
    expect(page).toMatch(/No active Product/)
    expect(page).toMatch(/No generation jobs yet/)
    expect(page).toMatch(/Open Products/)
    expect(page).toMatch(/Open Studio/)
    expect(page).toMatch(/Retry/)
    expect(page).toMatch(/jobs still running/)
    expect(page).toMatch(/Place in Studio/)
    expect(page).toMatch(/jobCanPlace/)
  })
})
