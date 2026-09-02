import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')

describe('Home, Products, Usage layout (#821)', () => {
  it('stacks the weekly funnel to one column on phone', () => {
    expect(css).toMatch(
      /\/\* #821 Home, Products, Usage[\s\S]{0,800}?@media \(max-width: 640px\) \{[\s\S]{0,200}?\.funnel-stages \{[\s\S]{0,80}?grid-template-columns: 1fr/,
    )
  })

  it('keeps Product create fields at 16px / 44px', () => {
    expect(css).toMatch(/\.products-field input \{[\s\S]{0,160}?font-size: 1rem/)
    expect(css).toMatch(/\.products-field input \{[\s\S]{0,200}?min-height: var\(--sw-touch\)/)
  })
})
