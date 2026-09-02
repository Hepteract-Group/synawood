import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')

describe('Studio media bin + Story layout (#829)', () => {
  it('sizes bin tabs, Library/Story, search, and ingest at --sw-touch through the Studio stack', () => {
    expect(css).toMatch(
      /\/\* #829 Studio media bin \+ Story[\s\S]{0,900}?@media \(max-width: 1100px\) \{[\s\S]{0,500}?\.asset-bin-tab \{[\s\S]{0,120}?min-height: var\(--sw-touch\)/,
    )
    expect(css).toMatch(
      /\/\* #829 Studio media bin \+ Story[\s\S]{0,2200}?\.asset-bin-mode-btn \{[\s\S]{0,80}?min-height: var\(--sw-touch\)/,
    )
    expect(css).toMatch(
      /\/\* #829 Studio media bin \+ Story[\s\S]{0,2800}?\.story-builder-search input \{[\s\S]{0,160}?min-height: var\(--sw-touch\)[\s\S]{0,80}?font-size: 1rem/,
    )
  })

  it('keeps Story preview and Add from URL inside 90dvh', () => {
    expect(css).toMatch(
      /\/\* #829 Studio media bin \+ Story[\s\S]{0,3600}?\.story-preview-root \.dialog-panel\.story-preview-panel \{[\s\S]{0,160}?max-height: min\(90dvh/,
    )
    expect(css).toMatch(
      /\/\* #829 Studio media bin \+ Story[\s\S]{0,4200}?\.add-from-url-field input \{[\s\S]{0,120}?min-height: var\(--sw-touch\)/,
    )
  })

  it('uses two library columns on phone after the cramped 900px grid', () => {
    expect(css).toMatch(
      /\/\* #829 Studio media bin \+ Story[\s\S]{0,5200}?@media \(max-width: 640px\) \{[\s\S]{0,280}?\.asset-bin-body \.asset-library-grid \{[\s\S]{0,80}?repeat\(2, minmax\(0, 1fr\)\)/,
    )
  })
})
