import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')

describe('Insights, Approvals, AI Media layout (#825)', () => {
  it('wraps local nav tabs instead of overflowing', () => {
    expect(css).toMatch(/\.packs-tabs \{[\s\S]{0,80}?flex-wrap: wrap/)
    expect(css).toMatch(/\.packs-tab \{[\s\S]{0,160}?min-height: var\(--sw-touch\)/)
  })
})
