import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { compileAuthoredComposition } from '../authored/compile'
import { toAuthoredInputProps } from '../authored/input-props'
import { LEGAL_AUTHORED_FIXTURE } from '../authored/fixtures'
import { createEmptyProject, parseStudioProject } from '../project/schema'

describe('authored render plan', () => {
  it('does not substitute talking-head-60 when authored source is legal', () => {
    const project = parseStudioProject({
      ...createEmptyProject({
        id: '22222222-2222-4222-8222-222222222222',
        productId: 'demo',
        compositionId: 'authored',
      }),
      compositionSource: {
        source: LEGAL_AUTHORED_FIXTURE,
        motionSeed: 'seed-render-1',
        compileError: null,
      },
    })
    expect(project.compositionId).toBe('authored')
    const compiled = compileAuthoredComposition(project.compositionSource!.source)
    expect(compiled.ok).toBe(true)
    const props = toAuthoredInputProps(project, (key) => `https://blobs.example/${key}`)
    expect(props.motionSeed).toBe('seed-render-1')
    expect(JSON.stringify(props)).not.toMatch(/talking-head-60/)
  })

  it('encode host mixes timeline audio via Path C wrap (#1257)', () => {
    const wrapDir = fileURLToPath(new URL('../authored/', import.meta.url))
    const wrap = readFileSync(join(wrapDir, 'path-c-wrap.tsx'), 'utf8')
    const bundle = readFileSync(join(wrapDir, 'bundle-for-render.ts'), 'utf8')
    expect(wrap).toMatch(/\bAudio\b/)
    expect(wrap).toMatch(/parseAuthoredAudioClips/)
    expect(bundle).toMatch(/AuthoredPathCWrap/)
    expect(bundle).toMatch(/path-c-wrap\.tsx/)
  })

  it('surfaces compile failure instead of falling back to talking-head', () => {
    const result = compileAuthoredComposition(
      `import fs from 'node:fs'\nexport default () => null\n`,
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.compileError).toMatch(/Blocked import/)
    expect(result.compileError).not.toMatch(/talking-head/)
  })
})
