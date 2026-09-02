import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '../..')

describe('the private example GTM is not in the app repo (#1377)', () => {
  it('does not keep a tracked products/demo pack', () => {
    expect(existsSync(join(repoRoot, 'products/demo'))).toBe(false)
    expect(existsSync(join(repoRoot, 'products/demo/config.ts'))).toBe(false)
    expect(existsSync(join(repoRoot, 'products/demo/brand-kit/manifest.json'))).toBe(false)
  })

  it('still ships the demo fixture kit', () => {
    expect(existsSync(join(repoRoot, 'products/demo/brand-kit/manifest.json'))).toBe(true)
    expect(existsSync(join(repoRoot, 'products/demo/governance/approval-policy.json'))).toBe(true)
  })
})
