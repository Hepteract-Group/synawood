import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')

describe('Transcript pane pause toolbar (#873)', () => {
  it('keeps Shorten pauses on a wrapping 44px toolbar and leaves room for words', () => {
    expect(css).toMatch(/\.transcript-pane \{[\s\S]{0,180}?max-height: 13rem/)
    expect(css).toMatch(
      /\.transcript-pane-toolbar \{[\s\S]{0,160}?flex-wrap: wrap[\s\S]{0,80}?\.transcript-pane-toolbar \.btn \{[\s\S]{0,80}?min-height: var\(--sw-touch/,
    )
  })
})
