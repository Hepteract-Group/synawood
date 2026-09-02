import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  isAllowedV1Verb,
  mcpProxyViolations,
  registeredV1VerbsFromPaths,
} from '@synawood/creative/tools/public-api-v1'

const root = process.cwd()
const v1Dir = join(root, 'app/api/v1')

const listV1RelPaths = (): string[] => {
  if (!existsSync(v1Dir)) return []
  return readdirSync(v1Dir, { recursive: true }).map((entry) => String(entry))
}

describe('public /api/v1 filesystem (#963)', () => {
  it('registers no mcp: routes; every verb is health or a first-party tool', () => {
    const relPaths = listV1RelPaths()
    const routeBodies = relPaths
      .filter((path) => path.endsWith('.ts') || path.endsWith('.tsx'))
      .map((path) => readFileSync(join(v1Dir, path), 'utf8'))
      .join('\n')
    const openApiCandidates = [
      join(root, '../docs/api/v1/README.md'),
      join(root, '../docs/api/v1/openapi.yaml'),
      join(root, '../docs/api/v1/openapi.json'),
      join(root, 'lib/openapi-v1.ts'),
    ]
    const openApiText = openApiCandidates
      .filter((path) => existsSync(path))
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n')
    const registered = registeredV1VerbsFromPaths(relPaths)

    expect(
      mcpProxyViolations({
        routeRelPaths: relPaths,
        openApiText: openApiText || undefined,
        verbNames: registered,
      }),
    ).toEqual([])
    expect(routeBodies).not.toMatch(/mcp:/)
    expect(registered.every(isAllowedV1Verb)).toBe(true)
    expect(registered).toContain('projects/[projectId]')
  })
})
