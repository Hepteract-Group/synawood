import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')

describe('Settings layout (#826)', () => {
  it('keeps member invite fields and submit at --sw-touch', () => {
    expect(css).toMatch(
      /\.members-field input,\s*\n\.members-field select \{[\s\S]{0,200}?min-height: var\(--sw-touch\)/,
    )
    expect(css).toMatch(/\.members-invite-submit \{[\s\S]{0,80}?min-height: var\(--sw-touch\)/)
  })
})
