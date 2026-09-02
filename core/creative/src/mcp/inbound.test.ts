import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { decryptSecret, encryptSecret } from '../performance/encrypt'
import {
  assertInboundMcpTransport,
  buildMcpCatalogRow,
  disconnectInboundMcpServer,
  HOSTED_LOCALHOST_MCP_COPY,
  HOSTED_REMOTE_ONLY_MCP_COPY,
  hostedMcpRejectCopy,
  listInboundMcpServers,
  loadEnabledMcpToolIdsForProduct,
  loadMcpCatalogRowsForProduct,
  MCP_TOOL_STALE_WARNING,
  mcpToolCatalogId,
  parseMcpToolCatalogId,
  parseMcpToolsListResult,
  pingInboundMcpServer,
  refreshInboundMcpTools,
  registerInboundMcpServer,
  removeMcpCatalogTool,
  setMcpToolEnabled,
  STDIO_HEALTH_MESSAGE,
  STDIO_REFRESH_MESSAGE,
  toPublicMcpServer,
} from './inbound'

const KEY = 'a'.repeat(64)
const SERVER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const migrationSql = readFileSync(
  path.join(process.cwd(), '../../supabase/migrations/0056_inbound_mcp_servers.sql'),
  'utf8',
)
const catalogMigrationSql = readFileSync(
  path.join(process.cwd(), '../../supabase/migrations/0061_mcp_enabled_tools_catalog.sql'),
  'utf8',
)
const staleMigrationSql = readFileSync(
  path.join(process.cwd(), '../../supabase/migrations/0062_mcp_enabled_tools_stale.sql'),
  'utf8',
)

type Row = Record<string, unknown>

const mockSupabase = (stores: Record<string, Row[]>) => {
  const from = (table: string) => {
    if (!stores[table]) stores[table] = []
    let mode: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select'
    let payload: Row | Row[] | undefined
    const filters: Record<string, string | string[]> = {}
    const match = () =>
      stores[table].filter((row) =>
        Object.entries(filters).every(([column, value]) => {
          if (Array.isArray(value)) return value.map(String).includes(String(row[column]))
          return String(row[column]) === String(value)
        }),
      )
    const run = async () => {
      if (mode === 'insert' && payload && !Array.isArray(payload)) {
        const row = {
          id: SERVER_ID,
          last_health_at: null,
          last_health_error: null,
          ...payload,
        }
        stores[table].push(row)
        return { data: row, error: null }
      }
      if (mode === 'upsert' && Array.isArray(payload)) {
        for (const next of payload) {
          const key = `${String(next.server_id)}:${String(next.tool_name)}`
          const index = stores[table].findIndex(
            (row) => `${String(row.server_id)}:${String(row.tool_name)}` === key,
          )
          if (index >= 0) stores[table][index] = { ...stores[table][index], ...next }
          else stores[table].push(next)
        }
        return { data: payload, error: null }
      }
      if (mode === 'update' && payload && !Array.isArray(payload)) {
        for (const row of match()) Object.assign(row, payload)
        return { data: match()[0] ?? null, error: null }
      }
      if (mode === 'delete') {
        stores[table] = stores[table].filter((row) => {
          const matched = Object.entries(filters).every(([column, value]) => {
            if (Array.isArray(value)) return value.map(String).includes(String(row[column]))
            return String(row[column]) === String(value)
          })
          return !matched
        })
        return { data: null, error: null }
      }
      return { data: match(), error: null }
    }
    const builder: Record<string, unknown> = {
      select: () => builder,
      insert: (next: Row) => {
        mode = 'insert'
        payload = next
        return builder
      },
      upsert: (next: Row[]) => {
        mode = 'upsert'
        payload = next
        return builder
      },
      update: (next: Row) => {
        mode = 'update'
        payload = next
        return builder
      },
      delete: () => {
        mode = 'delete'
        return builder
      },
      eq: (column: string, value: string) => {
        filters[column] = value
        return builder
      },
      in: (column: string, values: string[]) => {
        filters[column] = values
        return builder
      },
      order: () => builder,
      single: async () => {
        const result = await run()
        const data = Array.isArray(result.data) ? result.data[0] : result.data
        return { data, error: result.error }
      },
      maybeSingle: async () => {
        const result = await run()
        const data = Array.isArray(result.data) ? (result.data[0] ?? null) : result.data
        return { data, error: result.error }
      },
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        run().then(resolve, reject),
    }
    return builder
  }
  return { from }
}

describe('inbound MCP registration (#957)', () => {
  it('creates Product-scoped servers with encrypted credentials and RLS', () => {
    expect(migrationSql).toContain('create table public.mcp_servers')
    expect(migrationSql).toContain('create table public.mcp_enabled_tools')
    expect(migrationSql).toContain("transport in ('https', 'stdio', 'loopback')")
    expect(migrationSql).toContain('auth_ciphertext')
    expect(migrationSql).toContain("is_product_member(product_id, 'editor')")
  })

  it('allows HTTPS remotes on hosted and rejects localhost', () => {
    expect(() =>
      assertInboundMcpTransport({
        transport: 'https',
        endpoint: 'https://mcp.example.com/sse',
        hosted: true,
      }),
    ).not.toThrow()
    expect(() =>
      assertInboundMcpTransport({
        transport: 'loopback',
        endpoint: 'http://127.0.0.1:3001',
        hosted: true,
      }),
    ).toThrow(/HTTPS remote/)
    expect(() =>
      assertInboundMcpTransport({
        transport: 'https',
        endpoint: 'http://mcp.example.com',
        hosted: true,
      }),
    ).toThrow(/https:\/\//)
    expect(() =>
      assertInboundMcpTransport({
        transport: 'https',
        endpoint: 'https://127.0.0.1/mcp',
        hosted: true,
      }),
    ).toThrow(/localhost/)
  })

  it('allows loopback only when not hosted', () => {
    expect(() =>
      assertInboundMcpTransport({
        transport: 'loopback',
        endpoint: 'http://127.0.0.1:3939',
        hosted: false,
      }),
    ).not.toThrow()
  })

  it('rejects hosted localhost and stdio with a full sentence (#960)', () => {
    expect(HOSTED_LOCALHOST_MCP_COPY).toMatch(/cannot reach localhost/)
    expect(HOSTED_REMOTE_ONLY_MCP_COPY).toMatch(/HTTPS remote/)
    expect(
      hostedMcpRejectCopy({
        transport: 'https',
        endpoint: 'https://127.0.0.1/mcp',
        hosted: true,
      }),
    ).toBe(HOSTED_LOCALHOST_MCP_COPY)
    expect(
      hostedMcpRejectCopy({
        transport: 'https',
        endpoint: 'http://127.0.0.1:3001/mcp',
        hosted: true,
      }),
    ).toBe(HOSTED_LOCALHOST_MCP_COPY)
    expect(
      hostedMcpRejectCopy({
        transport: 'stdio',
        endpoint: 'npx -y local-mcp',
        hosted: true,
      }),
    ).toBe(HOSTED_REMOTE_ONLY_MCP_COPY)
    expect(
      hostedMcpRejectCopy({
        transport: 'loopback',
        endpoint: 'http://127.0.0.1:3939',
        hosted: true,
      }),
    ).toBe(HOSTED_REMOTE_ONLY_MCP_COPY)
    expect(() =>
      assertInboundMcpTransport({
        transport: 'stdio',
        endpoint: 'npx -y local-mcp',
        hosted: true,
      }),
    ).toThrow(HOSTED_REMOTE_ONLY_MCP_COPY)
  })

  it('allows OSS local transports when hosted is false (#960 test flag)', () => {
    expect(
      hostedMcpRejectCopy({
        transport: 'stdio',
        endpoint: 'npx -y local-mcp',
        hosted: false,
      }),
    ).toBeNull()
    expect(() =>
      assertInboundMcpTransport({
        transport: 'stdio',
        endpoint: 'npx -y local-mcp',
        hosted: false,
      }),
    ).not.toThrow()
  })

  it('never puts ciphertext on the public row', () => {
    const row = toPublicMcpServer({
      id: SERVER_ID,
      product_id: 'demo',
      display_name: 'Renderer',
      transport: 'https',
      endpoint: 'https://mcp.example.com',
      status: 'disconnected',
      last_health_at: null,
      last_health_error: null,
      auth_ciphertext: 'SECRET',
    })
    expect(row.hasAuth).toBe(true)
    expect(JSON.stringify(row)).not.toMatch(/SECRET/)
    expect(row).not.toHaveProperty('authCiphertext')
  })

  it('encrypts the auth token at rest and lists without secrets', async () => {
    const stores = { mcp_servers: [] as Row[] }
    const env = { PERFORMANCE_TOKEN_KEY: KEY }
    const registered = await registerInboundMcpServer({
      supabase: mockSupabase(stores) as never,
      productId: 'demo',
      displayName: 'Renderer',
      transport: 'https',
      endpoint: 'https://mcp.example.com/sse',
      authToken: 'sk-live-secret',
      hosted: true,
      env,
    })
    expect(registered.hasAuth).toBe(true)
    expect(JSON.stringify(registered)).not.toMatch(/sk-live-secret/)
    const stored = stores.mcp_servers[0]
    expect(stored?.auth_ciphertext).toBeTruthy()
    expect(String(stored?.auth_ciphertext)).not.toContain('sk-live-secret')
    expect(
      decryptSecret(
        {
          ciphertext: String(stored?.auth_ciphertext),
          nonce: String(stored?.auth_nonce),
        },
        KEY,
      ),
    ).toBe('sk-live-secret')

    const listed = await listInboundMcpServers(mockSupabase(stores) as never, 'demo')
    expect(JSON.stringify(listed)).not.toMatch(/sk-live-secret/)
    expect(listed[0]?.hasAuth).toBe(true)
  })

  it('requires an auth token on hosted HTTPS', async () => {
    await expect(
      registerInboundMcpServer({
        supabase: mockSupabase({ mcp_servers: [] }) as never,
        productId: 'demo',
        displayName: 'Renderer',
        transport: 'https',
        endpoint: 'https://mcp.example.com/sse',
        hosted: true,
        env: { PERFORMANCE_TOKEN_KEY: KEY },
      }),
    ).rejects.toThrow(/auth token/)
  })

  it('pings HTTPS with the decrypted token and never returns it', async () => {
    const sealed = encryptSecret('sk-live-secret', KEY)
    const stores = {
      mcp_servers: [
        {
          id: SERVER_ID,
          product_id: 'demo',
          display_name: 'Renderer',
          transport: 'https',
          endpoint: 'https://mcp.example.com/sse',
          auth_ciphertext: sealed.ciphertext,
          auth_nonce: sealed.nonce,
          status: 'disconnected',
          last_health_at: null,
          last_health_error: null,
        },
      ] as Row[],
    }
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      expect(headers.get('Authorization')).toBe('Bearer sk-live-secret')
      return { ok: true, status: 200 } as Response
    })
    const result = await pingInboundMcpServer({
      supabase: mockSupabase(stores) as never,
      productId: 'demo',
      serverId: SERVER_ID,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      hosted: true,
      env: { PERFORMANCE_TOKEN_KEY: KEY },
    })
    expect(result.status).toBe('connected')
    expect(JSON.stringify(result)).not.toMatch(/sk-live-secret/)
    expect(stores.mcp_servers[0]?.status).toBe('connected')
  })

  it('does not spawn stdio on health ping', async () => {
    const stores = {
      mcp_servers: [
        {
          id: SERVER_ID,
          product_id: 'demo',
          display_name: 'Local renderer',
          transport: 'stdio',
          endpoint: 'npx -y fake-mcp',
          status: 'disconnected',
          last_health_at: null,
          last_health_error: null,
        },
      ] as Row[],
    }
    const fetchImpl = vi.fn()
    const result = await pingInboundMcpServer({
      supabase: mockSupabase(stores) as never,
      productId: 'demo',
      serverId: SERVER_ID,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      hosted: false,
      env: { PERFORMANCE_TOKEN_KEY: KEY },
    })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(result.lastHealthError).toBe(STDIO_HEALTH_MESSAGE)
    expect(result.status).toBe('disconnected')
  })

  it('disconnects by deleting the Product-scoped row', async () => {
    const stores = {
      mcp_servers: [{ id: SERVER_ID, product_id: 'demo' }] as Row[],
    }
    await disconnectInboundMcpServer(mockSupabase(stores) as never, {
      productId: 'demo',
      serverId: SERVER_ID,
    })
    expect(stores.mcp_servers).toEqual([])
  })
})

describe('inbound MCP tools/list refresh (#1084)', () => {
  it('stores catalog metadata columns on mcp_enabled_tools', () => {
    expect(catalogMigrationSql).toContain('add column description text')
    expect(catalogMigrationSql).toContain('add column input_schema jsonb')
    expect(catalogMigrationSql).toContain('add column discovered_at timestamptz')
  })

  it('parses tools/list and builds non-locked catalog ids', () => {
    const tools = parseMcpToolsListResult({
      jsonrpc: '2.0',
      id: 2,
      result: {
        tools: [
          {
            name: 'search',
            description: 'Search docs',
            inputSchema: { type: 'object', properties: { q: { type: 'string' } } },
          },
        ],
      },
    })
    expect(tools).toEqual([
      {
        name: 'search',
        description: 'Search docs',
        inputSchema: { type: 'object', properties: { q: { type: 'string' } } },
      },
    ])
    const row = buildMcpCatalogRow({
      serverId: SERVER_ID,
      toolName: 'inspect_preview',
      enabled: false,
    })
    expect(row.id).toBe(mcpToolCatalogId(SERVER_ID, 'inspect_preview'))
    expect(row.kind).toBe('optional')
    expect(row.source).toBe('mcp')
    expect(row.toggleable).toBe(true)
    expect(row.kind).not.toBe('locked')
  })

  it('refreshes tools/list into mcp_enabled_tools with new tools off', async () => {
    const sealed = encryptSecret('sk-live-secret', KEY)
    const stores = {
      mcp_servers: [
        {
          id: SERVER_ID,
          product_id: 'demo',
          display_name: 'Renderer',
          transport: 'https',
          endpoint: 'https://mcp.example.com/sse',
          auth_ciphertext: sealed.ciphertext,
          auth_nonce: sealed.nonce,
          status: 'connected',
          last_health_at: null,
          last_health_error: null,
        },
      ] as Row[],
      mcp_enabled_tools: [
        {
          server_id: SERVER_ID,
          tool_name: 'search',
          enabled: true,
          description: 'Old',
          input_schema: null,
          discovered_at: '2026-01-01T00:00:00.000Z',
        },
      ] as Row[],
    }
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { method: string }
      if (body.method === 'initialize') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ jsonrpc: '2.0', id: 1, result: { protocolVersion: '2024-11-05' } }),
        } as Response
      }
      expect(body.method).toBe('tools/list')
      return {
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: 2,
          result: {
            tools: [
              { name: 'search', description: 'Search docs', inputSchema: { type: 'object' } },
              { name: 'render', description: 'Render clip', inputSchema: { type: 'object' } },
            ],
          },
        }),
      } as Response
    })
    const result = await refreshInboundMcpTools({
      supabase: mockSupabase(stores) as never,
      productId: 'demo',
      serverId: SERVER_ID,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      hosted: true,
      env: { PERFORMANCE_TOKEN_KEY: KEY },
    })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(result.tools).toHaveLength(2)
    const search = result.tools.find((tool) => tool.toolName === 'search')
    const render = result.tools.find((tool) => tool.toolName === 'render')
    expect(search?.enabled).toBe(true)
    expect(search?.description).toBe('Search docs')
    expect(render?.enabled).toBe(false)
    expect(render?.description).toBe('Render clip')
    expect(stores.mcp_enabled_tools).toHaveLength(2)
  })

  it('loads MCP catalog rows for a Product', async () => {
    const stores = {
      mcp_servers: [{ id: SERVER_ID, product_id: 'demo' }] as Row[],
      mcp_enabled_tools: [
        {
          server_id: SERVER_ID,
          tool_name: 'search',
          enabled: false,
          description: 'Search docs',
          input_schema: { type: 'object' },
          discovered_at: '2026-01-01T00:00:00.000Z',
        },
      ] as Row[],
    }
    const rows = await loadMcpCatalogRowsForProduct(mockSupabase(stores) as never, 'demo')
    expect(rows).toEqual([
      {
        id: mcpToolCatalogId(SERVER_ID, 'search'),
        name: 'search',
        source: 'mcp',
        kind: 'optional',
        enabled: false,
        toggleable: true,
        warning: null,
      },
    ])
  })

  it('does not refresh stdio servers from Settings', async () => {
    const stores = {
      mcp_servers: [
        {
          id: SERVER_ID,
          product_id: 'demo',
          display_name: 'Local renderer',
          transport: 'stdio',
          endpoint: 'npx -y fake-mcp',
          status: 'disconnected',
          last_health_at: null,
          last_health_error: null,
        },
      ] as Row[],
      mcp_enabled_tools: [] as Row[],
    }
    await expect(
      refreshInboundMcpTools({
        supabase: mockSupabase(stores) as never,
        productId: 'demo',
        serverId: SERVER_ID,
        hosted: false,
        env: { PERFORMANCE_TOKEN_KEY: KEY },
      }),
    ).rejects.toThrow(STDIO_REFRESH_MESSAGE)
    expect(STDIO_HEALTH_MESSAGE).toMatch(/Local command servers/)
  })
})

describe('inbound MCP enable/disable (#1085)', () => {
  it('parses mcp catalog ids', () => {
    expect(parseMcpToolCatalogId(mcpToolCatalogId(SERVER_ID, 'search'))).toEqual({
      serverId: SERVER_ID,
      toolName: 'search',
    })
    expect(parseMcpToolCatalogId('inspect_preview')).toBeNull()
    expect(parseMcpToolCatalogId('mcp:not-a-uuid:search')).toBeNull()
  })

  it('persists enable and disable on mcp_enabled_tools', async () => {
    const catalogId = mcpToolCatalogId(SERVER_ID, 'search')
    const stores = {
      mcp_servers: [{ id: SERVER_ID, product_id: 'demo' }] as Row[],
      mcp_enabled_tools: [
        {
          server_id: SERVER_ID,
          tool_name: 'search',
          enabled: false,
          description: 'Search docs',
          input_schema: { type: 'object' },
          discovered_at: '2026-01-01T00:00:00.000Z',
        },
      ] as Row[],
    }
    const supabase = mockSupabase(stores) as never

    await setMcpToolEnabled({
      supabase,
      productId: 'demo',
      catalogId,
      enabled: true,
    })
    expect(stores.mcp_enabled_tools[0]?.enabled).toBe(true)

    await setMcpToolEnabled({
      supabase,
      productId: 'demo',
      catalogId,
      enabled: false,
    })
    expect(stores.mcp_enabled_tools[0]?.enabled).toBe(false)
  })

  it('loads enabled MCP tool ids for the allowlist store', async () => {
    const stores = {
      mcp_servers: [{ id: SERVER_ID, product_id: 'demo' }] as Row[],
      mcp_enabled_tools: [
        {
          server_id: SERVER_ID,
          tool_name: 'search',
          enabled: true,
          description: null,
          input_schema: null,
          discovered_at: '2026-01-01T00:00:00.000Z',
        },
        {
          server_id: SERVER_ID,
          tool_name: 'render',
          enabled: false,
          description: null,
          input_schema: null,
          discovered_at: '2026-01-01T00:00:00.000Z',
        },
      ] as Row[],
    }
    const ids = await loadEnabledMcpToolIdsForProduct(mockSupabase(stores) as never, 'demo')
    expect(ids).toEqual([mcpToolCatalogId(SERVER_ID, 'search')])
  })

  it('rejects toggling a tool from another Product', async () => {
    const stores = {
      mcp_servers: [{ id: SERVER_ID, product_id: 'other' }] as Row[],
      mcp_enabled_tools: [
        {
          server_id: SERVER_ID,
          tool_name: 'search',
          enabled: false,
          description: null,
          input_schema: null,
          discovered_at: '2026-01-01T00:00:00.000Z',
        },
      ] as Row[],
    }
    await expect(
      setMcpToolEnabled({
        supabase: mockSupabase(stores) as never,
        productId: 'demo',
        catalogId: mcpToolCatalogId(SERVER_ID, 'search'),
        enabled: true,
      }),
    ).rejects.toThrow(/not found/)
  })
})

describe('inbound MCP stale tools (#1086)', () => {
  it('migration adds stale column', () => {
    expect(staleMigrationSql).toContain('add column stale boolean')
  })

  it('marks missing tools stale on refresh instead of deleting', async () => {
    const sealed = encryptSecret('sk-live-secret', KEY)
    const stores = {
      mcp_servers: [
        {
          id: SERVER_ID,
          product_id: 'demo',
          display_name: 'Renderer',
          transport: 'https',
          endpoint: 'https://mcp.example.com/sse',
          auth_ciphertext: sealed.ciphertext,
          auth_nonce: sealed.nonce,
          status: 'connected',
          last_health_at: null,
          last_health_error: null,
        },
      ] as Row[],
      mcp_enabled_tools: [
        {
          server_id: SERVER_ID,
          tool_name: 'search',
          enabled: true,
          stale: false,
          description: 'Search docs',
          input_schema: null,
          discovered_at: '2026-01-01T00:00:00.000Z',
        },
        {
          server_id: SERVER_ID,
          tool_name: 'gone',
          enabled: true,
          stale: false,
          description: 'Old tool',
          input_schema: null,
          discovered_at: '2026-01-01T00:00:00.000Z',
        },
      ] as Row[],
    }
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { method: string }
      if (body.method === 'initialize') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ jsonrpc: '2.0', id: 1, result: { protocolVersion: '2024-11-05' } }),
        } as Response
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: 2,
          result: {
            tools: [
              { name: 'search', description: 'Search docs', inputSchema: { type: 'object' } },
            ],
          },
        }),
      } as Response
    })
    await refreshInboundMcpTools({
      supabase: mockSupabase(stores) as never,
      productId: 'demo',
      serverId: SERVER_ID,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      hosted: true,
      env: { PERFORMANCE_TOKEN_KEY: KEY },
    })
    const gone = stores.mcp_enabled_tools.find((row) => row.tool_name === 'gone')
    expect(gone?.stale).toBe(true)
    expect(gone?.enabled).toBe(false)
    expect(stores.mcp_enabled_tools).toHaveLength(2)
  })

  it('excludes stale tools from enabled allowlist', async () => {
    const stores = {
      mcp_servers: [{ id: SERVER_ID, product_id: 'demo' }] as Row[],
      mcp_enabled_tools: [
        {
          server_id: SERVER_ID,
          tool_name: 'search',
          enabled: true,
          stale: true,
          description: null,
          input_schema: null,
          discovered_at: '2026-01-01T00:00:00.000Z',
        },
      ] as Row[],
    }
    const ids = await loadEnabledMcpToolIdsForProduct(mockSupabase(stores) as never, 'demo')
    expect(ids).toEqual([])
    const rows = await loadMcpCatalogRowsForProduct(mockSupabase(stores) as never, 'demo')
    expect(rows[0]?.stale).toBe(true)
    expect(rows[0]?.warning).toBe(MCP_TOOL_STALE_WARNING)
  })

  it('rejects enabling a stale tool', async () => {
    const stores = {
      mcp_servers: [{ id: SERVER_ID, product_id: 'demo' }] as Row[],
      mcp_enabled_tools: [
        {
          server_id: SERVER_ID,
          tool_name: 'search',
          enabled: false,
          stale: true,
          description: null,
          input_schema: null,
          discovered_at: '2026-01-01T00:00:00.000Z',
        },
      ] as Row[],
    }
    await expect(
      setMcpToolEnabled({
        supabase: mockSupabase(stores) as never,
        productId: 'demo',
        catalogId: mcpToolCatalogId(SERVER_ID, 'search'),
        enabled: true,
      }),
    ).rejects.toThrow(/Stale MCP tools/)
  })

  it('removeMcpCatalogTool deletes the row', async () => {
    const stores = {
      mcp_servers: [{ id: SERVER_ID, product_id: 'demo' }] as Row[],
      mcp_enabled_tools: [
        {
          server_id: SERVER_ID,
          tool_name: 'search',
          enabled: false,
          stale: true,
          description: null,
          input_schema: null,
          discovered_at: '2026-01-01T00:00:00.000Z',
        },
      ] as Row[],
    }
    await removeMcpCatalogTool({
      supabase: mockSupabase(stores) as never,
      productId: 'demo',
      catalogId: mcpToolCatalogId(SERVER_ID, 'search'),
    })
    expect(stores.mcp_enabled_tools).toHaveLength(0)
  })
})
