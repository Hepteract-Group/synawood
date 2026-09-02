import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createEmptyProject } from './client'

const clientSrc = readFileSync(fileURLToPath(new URL('./client.ts', import.meta.url)), 'utf8')

describe('project/client (#690)', () => {
  it('does not import Node project ops or node builtins', () => {
    const importLines = clientSrc
      .split('\n')
      .filter((line) => /^\s*export .* from /.test(line) || /^\s*from /.test(line))
      .join('\n')
    expect(importLines).not.toMatch(/from ['"]\.\/operations['"]/)
    expect(importLines).not.toMatch(/from ['"]\.\/load['"]/)
    expect(importLines).not.toMatch(/from ['"]\.\/save['"]/)
    expect(importLines).not.toMatch(/from ['"]\.\/history['"]/)
    expect(importLines).not.toMatch(/from ['"]\.\/upload-asset['"]/)
    expect(importLines).not.toMatch(/from ['"]\.\/ingest-asset-from-url['"]/)
    expect(importLines).not.toMatch(/node:crypto/)
    expect(importLines).not.toMatch(/node:fs/)
  })

  it('re-exports parseable project types for the browser', () => {
    const project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    expect(project.clips).toEqual([])
  })
})
