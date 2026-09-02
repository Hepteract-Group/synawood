/**
 * Tests for enabled inbound MCP tool wrapping into runTurn (#1087).
 * Acceptance criteria:
 *   - enabled MCP tool invocable in fixture turn
 *   - disabled tool absent from tool set
 *   - stale tool excluded from tool set
 *   - timeout applies (AbortError propagates as toolFail)
 *   - result size cap applies
 *
 * #1088 additions — tool_trace + Thoughts rendering:
 *   - fixture MCP call appears in tool_trace with catalogId as toolName
 *   - failure is in tool_trace with ok:false (not lost to console only)
 *   - mcpDisplayLabel extracts the friendly tool name from catalog IDs
 */

import { describe, expect, it, vi } from 'vitest'
import { mcpDisplayLabel } from './inbound-copy'
import { createEmptyProject } from '../project/schema'
import type { StudioToolContext } from '../tools/types'
import {
  buildMcpToolSet,
  MCP_MAX_RESULT_BYTES,
  MCP_TOOL_TIMEOUT_MS,
  safeMcpToolName,
} from './inbound-tools'
import { loadEnabledMcpToolsForTurn, mcpToolCatalogId } from './inbound'

const SERVER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const KEY = 'a'.repeat(64)

type Row = Record<string, unknown>

const mockSupabase = (stores: Record<string, Row[]>) => {
  const from = (table: string) => {
    if (!stores[table]) stores[table] = []
    const filters: Record<string, unknown> = {}
    let selectColumns = '*'
    let eqFilter: Record<string, unknown> = {}
    let inFilter: Record<string, string[]> = {}

    const match = () =>
      stores[table].filter((row) => {
        for (const [col, val] of Object.entries(eqFilter)) {
          if (String(row[col]) !== String(val)) return false
        }
        for (const [col, vals] of Object.entries(inFilter)) {
          if (!vals.map(String).includes(String(row[col]))) return false
        }
        return true
      })

    const builder: Record<string, unknown> = {
      select: (cols: string) => {
        selectColumns = cols
        void selectColumns
        return builder
      },
      eq: (col: string, val: unknown) => {
        eqFilter = { ...eqFilter, [col]: val }
        return builder
      },
      in: (col: string, vals: string[]) => {
        inFilter = { ...inFilter, [col]: vals }
        return builder
      },
      order: () => builder,
      then: (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: match(), error: null }).then(resolve),
    }
    void filters
    return builder
  }
  return { from }
}

const makeCtx = (): StudioToolContext => ({
  productId: 'demo',
  projectId: '22222222-2222-4222-8222-222222222222',
  project: createEmptyProject({
    id: '22222222-2222-4222-8222-222222222222',
    productId: 'demo',
  }),
  expectedRevision: 1,
  supabase: {} as never,
  blobEnv: {} as never,
  modelProfileId: 'founder-edit',
  persist: false,
  toolTrace: [],
})

describe('safeMcpToolName (#1087)', () => {
  it('replaces colons with underscores', () => {
    const name = safeMcpToolName(`mcp:${SERVER_ID}:search`)
    expect(name).not.toContain(':')
    expect(name).toMatch(/^[a-zA-Z0-9_-]+$/)
  })

  it('truncates to 64 chars', () => {
    const long = `mcp:${SERVER_ID}:${'a'.repeat(60)}`
    expect(safeMcpToolName(long).length).toBeLessThanOrEqual(64)
  })
})

describe('buildMcpToolSet (#1087)', () => {
  it('returns an empty set when no tools provided', () => {
    const ctx = makeCtx()
    const set = buildMcpToolSet({ tools: [], ctx })
    expect(Object.keys(set)).toHaveLength(0)
  })

  it('creates one SDK tool per enabled tool row', () => {
    const ctx = makeCtx()
    const catalogId = mcpToolCatalogId(SERVER_ID, 'search')
    const set = buildMcpToolSet({
      tools: [
        {
          catalogId,
          toolName: 'search',
          description: 'Search docs',
          inputSchema: { type: 'object', properties: { q: { type: 'string' } } },
          serverId: SERVER_ID,
          endpoint: 'https://mcp.example.com/sse',
          authCiphertext: null,
          authNonce: null,
        },
      ],
      ctx,
    })
    const sdkName = safeMcpToolName(catalogId)
    expect(Object.keys(set)).toContain(sdkName)
  })

  it('invokes tools/call and records a toolTrace entry on success', async () => {
    const ctx = makeCtx()
    const catalogId = mcpToolCatalogId(SERVER_ID, 'search')

    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { method: string; params: { name: string } }
      expect(body.method).toBe('tools/call')
      expect(body.params.name).toBe('search')
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: { content: [{ type: 'text', text: 'Found 3 docs' }] },
          }),
      } as Response
    })

    const set = buildMcpToolSet({
      tools: [
        {
          catalogId,
          toolName: 'search',
          description: 'Search docs',
          inputSchema: null,
          serverId: SERVER_ID,
          endpoint: 'https://mcp.example.com/sse',
          authCiphertext: null,
          authNonce: null,
        },
      ],
      ctx,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    const sdkName = safeMcpToolName(catalogId)
    const toolDef = set[sdkName]
    expect(toolDef).toBeDefined()
    const outcome = await (
      toolDef as unknown as { execute: (args: unknown) => Promise<unknown> }
    ).execute({
      q: 'freelancers',
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(outcome).toMatchObject({ ok: true })
    expect(ctx.toolTrace).toHaveLength(1)
    expect(ctx.toolTrace[0]?.toolName).toBe(catalogId)
    expect(ctx.toolTrace[0]?.outcome).toMatchObject({ ok: true, summary: 'Found 3 docs' })
  })

  it('records a toolFail entry when the server returns an error', async () => {
    const ctx = makeCtx()
    const catalogId = mcpToolCatalogId(SERVER_ID, 'search')

    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32000, message: 'Internal MCP error' },
        }),
    }))

    const set = buildMcpToolSet({
      tools: [
        {
          catalogId,
          toolName: 'search',
          description: null,
          inputSchema: null,
          serverId: SERVER_ID,
          endpoint: 'https://mcp.example.com/sse',
          authCiphertext: null,
          authNonce: null,
        },
      ],
      ctx,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    const sdkName = safeMcpToolName(catalogId)
    const outcome = await (
      set[sdkName] as unknown as { execute: (args: unknown) => Promise<unknown> }
    ).execute({})
    expect(outcome).toMatchObject({ ok: false })
    expect(ctx.toolTrace[0]?.outcome).toMatchObject({ ok: false, error: 'Internal MCP error' })
  })

  it('records a toolFail entry when the HTTP call times out', async () => {
    const ctx = makeCtx()
    const catalogId = mcpToolCatalogId(SERVER_ID, 'slow')

    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      // Simulate the AbortSignal firing immediately.
      if (init?.signal && (init.signal as AbortSignal).aborted) {
        const err = new DOMException('The operation was aborted.', 'AbortError')
        throw err
      }
      // Wait "forever" — the caller should abort us.
      await new Promise((_, reject) => {
        const s = init?.signal as AbortSignal | undefined
        if (s) s.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })
      return { ok: true } as Response
    })

    const set = buildMcpToolSet({
      tools: [
        {
          catalogId,
          toolName: 'slow',
          description: null,
          inputSchema: null,
          serverId: SERVER_ID,
          endpoint: 'https://mcp.example.com/sse',
          authCiphertext: null,
          authNonce: null,
        },
      ],
      ctx,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      timeoutMs: 1,
    })

    const sdkName = safeMcpToolName(catalogId)
    const outcome = await (
      set[sdkName] as unknown as { execute: (args: unknown) => Promise<unknown> }
    ).execute({})
    expect(outcome).toMatchObject({ ok: false })
    expect(ctx.toolTrace[0]?.outcome).toMatchObject({ ok: false })
  })

  it('records a toolFail entry when the response exceeds the size cap', async () => {
    const ctx = makeCtx()
    const catalogId = mcpToolCatalogId(SERVER_ID, 'big')

    const bigText = 'x'.repeat(MCP_MAX_RESULT_BYTES + 1)
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: { content: [{ type: 'text', text: bigText }] },
        }),
    }))

    const set = buildMcpToolSet({
      tools: [
        {
          catalogId,
          toolName: 'big',
          description: null,
          inputSchema: null,
          serverId: SERVER_ID,
          endpoint: 'https://mcp.example.com/sse',
          authCiphertext: null,
          authNonce: null,
        },
      ],
      ctx,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    const sdkName = safeMcpToolName(catalogId)
    const outcome = await (
      set[sdkName] as unknown as { execute: (args: unknown) => Promise<unknown> }
    ).execute({})
    expect(outcome).toMatchObject({ ok: false })
    const err = (ctx.toolTrace[0]?.outcome as { error?: string }).error ?? ''
    expect(err).toMatch(/exceeded/)
  })

  it('sends Authorization header when auth ciphertext is present', async () => {
    const ctx = makeCtx()
    const { encryptSecret } = await import('../performance/encrypt')
    const sealed = encryptSecret('sk-live-secret', KEY)
    const catalogId = mcpToolCatalogId(SERVER_ID, 'search')

    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      expect(headers.get('Authorization')).toBe('Bearer sk-live-secret')
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ jsonrpc: '2.0', id: 1, result: { content: [] } }),
      } as Response
    })

    const set = buildMcpToolSet({
      tools: [
        {
          catalogId,
          toolName: 'search',
          description: null,
          inputSchema: null,
          serverId: SERVER_ID,
          endpoint: 'https://mcp.example.com/sse',
          authCiphertext: sealed.ciphertext,
          authNonce: sealed.nonce,
        },
      ],
      ctx,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      env: { PERFORMANCE_TOKEN_KEY: KEY },
    })

    const sdkName = safeMcpToolName(catalogId)
    await (set[sdkName] as unknown as { execute: (args: unknown) => Promise<unknown> }).execute({})
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('exposed constants are reasonable', () => {
    expect(MCP_TOOL_TIMEOUT_MS).toBeGreaterThan(0)
    expect(MCP_MAX_RESULT_BYTES).toBeGreaterThan(0)
  })
})

describe('loadEnabledMcpToolsForTurn (#1087)', () => {
  it('returns enabled non-stale tools with server info', async () => {
    const stores = {
      mcp_servers: [
        {
          id: SERVER_ID,
          product_id: 'demo',
          endpoint: 'https://mcp.example.com/sse',
          auth_ciphertext: null,
          auth_nonce: null,
        },
      ] as Row[],
      mcp_enabled_tools: [
        {
          server_id: SERVER_ID,
          tool_name: 'search',
          enabled: true,
          stale: false,
          description: 'Search docs',
          input_schema: { type: 'object' },
        },
        {
          server_id: SERVER_ID,
          tool_name: 'disabled_tool',
          enabled: false,
          stale: false,
          description: null,
          input_schema: null,
        },
        {
          server_id: SERVER_ID,
          tool_name: 'stale_tool',
          enabled: true,
          stale: true,
          description: null,
          input_schema: null,
        },
      ] as Row[],
    }
    const rows = await loadEnabledMcpToolsForTurn(mockSupabase(stores) as never, 'demo')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.toolName).toBe('search')
    expect(rows[0]?.catalogId).toBe(mcpToolCatalogId(SERVER_ID, 'search'))
    expect(rows[0]?.endpoint).toBe('https://mcp.example.com/sse')
    expect(rows[0]?.description).toBe('Search docs')
  })

  it('returns empty array when the product has no MCP servers', async () => {
    const stores = {
      mcp_servers: [] as Row[],
      mcp_enabled_tools: [] as Row[],
    }
    const rows = await loadEnabledMcpToolsForTurn(mockSupabase(stores) as never, 'demo')
    expect(rows).toHaveLength(0)
  })

  it('excludes stale tools even if enabled=true', async () => {
    const stores = {
      mcp_servers: [
        {
          id: SERVER_ID,
          product_id: 'demo',
          endpoint: 'https://mcp.example.com/sse',
          auth_ciphertext: null,
          auth_nonce: null,
        },
      ] as Row[],
      mcp_enabled_tools: [
        {
          server_id: SERVER_ID,
          tool_name: 'ghost',
          enabled: true,
          stale: true,
          description: null,
          input_schema: null,
        },
      ] as Row[],
    }
    const rows = await loadEnabledMcpToolsForTurn(mockSupabase(stores) as never, 'demo')
    expect(rows).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// #1088 — tool_trace + Thoughts rendering
// ---------------------------------------------------------------------------

describe('mcpDisplayLabel (#1088)', () => {
  it('extracts the tool name from a well-formed catalog ID', () => {
    expect(mcpDisplayLabel(`mcp:${SERVER_ID}:search`)).toBe('search')
    expect(mcpDisplayLabel(`mcp:${SERVER_ID}:get_page_content`)).toBe('get_page_content')
  })

  it('returns null for first-party tool names', () => {
    expect(mcpDisplayLabel('inspect_preview')).toBeNull()
    expect(mcpDisplayLabel('generate_video_clip')).toBeNull()
    expect(mcpDisplayLabel('')).toBeNull()
  })

  it('returns null for malformed mcp: strings', () => {
    expect(mcpDisplayLabel('mcp:not-a-uuid:search')).toBeNull()
    expect(mcpDisplayLabel('mcp::search')).toBeNull()
  })
})

describe('fixture MCP call in tool_trace (#1088)', () => {
  it('records catalogId as toolName in tool_trace on success', async () => {
    const ctx = makeCtx()
    const catalogId = mcpToolCatalogId(SERVER_ID, 'fetch_docs')

    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: { content: [{ type: 'text', text: 'Docs fetched OK' }] },
        }),
    }))

    const set = buildMcpToolSet({
      tools: [
        {
          catalogId,
          toolName: 'fetch_docs',
          description: 'Fetch product docs',
          inputSchema: null,
          serverId: SERVER_ID,
          endpoint: 'https://mcp.example.com/sse',
          authCiphertext: null,
          authNonce: null,
        },
      ],
      ctx,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    const sdkName = safeMcpToolName(catalogId)
    await (set[sdkName] as unknown as { execute: (args: unknown) => Promise<unknown> }).execute({
      q: 'api',
    })

    // The tool_trace entry must exist and use the catalog ID as toolName so
    // the Thoughts section can detect it as MCP (via mcpDisplayLabel).
    expect(ctx.toolTrace).toHaveLength(1)
    expect(ctx.toolTrace[0]?.toolName).toBe(catalogId)
    expect(ctx.toolTrace[0]?.outcome).toMatchObject({ ok: true, summary: 'Docs fetched OK' })

    // Verify the display name the chat UI will show.
    expect(mcpDisplayLabel(ctx.toolTrace[0]!.toolName)).toBe('fetch_docs')
  })

  it('records failure in tool_trace with ok:false — not console-only', async () => {
    const ctx = makeCtx()
    const catalogId = mcpToolCatalogId(SERVER_ID, 'fetch_docs')

    // Spy on console.error; it must NOT be called for an MCP tool failure.
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32001, message: 'Tool execution failed' },
        }),
    }))

    const set = buildMcpToolSet({
      tools: [
        {
          catalogId,
          toolName: 'fetch_docs',
          description: null,
          inputSchema: null,
          serverId: SERVER_ID,
          endpoint: 'https://mcp.example.com/sse',
          authCiphertext: null,
          authNonce: null,
        },
      ],
      ctx,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    const sdkName = safeMcpToolName(catalogId)
    const outcome = await (
      set[sdkName] as unknown as { execute: (args: unknown) => Promise<unknown> }
    ).execute({})

    // Failure must be visible in tool_trace so Thoughts can render it.
    expect(ctx.toolTrace).toHaveLength(1)
    expect(ctx.toolTrace[0]?.outcome).toMatchObject({ ok: false, error: 'Tool execution failed' })
    expect(outcome).toMatchObject({ ok: false })

    // The failure must not have been swallowed to console only.
    expect(consoleSpy).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
