import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '../..')
const readRepo = (relative: string): string => readFileSync(join(repoRoot, relative), 'utf8')

const workflowHasLivePostizCreds = (yaml: string): boolean =>
  /POSTIZ_API_KEY\s*:/.test(yaml) || /POSTIZ_BASE_URL\s*:/.test(yaml)

describe('CI + smoke never use live Postiz (#812)', () => {
  it('runs MR checks with mock Postiz and no live credentials', () => {
    const yaml = readRepo('.github/workflows/mr-checks.yml')
    expect(yaml).toMatch(/POSTIZ_ADAPTER:\s*mock/)
    expect(workflowHasLivePostizCreds(yaml)).toBe(false)
  })

  it('keeps post-merge and coverage workflows free of Postiz keys', () => {
    expect(workflowHasLivePostizCreds(readRepo('.github/workflows/post-merge.yml'))).toBe(false)
    expect(workflowHasLivePostizCreds(readRepo('.github/workflows/coverage-daily.yml'))).toBe(false)
  })

  it('documents that CI is mock and npm run smoke does not call Postiz', () => {
    const ci = readRepo('docs/architecture/ci-cd.md')
    expect(ci).toMatch(/POSTIZ_ADAPTER=mock/)
    expect(ci).toMatch(/no POSTIZ_API_KEY/)
    expect(ci).toMatch(/npm run smoke/)
    const smoke = readRepo('scripts/smoke.ts')
    expect(smoke).toMatch(/does not call Postiz/i)
  })
})
