import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')

describe('Goals layout (#824)', () => {
  it('keeps composer fields and submit at --sw-touch', () => {
    expect(css).toMatch(
      /\.goals-field input,\s*\n\.goals-field textarea \{[\s\S]{0,200}?min-height: var\(--sw-touch\)/,
    )
    expect(css).toMatch(/\.goals-composer-submit \{[\s\S]{0,80}?min-height: var\(--sw-touch\)/)
  })
})
