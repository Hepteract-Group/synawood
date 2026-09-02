import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')

describe('Studio overlays, wizards, and job dialogs (#830)', () => {
  it('caps Music/Voice, Brand, Ad Generator, and Director preview at 90dvh through the Studio stack', () => {
    expect(css).toMatch(
      /\/\* #830 Studio overlays[\s\S]{0,900}?@media \(max-width: 1100px\) \{[\s\S]{0,400}?\.music-panel \{[\s\S]{0,120}?max-height: min\(90dvh/,
    )
    expect(css).toMatch(
      /\/\* #830 Studio overlays[\s\S]{0,1800}?\.dialog-panel\.brand-studio-panel \{[\s\S]{0,120}?max-height: min\(90dvh/,
    )
    expect(css).toMatch(
      /\/\* #830 Studio overlays[\s\S]{0,2400}?\.director-preview-panel \{[\s\S]{0,120}?max-height: min\(90dvh/,
    )
  })

  it('sizes overlay bin chips, wizard tabs, extract fields, and dialog actions at --sw-touch', () => {
    expect(css).toMatch(
      /\/\* #830 Studio overlays[\s\S]{0,3600}?\.caption-style-chips button \{[\s\S]{0,80}?min-height: var\(--sw-touch\)/,
    )
    expect(css).toMatch(
      /\/\* #830 Studio overlays[\s\S]{0,4200}?\.ad-generator-tab \{[\s\S]{0,80}?min-height: var\(--sw-touch\)/,
    )
    expect(css).toMatch(
      /\/\* #830 Studio overlays[\s\S]{0,4800}?\.extract-source-input[\s\S]{0,80}?min-height: var\(--sw-touch\)[\s\S]{0,80}?font-size: 1rem/,
    )
  })

  it('sizes pip presets, scene-strip actions, and slide fields at --sw-touch (#939)', () => {
    expect(css).toMatch(
      /\/\* #830 Studio overlays[\s\S]{0,9000}?\.pip-layout-preset[\s\S]{0,80}?min-height: var\(--sw-touch\)/,
    )
    expect(css).toMatch(
      /\/\* #830 Studio overlays[\s\S]{0,9000}?\.scene-strip-action[\s\S]{0,80}?min-height: var\(--sw-touch\)/,
    )
    expect(css).toMatch(
      /\/\* #830 Studio overlays[\s\S]{0,9000}?\.slide-editor-field input[\s\S]{0,120}?min-height: var\(--sw-touch\)/,
    )
  })
})
