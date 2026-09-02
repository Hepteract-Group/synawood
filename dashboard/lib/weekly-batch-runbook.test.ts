import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const runbook = readFileSync(
  join(here, '../../core/runbooks/weekly-founder-content-batch.md'),
  'utf8',
)

describe('weekly founder content batch runbook (#811)', () => {
  it('keeps the runbook and names Schedule via Synawood on the Work board', () => {
    expect(runbook).toMatch(/^# Runbook: Weekly Founder Content Batch/m)
    expect(runbook).toMatch(/Schedule via Synawood/)
    expect(runbook).toMatch(/Work board/)
    expect(runbook).toMatch(/\*\*Schedule\*\*/)
    expect(runbook).toMatch(/\/content/)
  })

  it('keeps paste URL as the fallback, not Postiz as a second product', () => {
    expect(runbook).toMatch(/paste/i)
    expect(runbook).not.toMatch(/load into Postiz/i)
    expect(runbook).not.toMatch(/Until Plan 29/)
    expect(runbook).toMatch(/fallback/i)
  })
})
