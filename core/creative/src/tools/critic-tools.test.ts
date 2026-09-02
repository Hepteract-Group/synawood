import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const criticToolsSrc = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), './critic-tools.ts'),
  'utf8',
)

describe('inspect_preview stills (#596)', () => {
  it('does not import Remotion bundle inside the Next.js tool process', () => {
    expect(criticToolsSrc).not.toMatch(/render-cut-stills/)
    expect(criticToolsSrc).not.toMatch(/@remotion\/bundler/)
    expect(criticToolsSrc).toMatch(/spawnCutReviewStills/)
    expect(criticToolsSrc).toMatch(/repairPictureToBrief/)
  })
})
