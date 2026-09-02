import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = join(process.cwd(), '..')
const adr = readFileSync(join(repoRoot, 'docs/adr/0079-oss-path-a.md'), 'utf8')
const briefing = readFileSync(join(repoRoot, 'docs/opensource/briefing.md'), 'utf8')

describe('Path A OSS ADR (#897)', () => {
  it('locks Apache-2.0, empty history, and private SoT', () => {
    expect(adr).toMatch(/Apache-2\.0/)
    expect(adr).toMatch(/empty history/i)
    expect(adr).toMatch(/source of truth/i)
    expect(adr).toMatch(/Does not supersede/)
  })

  it('keeps the private example private and forbids public deploy to hosted-vercel-team', () => {
    expect(adr).toMatch(/the private example stays private/)
    expect(adr).toMatch(/example Product/)
    expect(adr).toMatch(/must not.*hosted-vercel-team/i)
    expect(adr).toMatch(/denylist/i)
    expect(adr).toMatch(/sanitized/)
  })

  it('marks Path A chosen on the briefing with the 2026-08-23 calls', () => {
    expect(briefing).toMatch(/\*\*Chosen path: A\*\*/)
    expect(briefing).toMatch(/2026-08-23/)
    expect(briefing).toMatch(/the private example is an example Product/)
    expect(briefing).toMatch(/Funnel \/ CRO scrub/)
    expect(briefing).toMatch(/No public deploy workflows/)
  })
})
