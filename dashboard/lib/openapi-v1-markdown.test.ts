import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mcpProxyViolations } from '@synawood/creative/tools/public-api-v1'
import { buildOpenApiV1, OPENAPI_V1_PATHS } from './openapi-v1'
import { renderOpenApiV1Markdown } from './openapi-v1-markdown'

const docsPath = join(process.cwd(), '../docs/api/v1/README.md')

describe('docs/api/v1 reference (#281)', () => {
  it('renders the generated spec into committed markdown without mcp verbs', () => {
    const spec = buildOpenApiV1()
    const markdown = renderOpenApiV1Markdown(spec)
    expect(readFileSync(docsPath, 'utf8')).toBe(markdown)
    for (const path of OPENAPI_V1_PATHS) {
      expect(markdown).toContain(path)
    }
    expect(markdown).toContain('Bearer')
    expect(markdown).toContain('Idempotency-Key')
    expect(markdown).not.toMatch(/mcp:/)
    expect(mcpProxyViolations({ routeRelPaths: [], openApiText: markdown })).toEqual([])
  })
})
