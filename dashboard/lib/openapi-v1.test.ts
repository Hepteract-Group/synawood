import { describe, expect, it } from 'vitest'
import { mcpProxyViolations } from '@synawood/creative/tools/public-api-v1'
import { buildOpenApiV1, OPENAPI_V1_PATHS } from './openapi-v1'

describe('OpenAPI from v1 Zod (#278)', () => {
  it('emits health and current first-party routes without mcp', () => {
    const spec = buildOpenApiV1()
    expect(spec.openapi).toMatch(/^3\./)
    expect(spec.paths['/api/v1/health']?.get).toBeTruthy()
    expect(spec.paths['/api/v1/projects/{projectId}']?.get).toBeTruthy()
    expect(spec.paths['/api/v1/projects/{projectId}']?.patch).toBeTruthy()
    expect(spec.paths['/api/v1/add_clip']?.post).toBeTruthy()
    expect(spec.paths['/api/v1/trim_clip']?.post).toBeTruthy()
    expect(spec.paths['/api/v1/remove_clip']?.post).toBeTruthy()
    const expectedPaths = [
      '/api/v1/add_clip',
      '/api/v1/health',
      '/api/v1/projects/{projectId}',
      '/api/v1/remove_clip',
      '/api/v1/trim_clip',
    ]
    expect(Object.keys(spec.paths).sort()).toEqual(expectedPaths)
    expect(OPENAPI_V1_PATHS).toEqual(expectedPaths)
    const text = JSON.stringify(spec)
    expect(mcpProxyViolations({ routeRelPaths: [], openApiText: text })).toEqual([])
    expect(text).toContain('Idempotency-Key')
    expect(text).toContain('bearerAuth')
    expect(text).toContain('projectId')
    expect(text).toContain('expectedRevision')
    expect(spec.paths['/api/v1/add_clip']?.post?.requestBody).toBeTruthy()
  })
})
