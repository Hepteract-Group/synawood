import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const panel = readFileSync(
  join(root, 'app/(app)/settings/agent-tools/agent-tools-panel.tsx'),
  'utf8',
)
const nav = readFileSync(join(root, 'app/(app)/settings/settings-local-nav.tsx'), 'utf8')
const overview = readFileSync(join(root, 'app/(app)/settings/page.tsx'), 'utf8')
const route = readFileSync(join(root, 'app/api/studio/agent-tools/route.ts'), 'utf8')

describe('Agent tools settings (#962)', () => {
  it('puts Agent tools on Settings nav and overview', () => {
    expect(nav).toContain('/settings/agent-tools')
    expect(nav).toContain('Agent tools')
    expect(overview).toContain('/settings/agent-tools')
    expect(overview).toContain('generate_video_clip')
  })

  it('warns in a banner when generate_video_clip is off', () => {
    expect(panel).toContain('role="alert"')
    expect(panel).toContain('generate_video_clip')
    expect(panel).toContain('Cut review is not skipped')
    expect(panel).toContain('No inbound MCP servers yet')
    expect(panel).toContain('Register MCP server')
    expect(panel).toContain('/api/studio/mcp-servers')
    expect(panel).toContain('role="switch"')
  })

  it('persists optional disables per Product over the agent-tools route', () => {
    expect(route).toContain('disabled_optional_tools')
    expect(route).toContain('loadMcpCatalogRowsForProduct')
    expect(route).toContain('setMcpToolEnabled')
    expect(route).toContain('removeMcpCatalogTool')
    expect(route).toContain('mcpToolRemove')
    expect(route).toContain('buildFirstPartyToolCatalog')
    expect(route).toContain("minRole: 'editor'")
  })

  it('wires MCP catalog toggles in the panel', () => {
    expect(panel).toContain('onToggleMcp')
    expect(panel).toContain('onRemoveMcp')
    expect(panel).toContain('mcpToolRemove')
    expect(panel).toContain('Stale — no longer returned by the server')
    expect(panel).toContain('mcpTool')
    expect(panel).toContain('catalogId')
    expect(panel).toContain('New tools stay off until you turn them on here')
  })
})
