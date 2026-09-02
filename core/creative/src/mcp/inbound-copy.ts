/** Client-safe inbound MCP copy (ADR-0081 / #960). No Node builtins. */

export type McpTransport = 'https' | 'stdio' | 'loopback'

/**
 * Extract the human-readable tool name from an MCP catalog ID.
 * Catalog IDs take the form `mcp:<serverId>:<toolName>`.
 * Returns `null` for any string that doesn't match — caller treats it as a
 * first-party tool name and falls back to its own formatting.
 */
export const mcpDisplayLabel = (catalogId: string): string | null => {
  const match = /^mcp:[0-9a-f-]{36}:(.+)$/i.exec(catalogId)
  return match?.[1] ?? null
}

export const HOSTED_LOCALHOST_MCP_COPY =
  'Hosted Studio cannot reach localhost. Use a public https:// MCP URL or self-host.'

export const HOSTED_REMOTE_ONLY_MCP_COPY =
  'Hosted Studio only allows HTTPS remote MCP servers. Use a public https:// URL or self-host.'

const isLoopbackHost = (host: string): boolean =>
  host === '127.0.0.1' || host === 'localhost' || host === '[::1]'

export const hostedMcpRejectCopy = (input: {
  transport: McpTransport
  endpoint: string
  hosted: boolean
}): string | null => {
  if (!input.hosted) return null
  if (input.transport !== 'https') return HOSTED_REMOTE_ONLY_MCP_COPY
  const endpoint = input.endpoint.trim()
  const host = endpoint.match(/^https?:\/\/([^/:]+)/i)?.[1]?.toLowerCase() ?? ''
  if (isLoopbackHost(host) || isLoopbackHost(endpoint.toLowerCase())) {
    return HOSTED_LOCALHOST_MCP_COPY
  }
  return null
}
