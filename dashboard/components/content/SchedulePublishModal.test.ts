import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('SchedulePublishModal empty CTA (#810)', () => {
  it('uses the copy map for Open Settings instead of special-casing down', () => {
    const source = readFileSync(join(here, 'SchedulePublishModal.tsx'), 'utf8')
    expect(source).toContain('empty.settingsHref')
    expect(source).not.toMatch(/emptyKind !== ['"]down['"]/)
  })
})
