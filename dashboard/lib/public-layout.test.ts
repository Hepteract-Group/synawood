import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')

describe('public and auth layout (#820)', () => {
  it('stacks the landing hero at 900px with copy first', () => {
    expect(css).toMatch(
      /@media \(max-width: 900px\)[\s\S]{0,400}?\.mkt-hero \{[\s\S]{0,160}?grid-template-columns: 1fr/,
    )
    expect(css).not.toMatch(/\.mkt-hero-visual \{[\s\S]{0,180}?order:\s*-1/)
  })

  it('keeps waitlist and auth primary controls at --sw-touch', () => {
    expect(css).toMatch(/\.mkt-waitlist button \{[\s\S]{0,220}?min-height: var\(--sw-touch\)/)
    expect(css).toMatch(
      /\.auth-google,\s*\n\.auth-submit \{[\s\S]{0,80}?min-height: var\(--sw-touch\)/,
    )
    expect(css).toMatch(/\.mkt-waitlist input \{[\s\S]{0,320}?font-size: 1rem/)
    expect(css).toMatch(
      /\.auth-form input,\s*\n\.auth-form select,\s*\n\.auth-form textarea \{[\s\S]{0,280}?font-size: 1rem/,
    )
  })

  it('scrolls auth panels inside the viewport', () => {
    expect(css).toMatch(/\.auth-panel \{[\s\S]{0,220}?max-height: 90dvh/)
  })
})
