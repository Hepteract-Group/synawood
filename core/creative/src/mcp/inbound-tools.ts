/**
 * Wrap enabled inbound MCP tools into a Vercel AI SDK ToolSet for runTurn.
 * ADR-0081 §4: timeouts, size caps, toolTrace with catalog ID.
 * ADR-0018: MCP tools never route through first-party generator keys.
 */

import { jsonSchema, tool, type ToolSet } from 'ai'
import { decryptSecret } from '../performance/encrypt'
import { recordToolTrace } from '../tools/store'
import type { StudioToolContext } from '../tools/types'
import { toolFail, toolOk } from '../tools/types'
import { mcpCredentialKey, type McpToolWithServer } from './inbound'

/** Per-call timeout for an MCP tools/call request (ms). */
export const MCP_TOOL_TIMEOUT_MS = 15_000

/** Maximum response body size from a single MCP tools/call (bytes). */
export const MCP_MAX_RESULT_BYTES = 32_768

/**
 * Derive a Vercel AI SDK-safe tool name from a catalog ID.
 * OpenAI requires ^[a-zA-Z0-9_-]+$; colons in catalog IDs are replaced.
 * The result is truncated to 64 chars to stay within API limits.
 */
export const safeMcpToolName = (catalogId: string): string =>
  catalogId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)

const callMcpTool = async (input: {
  endpoint: string
  authToken: string | undefined
  toolName: string
  args: unknown
  fetchImpl: typeof fetch
  timeoutMs: number
  maxResultBytes: number
}): Promise<string> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), input.timeoutMs)
  let response: Response
  try {
    response = await input.fetchImpl(input.endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        ...(input.authToken ? { Authorization: `Bearer ${input.authToken}` } : {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: input.toolName, arguments: input.args ?? {} },
      }),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    throw new Error(`MCP tools/call returned ${response.status}`)
  }

  const raw = await response.text()
  if (raw.length > input.maxResultBytes) {
    throw new Error(
      `MCP result exceeded ${input.maxResultBytes} bytes (got ${raw.length}). Truncated for safety.`,
    )
  }

  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    throw new Error('MCP tools/call returned invalid JSON.')
  }

  if (!payload || typeof payload !== 'object') throw new Error('MCP response was not JSON.')
  const body = payload as Record<string, unknown>
  if (body.error) {
    const msg =
      typeof body.error === 'object' &&
      body.error &&
      'message' in body.error &&
      typeof (body.error as { message?: unknown }).message === 'string'
        ? (body.error as { message: string }).message
        : 'MCP tools/call failed.'
    throw new Error(msg)
  }
  if (!('result' in body)) throw new Error('MCP response missing result.')

  const result = body.result
  if (!result || typeof result !== 'object') return String(result ?? '')
  const r = result as Record<string, unknown>
  if (Array.isArray(r.content)) {
    return r.content
      .map((item) => {
        if (item && typeof item === 'object') {
          const it = item as Record<string, unknown>
          if (it.type === 'text' && typeof it.text === 'string') return it.text
        }
        return JSON.stringify(item)
      })
      .join('\n')
  }
  return JSON.stringify(result)
}

/**
 * Build a Vercel AI SDK ToolSet from enabled inbound MCP tool rows.
 * Each tool calls the remote server's tools/call endpoint, respects
 * timeout + size caps, and appends a trace entry to ctx.toolTrace.
 *
 * ADR-0018: MCP tool executors do NOT call first-party generators —
 * any spend wrapping stays on the first-party side of the tools map.
 */
export const buildMcpToolSet = (input: {
  tools: McpToolWithServer[]
  ctx: StudioToolContext
  fetchImpl?: typeof fetch
  env?: NodeJS.ProcessEnv
  timeoutMs?: number
  maxResultBytes?: number
}): ToolSet => {
  const {
    tools,
    ctx,
    fetchImpl = fetch,
    env = process.env,
    timeoutMs = MCP_TOOL_TIMEOUT_MS,
    maxResultBytes = MCP_MAX_RESULT_BYTES,
  } = input

  const toolSet: ToolSet = {}
  for (const row of tools) {
    const sdkName = safeMcpToolName(row.catalogId)
    const { catalogId, toolName, description, inputSchema, endpoint, authCiphertext, authNonce } =
      row

    toolSet[sdkName] = tool({
      description: description ?? `MCP tool ${toolName}`,
      // Use jsonSchema() for the MCP-supplied JSON schema; fall back to an
      // open object when the server did not provide one.
      inputSchema:
        inputSchema && typeof inputSchema === 'object'
          ? jsonSchema(inputSchema as Parameters<typeof jsonSchema>[0])
          : jsonSchema({ type: 'object' } as Parameters<typeof jsonSchema>[0]),
      execute: async (args: unknown) => {
        await ctx.onToolStart?.(catalogId)
        let authToken: string | undefined
        if (authCiphertext && authNonce) {
          try {
            authToken = decryptSecret(
              { ciphertext: authCiphertext, nonce: authNonce },
              mcpCredentialKey(env),
            )
          } catch {
            const outcome = toolFail('MCP auth decrypt failed — check MCP_SERVER_KEY.')
            recordToolTrace(ctx, catalogId, args as Record<string, unknown>, outcome)
            return outcome
          }
        }

        try {
          const text = await callMcpTool({
            endpoint,
            authToken,
            toolName,
            args,
            fetchImpl,
            timeoutMs,
            maxResultBytes,
          })
          const outcome = toolOk(text)
          recordToolTrace(ctx, catalogId, args as Record<string, unknown>, outcome)
          return outcome
        } catch (err) {
          const outcome = toolFail(err instanceof Error ? err.message : 'MCP tool call failed.')
          recordToolTrace(ctx, catalogId, args as Record<string, unknown>, outcome)
          return outcome
        }
      },
    })
  }
  return toolSet
}
