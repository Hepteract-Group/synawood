import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const panel = readFileSync(
  join(root, 'app/(app)/settings/agent-tools/agent-tools-panel.tsx'),
  'utf8',
)
const listRoute = readFileSync(join(root, 'app/api/studio/mcp-servers/route.ts'), 'utf8')
const healthRoute = readFileSync(
  join(root, 'app/api/studio/mcp-servers/[serverId]/health/route.ts'),
  'utf8',
)
const refreshRoute = readFileSync(
  join(root, 'app/api/studio/mcp-servers/[serverId]/refresh/route.ts'),
  'utf8',
)
const disconnectRoute = readFileSync(
  join(root, 'app/api/studio/mcp-servers/[serverId]/route.ts'),
  'utf8',
)

describe('inbound MCP registration (#957)', () => {
  it('registers Product-scoped servers from Settings without returning secrets', () => {
    expect(panel).toContain('Register MCP server')
    expect(panel).toContain('type="password"')
    expect(panel).toContain('Never shown again')
    expect(panel).toContain('Checking')
    expect(panel).toContain('schemaMissing')
    expect(panel).toContain('Finish database setup')
    expect(panel).toContain('health failed')
    expect(panel).toContain("transport !== 'stdio'")
    expect(panel).toContain('/api/studio/mcp-servers')
    expect(listRoute).toContain('registerInboundMcpServer')
    expect(listRoute).toContain("minRole: 'editor'")
    expect(listRoute).toContain('isHostedRuntime')
    expect(healthRoute).toContain('pingInboundMcpServer')
    expect(refreshRoute).toContain('refreshInboundMcpTools')
    expect(panel).toContain('Refresh tools')
    expect(panel).toContain('/refresh')
    expect(disconnectRoute).toContain('disconnectInboundMcpServer')
    expect(listRoute).not.toContain('auth_ciphertext')
    expect(healthRoute).not.toContain('auth_ciphertext')
  })
})

describe('hosted vs OSS MCP transports (#960)', () => {
  it('shows the hosted reject sentence under the URL field, not a toast only', () => {
    expect(panel).toContain('hostedMcpRejectCopy')
    expect(panel).toContain('mcp-endpoint-error')
    expect(panel).toContain('HOSTED_REMOTE_ONLY_MCP_COPY')
    expect(panel).toContain('HOSTED_LOCALHOST_MCP_COPY')
  })

  it('does not register an /api/v1 MCP proxy', () => {
    const v1 = readdirSync(join(root, 'app/api/v1'), { recursive: true }).join('\n')
    expect(v1).not.toMatch(/mcp/i)
  })
})
