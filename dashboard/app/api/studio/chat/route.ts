import {
  appendToolTraceEntries,
  failedTurnChatMessages,
  generateThreadTitle,
  loadChatState,
  maybeNameActiveThread,
  parseTurnMode,
  runTurn,
  saveChatMessages,
  threadSummaries,
  type ChatMessage,
} from '@synawood/creative/agent'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { spawnLocalExtractWorker } from '@/lib/spawn-local-extract'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
/** Generate + Remotion cut-review stills in a child process can exceed 60s. */
export const maxDuration = 300

type ChatBody = {
  projectId?: string
  productId?: string
  message?: string
  confirmSpend?: boolean
  turnMode?: string
  grounding?: {
    tSeconds?: number
    clipId?: string
    overlayId?: string
  }
}

const encodeSse = (event: string, data: unknown): string =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`

/** Proxies often buffer ~2KB; pad so live events leave before a long tool. */
const SSE_PAD = `: ${' '.repeat(2048)}\n\n`

export const POST = async (request: Request) => {
  try {
    if (process.env.STUDIO_CHAT_API === 'false') {
      return jsonError('Chat API is disabled by STUDIO_CHAT_API=false', 403)
    }

    const body = (await request.json().catch(() => ({}))) as ChatBody
    if (!body.projectId) {
      return jsonError('projectId is required')
    }
    if (!body.message?.trim()) {
      return jsonError('message is required')
    }

    const access = await requireStudioAccess({
      productId: body.productId,
      projectId: body.projectId,
      minRole: 'editor',
    })
    const { supabase, blobEnv } = access
    const productId = body.productId ?? access.productId
    const userText = body.message.trim()
    const prior = await loadChatState(supabase, body.projectId)
    const pendingUser: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userText,
      createdAt: new Date().toISOString(),
    }
    let persistWarning: string | null = null
    try {
      await saveChatMessages(supabase, body.projectId, [...prior.messages, pendingUser])
    } catch {
      persistWarning = 'Could not save this prompt yet. Copy it before refresh if the turn fails.'
    }

    const encoder = new TextEncoder()
    const { readable, writable } = new TransformStream<Uint8Array>()
    const writer = writable.getWriter()
    let closed = false

    const send = async (event: string, data: unknown) => {
      if (closed) return
      try {
        await writer.write(encoder.encode(encodeSse(event, data) + SSE_PAD))
      } catch {
        closed = true
      }
    }

    void (async () => {
      try {
        await send('status', { phase: 'running' })
        const result = await runTurn(
          {
            productId,
            userId: access.userId,
            projectId: body.projectId!,
            messages: prior.messages,
            userMessage: userText,
            confirmSpend: body.confirmSpend === true,
            abortSignal: request.signal,
            grounding: body.grounding,
            turnMode: parseTurnMode(body.turnMode),
          },
          {
            supabase,
            blobEnv,
            persist: true,
            onLive: async (event) => {
              if (event.type === 'step') await send('step', { stepNumber: event.stepNumber })
              if (event.type === 'model') await send('model', { phase: 'calling' })
              if (event.type === 'tool_choice')
                await send('tool_choice', { toolName: event.toolName })
              if (event.type === 'tool_start')
                await send('tool_start', { toolName: event.toolName })
            },
            onToolStart: async (toolName) => {
              await send('tool_start', { toolName })
            },
            onTool: async (entry) => {
              await send('tool', entry)
              if (
                process.env.NODE_ENV === 'development' &&
                process.env.STUDIO_EXTRACT_INLINE !== 'false' &&
                entry.toolName === 'extract_product_pages' &&
                entry.outcome.ok
              ) {
                const jobId = entry.outcome.data?.jobId
                if (typeof jobId === 'string' && jobId) {
                  try {
                    spawnLocalExtractWorker(jobId)
                  } catch (spawnError: unknown) {
                    console.error('[studio extract inline from chat]', spawnError)
                  }
                }
              }
            },
          },
        )

        const messages: ChatMessage[] = result.messages
        await saveChatMessages(supabase, body.projectId!, messages)
        await appendToolTraceEntries(supabase, body.projectId!, result.toolTrace)
        const namedBag = await maybeNameActiveThread(
          supabase,
          body.projectId!,
          ({ userText, assistantText }) =>
            generateThreadTitle({
              userText,
              assistantText,
              model: result.reasonerSpend?.modelId ?? null,
            }),
        )
        const latest = await loadChatState(supabase, body.projectId!)

        const chunkSize = 48
        for (let i = 0; i < result.assistantText.length; i += chunkSize) {
          await send('text', { delta: result.assistantText.slice(i, i + chunkSize) })
        }
        await send('project', {
          project: result.project,
          skillIds: result.skillIds,
        })
        await send('done', {
          messages,
          toolTrace: latest.toolTrace,
          assistantText: result.assistantText,
          reasonerSpend: result.reasonerSpend,
          threads: threadSummaries(namedBag),
        })
      } catch (error) {
        let message = error instanceof Error ? error.message : 'Chat turn failed'
        if (persistWarning) message = `${message} ${persistWarning}`
        try {
          await saveChatMessages(
            supabase,
            body.projectId!,
            failedTurnChatMessages({
              prior: prior.messages,
              userMessage: pendingUser,
              error: message,
            }),
          )
        } catch {
          message = `${message} Chat also could not be saved — copy your prompt before refresh.`
        }
        await send('error', { error: message })
      } finally {
        closed = true
        try {
          await writer.close()
        } catch {
          /* already closed */
        }
      }
    })()

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Content-Encoding': 'identity',
      },
    })
  } catch (error) {
    return handleRouteError(error, 'Chat failed')
  }
}

export const GET = async (request: Request) => {
  try {
    const projectId = new URL(request.url).searchParams.get('projectId')
    if (!projectId) {
      return jsonError('projectId is required')
    }
    const access = await requireStudioAccess({ projectId, minRole: 'viewer' })
    const { supabase } = access
    const state = await loadChatState(supabase, projectId)
    return Response.json(state)
  } catch (error) {
    return handleRouteError(error, 'Failed to load chat', (error) => {
      const message = error instanceof Error ? error.message : 'Failed to load chat'
      if (message.includes('not found')) return jsonError(message, 404)
      return null
    })
  }
}
