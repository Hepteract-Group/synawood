import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')

describe('Campaigns layout (#822)', () => {
  it('keeps composer aspect tabs and count stepper at --sw-touch', () => {
    expect(css).toMatch(
      /\.campaigns-aspect-tabs button \{[\s\S]{0,120}?min-height: var\(--sw-touch\)/,
    )
    expect(css).toMatch(/\.campaigns-count-stepper \{[\s\S]{0,180}?min-height: var\(--sw-touch\)/)
  })

  it('stacks the pack creative grid on phone', () => {
    expect(css).toMatch(
      /\/\* #822 Campaigns[\s\S]{0,900}?@media \(max-width: 640px\) \{[\s\S]{0,160}?\.campaigns-creative-grid \{[\s\S]{0,80}?grid-template-columns: 1fr/,
    )
  })
})
