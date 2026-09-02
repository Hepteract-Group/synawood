import { describe, expect, it } from 'vitest'
import { buildFirstPartyToolCatalog } from './first-party-catalog'
import {
  isAllowedV1Verb,
  isMcpToolId,
  mcpProxyViolations,
  registeredV1VerbsFromPaths,
} from './public-api-v1'

describe('public API v1 first-party only (#963)', () => {
  it('fails when a mcp: verb or route is registered', () => {
    expect(isMcpToolId('mcp:srv:search')).toBe(true)
    expect(isMcpToolId('inspect_preview')).toBe(false)
    expect(
      mcpProxyViolations({
        routeRelPaths: ['health/route.ts'],
        verbNames: ['inspect_preview', 'mcp:srv:search'],
      }),
    ).toEqual(['mcp:srv:search'])
    expect(
      mcpProxyViolations({
        routeRelPaths: ['mcp:search/route.ts'],
        openApiText: 'paths:\n  /mcp:foo:',
      }),
    ).toEqual(['mcp:search/route.ts', 'openapi:mcp:'])
    expect(mcpProxyViolations({ routeRelPaths: ['health/route.ts'] })).toEqual([])
    expect(mcpProxyViolations({ routeRelPaths: ['mcp-servers.ts'] })).toEqual([])
    expect(mcpProxyViolations({ routeRelPaths: ['mcp/proxy/route.ts'] })).toEqual([
      'mcp/proxy/route.ts',
    ])
  })

  it('keeps enabled inbound MCP tools off the v1 allowlist', () => {
    const catalog = buildFirstPartyToolCatalog({
      mcpRows: [
        {
          id: 'mcp:srv:search',
          name: 'search',
          source: 'mcp',
          kind: 'optional',
          enabled: true,
          toggleable: true,
          warning: null,
        },
      ],
    })
    const mcpIds = catalog.filter((row) => row.source === 'mcp').map((row) => row.id)
    const registered = registeredV1VerbsFromPaths(['health/route.ts', 'inspect_preview/route.ts'])
    expect(mcpIds).toContain('mcp:srv:search')
    expect(isAllowedV1Verb('health')).toBe(true)
    expect(isAllowedV1Verb('projects/[projectId]')).toBe(true)
    expect(isAllowedV1Verb('inspect_preview')).toBe(true)
    expect(isAllowedV1Verb('projects')).toBe(false)
    expect(
      registeredV1VerbsFromPaths([
        'health/route.ts',
        'projects/[projectId]/route.ts',
        'add_clip/route.ts',
        'trim_clip/route.ts',
        'remove_clip/route.ts',
      ]).every(isAllowedV1Verb),
    ).toBe(true)
    expect(mcpProxyViolations({ routeRelPaths: [], verbNames: registered })).toEqual([])
    expect(
      mcpProxyViolations({ routeRelPaths: [], verbNames: [...registered, ...mcpIds] }),
    ).toEqual(mcpIds)
    expect(mcpIds.every((id) => !isAllowedV1Verb(id))).toBe(true)
  })
})
