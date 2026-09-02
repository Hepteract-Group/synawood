import { describe, expect, it } from 'vitest'
import { assertPackSafe, checkPackArchivePaths, checkPackManifest } from './safety'

describe('pack safety (#287)', () => {
  it('rejects path traversal and executables', () => {
    const issues = checkPackArchivePaths([
      { path: '../evil.md', size: 1 },
      { path: 'bin/run.sh', size: 10 },
      { path: 'node_modules/x', size: 1 },
    ])
    expect(issues.some((i) => i.code === 'path_traversal')).toBe(true)
    expect(issues.some((i) => i.code === 'executable')).toBe(true)
  })

  it('requires confirm spend when hinting generators', () => {
    const result = checkPackManifest({
      entryPaths: ['SKILL.md'],
      manifestRaw: {
        id: 'x',
        slug: 'x',
        kind: 'skill',
        semver: '1.0.0',
        title: 'X',
        entries: ['SKILL.md'],
        hintedTools: ['generate_image'],
        requiresConfirmSpend: false,
      },
    })
    expect(result.ok).toBe(false)
    expect(result.issues.some((i) => i.code === 'spend_without_confirm')).toBe(true)
  })

  it('accepts a clean skill pack', () => {
    const manifest = assertPackSafe({
      entries: [{ path: 'SKILL.md', size: 20 }],
      manifestRaw: {
        id: 'hooks-first-3s',
        slug: 'hooks-first-3s',
        kind: 'skill',
        semver: '1.0.0',
        title: 'Hooks',
        entries: ['SKILL.md'],
        requiresConfirmSpend: true,
      },
    })
    expect(manifest.slug).toBe('hooks-first-3s')
  })
})
