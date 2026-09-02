/** Inbound MCP server registration (ADR-0081 / #957). */

import type { SupabaseClient } from '@supabase/supabase-js'
import { decryptSecret, encryptSecret, readPerformanceTokenKey } from '../performance/encrypt'
import type { ToolCatalogRow } from '../tools/first-party-catalog'
import { hostedMcpRejectCopy, type McpTransport } from './inbound-copy'

export type { McpTransport } from './inbound-copy'
export {
  HOSTED_LOCALHOST_MCP_COPY,
  HOSTED_REMOTE_ONLY_MCP_COPY,
  hostedMcpRejectCopy,
} from './inbound-copy'

export type McpServerPublic = {
  id: string
  productId: string
  displayName: string
  transport: McpTransport
  endpoint: string
  status: 'disconnected' | 'connected' | 'error'
  lastHealthAt: string | null
  lastHealthError: string | null
  hasAuth: boolean
}

export const MCP_TRANSPORTS: readonly McpTransport[] = ['https', 'stdio', 'loopback']

export const STDIO_HEALTH_MESSAGE =
  'Local command servers are not checked from this page. They run only on a self-hosted agent that can start the command.'

export const isMissingMcpSchema = (message: string): boolean =>
  /mcp_servers|schema cache/i.test(message)

const PUBLIC_SELECT =
  'id, product_id, display_name, transport, endpoint, status, last_health_at, last_health_error, auth_nonce'

export const isHostedRuntime = (env: NodeJS.ProcessEnv = process.env): boolean =>
  env.VERCEL === '1' || env.SYNAWOOD_HOSTED === 'true'

export const parseInboundMcpTransport = (raw: unknown): McpTransport => {
  if (typeof raw !== 'string') throw new Error('Transport is required.')
  const value = raw.trim() as McpTransport
  if (!MCP_TRANSPORTS.includes(value)) {
    throw new Error('Transport must be https, stdio, or loopback.')
  }
  return value
}

export const assertInboundMcpTransport = (input: {
  transport: McpTransport
  endpoint: string
  hosted?: boolean
}): void => {
  const endpoint = input.endpoint.trim()
  if (!endpoint) throw new Error('Endpoint is required.')
  const hosted = input.hosted ?? isHostedRuntime()
  const hostedReject = hostedMcpRejectCopy({
    transport: input.transport,
    endpoint,
    hosted,
  })
  if (hostedReject) throw new Error(hostedReject)

  if (input.transport === 'https') {
    if (!/^https:\/\//i.test(endpoint)) {
      throw new Error('HTTPS MCP must use an https:// URL.')
    }
    return
  }

  if (input.transport === 'loopback') {
    if (!/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/i.test(endpoint)) {
      throw new Error('Loopback MCP must target 127.0.0.1 or localhost.')
    }
  }
}

export const mcpCredentialKey = (env: NodeJS.ProcessEnv = process.env): string => {
  const dedicated = env.MCP_SERVER_KEY?.trim()
  if (dedicated) return dedicated
  const fallback = readPerformanceTokenKey(env)
  if (!fallback) {
    throw new Error('Set MCP_SERVER_KEY or PERFORMANCE_TOKEN_KEY to store MCP credentials.')
  }
  return fallback
}

export const toPublicMcpServer = (row: Record<string, unknown>): McpServerPublic => ({
  id: String(row.id),
  productId: String(row.product_id),
  displayName: String(row.display_name),
  transport: row.transport as McpTransport,
  endpoint: String(row.endpoint),
  status: row.status as McpServerPublic['status'],
  lastHealthAt: (row.last_health_at as string | null) ?? null,
  lastHealthError: (row.last_health_error as string | null) ?? null,
  hasAuth: Boolean(row.auth_ciphertext || row.auth_nonce),
})

export const listInboundMcpServers = async (
  supabase: SupabaseClient,
  productId: string,
): Promise<McpServerPublic[]> => {
  const { data, error } = await supabase
    .from('mcp_servers')
    .select(PUBLIC_SELECT)
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`List MCP servers failed: ${error.message}`)
  return (data ?? []).map((row) => toPublicMcpServer(row))
}

export const registerInboundMcpServer = async (input: {
  supabase: SupabaseClient
  productId: string
  displayName: string
  transport: McpTransport
  endpoint: string
  authToken?: string
  hosted?: boolean
  env?: NodeJS.ProcessEnv
}): Promise<McpServerPublic> => {
  const displayName = input.displayName.trim()
  if (!displayName) throw new Error('Display name is required.')
  if (displayName.length > 120) throw new Error('Display name is too long.')
  const endpoint = input.endpoint.trim()
  if (endpoint.length > 2048) throw new Error('Endpoint is too long.')
  const hosted = input.hosted ?? isHostedRuntime(input.env)
  assertInboundMcpTransport({
    transport: input.transport,
    endpoint,
    hosted,
  })
  const token = input.authToken?.trim()
  if (hosted && !token) {
    throw new Error('Hosted inbound MCP requires an auth token.')
  }
  if (token && token.length > 8192) throw new Error('Auth token is too long.')

  let authCiphertext: string | null = null
  let authNonce: string | null = null
  if (token) {
    const sealed = encryptSecret(token, mcpCredentialKey(input.env))
    authCiphertext = sealed.ciphertext
    authNonce = sealed.nonce
  }
  const { data, error } = await input.supabase
    .from('mcp_servers')
    .insert({
      product_id: input.productId,
      display_name: displayName,
      transport: input.transport,
      endpoint,
      auth_ciphertext: authCiphertext,
      auth_nonce: authNonce,
      status: 'disconnected',
    })
    .select(PUBLIC_SELECT)
    .single()
  if (error) throw new Error(`Register MCP server failed: ${error.message}`)
  return toPublicMcpServer(data)
}

export const disconnectInboundMcpServer = async (
  supabase: SupabaseClient,
  input: { productId: string; serverId: string },
): Promise<void> => {
  const { error } = await supabase
    .from('mcp_servers')
    .delete()
    .eq('id', input.serverId)
    .eq('product_id', input.productId)
  if (error) throw new Error(`Disconnect MCP server failed: ${error.message}`)
}

const pingHttpEndpoint = async (input: {
  endpoint: string
  authToken?: string
  fetchImpl: typeof fetch
}): Promise<{ status: McpServerPublic['status']; lastHealthError: string | null }> => {
  const headers: Record<string, string> = {
    Accept: 'application/json, text/event-stream',
    'Content-Type': 'application/json',
  }
  if (input.authToken) headers.Authorization = `Bearer ${input.authToken}`
  const response = await input.fetchImpl(input.endpoint, {
    method: 'POST',
    headers,
    redirect: 'manual',
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'marketing-os', version: '0.0.0' },
      },
    }),
  })
  if (response.status === 401 || response.status === 403) {
    return { status: 'error', lastHealthError: `Health ping returned ${response.status}` }
  }
  if (
    response.ok ||
    response.status === 405 ||
    response.status === 406 ||
    response.status === 415
  ) {
    return { status: 'connected', lastHealthError: null }
  }
  return { status: 'error', lastHealthError: `Health ping returned ${response.status}` }
}

export const pingInboundMcpServer = async (input: {
  supabase: SupabaseClient
  productId: string
  serverId: string
  fetchImpl?: typeof fetch
  hosted?: boolean
  env?: NodeJS.ProcessEnv
}): Promise<McpServerPublic> => {
  const { data: row, error } = await input.supabase
    .from('mcp_servers')
    .select('*')
    .eq('id', input.serverId)
    .eq('product_id', input.productId)
    .maybeSingle()
  if (error) throw new Error(`Load MCP server failed: ${error.message}`)
  if (!row) throw new Error('MCP server not found')
  const publicRow = toPublicMcpServer(row)
  const hosted = input.hosted ?? isHostedRuntime(input.env)
  assertInboundMcpTransport({
    transport: publicRow.transport,
    endpoint: publicRow.endpoint,
    hosted,
  })

  let status: McpServerPublic['status'] = 'error'
  let lastHealthError: string | null = null
  if (publicRow.transport === 'stdio') {
    status = 'disconnected'
    lastHealthError = STDIO_HEALTH_MESSAGE
  } else {
    try {
      let authToken: string | undefined
      if (row.auth_ciphertext && row.auth_nonce) {
        authToken = decryptSecret(
          { ciphertext: String(row.auth_ciphertext), nonce: String(row.auth_nonce) },
          mcpCredentialKey(input.env),
        )
      }
      const result = await pingHttpEndpoint({
        endpoint: publicRow.endpoint,
        authToken,
        fetchImpl: input.fetchImpl ?? fetch,
      })
      status = result.status
      lastHealthError = result.lastHealthError
    } catch (err) {
      lastHealthError = err instanceof Error ? err.message : 'Health ping failed'
    }
  }

  const { data: updated, error: updateError } = await input.supabase
    .from('mcp_servers')
    .update({
      status,
      last_health_at: new Date().toISOString(),
      last_health_error: lastHealthError,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.serverId)
    .eq('product_id', input.productId)
    .select(PUBLIC_SELECT)
    .single()
  if (updateError) throw new Error(`Save MCP health failed: ${updateError.message}`)
  return toPublicMcpServer(updated)
}

export type McpListedTool = {
  name: string
  description: string | null
  inputSchema: unknown | null
}

export type McpEnabledToolRow = {
  serverId: string
  toolName: string
  enabled: boolean
  stale: boolean
  description: string | null
  inputSchema: unknown | null
  discoveredAt: string | null
}

export const MCP_TOOL_STALE_WARNING =
  'This tool is no longer returned by the MCP server. Refresh tools or remove the row.'

export const STDIO_REFRESH_MESSAGE =
  'Local command servers cannot be refreshed from this page. Run refresh on the self-hosted agent that starts the command.'

export const mcpToolCatalogId = (serverId: string, toolName: string): string =>
  `mcp:${serverId}:${toolName}`

export const buildMcpCatalogRow = (input: {
  serverId: string
  toolName: string
  enabled: boolean
  stale?: boolean
}): ToolCatalogRow => {
  const stale = Boolean(input.stale)
  return {
    id: mcpToolCatalogId(input.serverId, input.toolName),
    name: input.toolName,
    source: 'mcp',
    kind: 'optional',
    enabled: stale ? false : input.enabled,
    toggleable: !stale,
    warning: stale ? MCP_TOOL_STALE_WARNING : null,
    stale: stale || undefined,
  }
}

const MCP_TOOL_CATALOG_ID = /^mcp:([0-9a-f-]{36}):(.+)$/i

export const parseMcpToolCatalogId = (
  catalogId: string,
): { serverId: string; toolName: string } | null => {
  const match = MCP_TOOL_CATALOG_ID.exec(catalogId.trim())
  if (!match) return null
  return { serverId: match[1], toolName: match[2] }
}

export const setMcpToolEnabled = async (input: {
  supabase: SupabaseClient
  productId: string
  catalogId: string
  enabled: boolean
}): Promise<void> => {
  const parsed = parseMcpToolCatalogId(input.catalogId)
  if (!parsed) {
    throw new Error('MCP tool id must look like mcp:{serverId}:{toolName}.')
  }

  const { data: server, error: serverError } = await input.supabase
    .from('mcp_servers')
    .select('id')
    .eq('id', parsed.serverId)
    .eq('product_id', input.productId)
    .maybeSingle()
  if (serverError) throw new Error(`Load MCP server failed: ${serverError.message}`)
  if (!server) throw new Error('MCP server not found for this Product.')

  const { data: tool, error: toolError } = await input.supabase
    .from('mcp_enabled_tools')
    .select('tool_name, stale')
    .eq('server_id', parsed.serverId)
    .eq('tool_name', parsed.toolName)
    .maybeSingle()
  if (toolError) throw new Error(`Load MCP tool failed: ${toolError.message}`)
  if (!tool) {
    throw new Error('MCP tool not found. Refresh tools from the server first.')
  }
  if (Boolean(tool.stale)) {
    throw new Error('Stale MCP tools cannot be enabled. Remove the row or refresh the server.')
  }

  const { error: updateError } = await input.supabase
    .from('mcp_enabled_tools')
    .update({ enabled: input.enabled })
    .eq('server_id', parsed.serverId)
    .eq('tool_name', parsed.toolName)
  if (updateError) throw new Error(`Save MCP tool flag failed: ${updateError.message}`)
}

export const removeMcpCatalogTool = async (input: {
  supabase: SupabaseClient
  productId: string
  catalogId: string
}): Promise<void> => {
  const parsed = parseMcpToolCatalogId(input.catalogId)
  if (!parsed) {
    throw new Error('MCP tool id must look like mcp:{serverId}:{toolName}.')
  }

  const { data: server, error: serverError } = await input.supabase
    .from('mcp_servers')
    .select('id')
    .eq('id', parsed.serverId)
    .eq('product_id', input.productId)
    .maybeSingle()
  if (serverError) throw new Error(`Load MCP server failed: ${serverError.message}`)
  if (!server) throw new Error('MCP server not found for this Product.')

  const { error: deleteError } = await input.supabase
    .from('mcp_enabled_tools')
    .delete()
    .eq('server_id', parsed.serverId)
    .eq('tool_name', parsed.toolName)
  if (deleteError) throw new Error(`Remove MCP tool failed: ${deleteError.message}`)
}

export const loadEnabledMcpToolIdsForProduct = async (
  supabase: SupabaseClient,
  productId: string,
): Promise<string[]> => {
  const rows = await loadMcpCatalogRowsForProduct(supabase, productId)
  return rows.filter((row) => row.enabled && !row.stale).map((row) => row.id)
}

export type McpToolWithServer = {
  catalogId: string
  toolName: string
  description: string | null
  inputSchema: unknown | null
  serverId: string
  endpoint: string
  authCiphertext: string | null
  authNonce: string | null
}

/**
 * Load enabled, non-stale MCP tool rows for a product with their server
 * connection details. Used by runTurn to build the per-turn tool map.
 */
export const loadEnabledMcpToolsForTurn = async (
  supabase: SupabaseClient,
  productId: string,
): Promise<McpToolWithServer[]> => {
  const { data: servers, error: serversError } = await supabase
    .from('mcp_servers')
    .select('id, endpoint, auth_ciphertext, auth_nonce')
    .eq('product_id', productId)
  if (serversError) throw new Error(`Load MCP servers failed: ${serversError.message}`)
  const serverIds = (servers ?? []).map((row) => String(row.id))
  if (serverIds.length === 0) return []

  const serverMap = new Map(
    (servers ?? []).map((row) => [
      String(row.id),
      {
        endpoint: String(row.endpoint),
        authCiphertext: (row.auth_ciphertext as string | null) ?? null,
        authNonce: (row.auth_nonce as string | null) ?? null,
      },
    ]),
  )

  const { data: tools, error: toolsError } = await supabase
    .from('mcp_enabled_tools')
    .select('server_id, tool_name, description, input_schema')
    .in('server_id', serverIds)
    .eq('enabled', true)
    .eq('stale', false)
    .order('tool_name', { ascending: true })
  if (toolsError) throw new Error(`Load MCP tools failed: ${toolsError.message}`)

  return (tools ?? []).flatMap((row): McpToolWithServer[] => {
    const serverId = String(row.server_id)
    const server = serverMap.get(serverId)
    if (!server) return []
    return [
      {
        catalogId: mcpToolCatalogId(serverId, String(row.tool_name)),
        toolName: String(row.tool_name),
        description: (row.description as string | null) ?? null,
        inputSchema: row.input_schema ?? null,
        serverId,
        endpoint: server.endpoint,
        authCiphertext: server.authCiphertext,
        authNonce: server.authNonce,
      },
    ]
  })
}

const readJsonRpcResult = (payload: unknown): unknown => {
  if (!payload || typeof payload !== 'object') throw new Error('MCP response was not JSON.')
  const body = payload as Record<string, unknown>
  if (body.error) {
    const message =
      typeof body.error === 'object' &&
      body.error &&
      'message' in body.error &&
      typeof (body.error as { message?: unknown }).message === 'string'
        ? (body.error as { message: string }).message
        : 'MCP request failed.'
    throw new Error(message)
  }
  if (!('result' in body)) throw new Error('MCP response missing result.')
  return body.result
}

export const parseMcpToolsListResult = (payload: unknown): McpListedTool[] => {
  const result = readJsonRpcResult(payload)
  if (!result || typeof result !== 'object') throw new Error('tools/list result was invalid.')
  const tools = (result as { tools?: unknown }).tools
  if (!Array.isArray(tools)) throw new Error('tools/list result missing tools array.')
  return tools.map((tool, index) => {
    if (!tool || typeof tool !== 'object') {
      throw new Error(`tools/list entry ${index + 1} was invalid.`)
    }
    const row = tool as Record<string, unknown>
    const name = typeof row.name === 'string' ? row.name.trim() : ''
    if (!name) throw new Error(`tools/list entry ${index + 1} is missing a name.`)
    const description =
      typeof row.description === 'string' && row.description.trim() ? row.description.trim() : null
    const inputSchema =
      row.inputSchema !== undefined && row.inputSchema !== null ? row.inputSchema : null
    return { name, description, inputSchema }
  })
}

const mcpJsonRpc = async (input: {
  endpoint: string
  authToken?: string
  method: string
  params?: unknown
  id: number
  fetchImpl: typeof fetch
}): Promise<unknown> => {
  const headers: Record<string, string> = {
    Accept: 'application/json, text/event-stream',
    'Content-Type': 'application/json',
  }
  if (input.authToken) headers.Authorization = `Bearer ${input.authToken}`
  const response = await input.fetchImpl(input.endpoint, {
    method: 'POST',
    headers,
    redirect: 'manual',
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: input.id,
      method: input.method,
      params: input.params ?? {},
    }),
  })
  if (!response.ok) {
    throw new Error(`MCP ${input.method} returned ${response.status}`)
  }
  const payload = await response.json().catch(() => {
    throw new Error(`MCP ${input.method} returned invalid JSON.`)
  })
  return readJsonRpcResult(payload)
}

export const listToolsFromMcpEndpoint = async (input: {
  endpoint: string
  authToken?: string
  fetchImpl?: typeof fetch
}): Promise<McpListedTool[]> => {
  const fetchImpl = input.fetchImpl ?? fetch
  await mcpJsonRpc({
    endpoint: input.endpoint,
    authToken: input.authToken,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'marketing-os', version: '0.0.0' },
    },
    id: 1,
    fetchImpl,
  })
  const result = await mcpJsonRpc({
    endpoint: input.endpoint,
    authToken: input.authToken,
    method: 'tools/list',
    id: 2,
    fetchImpl,
  })
  return parseMcpToolsListResult({ jsonrpc: '2.0', id: 2, result })
}

const toEnabledToolRow = (row: Record<string, unknown>): McpEnabledToolRow => ({
  serverId: String(row.server_id),
  toolName: String(row.tool_name),
  enabled: Boolean(row.enabled),
  stale: Boolean(row.stale),
  description: (row.description as string | null) ?? null,
  inputSchema: row.input_schema ?? null,
  discoveredAt: (row.discovered_at as string | null) ?? null,
})

export const loadMcpCatalogRowsForProduct = async (
  supabase: SupabaseClient,
  productId: string,
): Promise<ToolCatalogRow[]> => {
  const { data: servers, error: serversError } = await supabase
    .from('mcp_servers')
    .select('id')
    .eq('product_id', productId)
  if (serversError) throw new Error(`Load MCP servers failed: ${serversError.message}`)
  const serverIds = (servers ?? []).map((row) => String(row.id))
  if (serverIds.length === 0) return []

  const { data: tools, error: toolsError } = await supabase
    .from('mcp_enabled_tools')
    .select('server_id, tool_name, enabled, stale')
    .in('server_id', serverIds)
    .order('tool_name', { ascending: true })
  if (toolsError) throw new Error(`Load MCP tools failed: ${toolsError.message}`)

  return (tools ?? []).map((row) =>
    buildMcpCatalogRow({
      serverId: String(row.server_id),
      toolName: String(row.tool_name),
      enabled: Boolean(row.enabled),
      stale: Boolean(row.stale),
    }),
  )
}

export const refreshInboundMcpTools = async (input: {
  supabase: SupabaseClient
  productId: string
  serverId: string
  fetchImpl?: typeof fetch
  hosted?: boolean
  env?: NodeJS.ProcessEnv
}): Promise<{ tools: McpEnabledToolRow[] }> => {
  const { data: row, error } = await input.supabase
    .from('mcp_servers')
    .select('*')
    .eq('id', input.serverId)
    .eq('product_id', input.productId)
    .maybeSingle()
  if (error) throw new Error(`Load MCP server failed: ${error.message}`)
  if (!row) throw new Error('MCP server not found')

  const publicRow = toPublicMcpServer(row)
  const hosted = input.hosted ?? isHostedRuntime(input.env)
  assertInboundMcpTransport({
    transport: publicRow.transport,
    endpoint: publicRow.endpoint,
    hosted,
  })

  if (publicRow.transport === 'stdio') {
    throw new Error(STDIO_REFRESH_MESSAGE)
  }

  let authToken: string | undefined
  if (row.auth_ciphertext && row.auth_nonce) {
    authToken = decryptSecret(
      { ciphertext: String(row.auth_ciphertext), nonce: String(row.auth_nonce) },
      mcpCredentialKey(input.env),
    )
  }

  const listed = await listToolsFromMcpEndpoint({
    endpoint: publicRow.endpoint,
    authToken,
    fetchImpl: input.fetchImpl ?? fetch,
  })
  const discoveredAt = new Date().toISOString()
  const listedNames = new Set(listed.map((tool) => tool.name))

  const { data: existingRows, error: existingError } = await input.supabase
    .from('mcp_enabled_tools')
    .select('tool_name, enabled, stale')
    .eq('server_id', input.serverId)
  if (existingError) {
    throw new Error(`Load MCP tool flags failed: ${existingError.message}`)
  }
  const enabledByName = new Map(
    (existingRows ?? []).map((item) => [String(item.tool_name), Boolean(item.enabled)]),
  )

  const staleNames = (existingRows ?? [])
    .map((item) => String(item.tool_name))
    .filter((name) => !listedNames.has(name))
  if (staleNames.length > 0) {
    const { error: staleError } = await input.supabase
      .from('mcp_enabled_tools')
      .update({ stale: true, enabled: false })
      .eq('server_id', input.serverId)
      .in('tool_name', staleNames)
    if (staleError) throw new Error(`Mark stale MCP tools failed: ${staleError.message}`)
  }

  if (listed.length > 0) {
    const upsertRows = listed.map((tool) => ({
      server_id: input.serverId,
      tool_name: tool.name,
      enabled: enabledByName.get(tool.name) ?? false,
      stale: false,
      description: tool.description,
      input_schema: tool.inputSchema,
      discovered_at: discoveredAt,
    }))
    const { error: upsertError } = await input.supabase
      .from('mcp_enabled_tools')
      .upsert(upsertRows, { onConflict: 'server_id,tool_name' })
    if (upsertError) throw new Error(`Save MCP tools failed: ${upsertError.message}`)
  } else if ((existingRows ?? []).length > 0) {
    const { error: staleAllError } = await input.supabase
      .from('mcp_enabled_tools')
      .update({ stale: true, enabled: false })
      .eq('server_id', input.serverId)
    if (staleAllError) throw new Error(`Mark stale MCP tools failed: ${staleAllError.message}`)
  }

  const { data: saved, error: savedError } = await input.supabase
    .from('mcp_enabled_tools')
    .select('server_id, tool_name, enabled, stale, description, input_schema, discovered_at')
    .eq('server_id', input.serverId)
    .order('tool_name', { ascending: true })
  if (savedError) throw new Error(`Load refreshed MCP tools failed: ${savedError.message}`)

  return { tools: (saved ?? []).map((item) => toEnabledToolRow(item)) }
}
