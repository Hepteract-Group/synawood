import {
  activeThreadMessages,
  createChatThread,
  renameChatThread,
  selectChatThread,
  threadSummaries,
} from '@synawood/creative/agent'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ThreadBody = {
  projectId?: string
  productId?: string
  action?: 'new' | 'switch' | 'rename'
  threadId?: string
  title?: string
}

export const POST = async (request: Request) => {
  try {
    const body = (await request.json().catch(() => ({}))) as ThreadBody
    if (!body.projectId) return jsonError('projectId is required')
    const access = await requireStudioAccess({
      productId: body.productId,
      projectId: body.projectId,
      minRole: 'editor',
    })
    const { supabase } = access

    if (body.action === 'new') {
      const bag = await createChatThread(supabase, body.projectId)
      return Response.json({
        messages: activeThreadMessages(bag),
        threads: threadSummaries(bag),
      })
    }

    if (body.action === 'switch') {
      if (!body.threadId) return jsonError('threadId is required')
      const bag = await selectChatThread(supabase, body.projectId, body.threadId)
      return Response.json({
        messages: activeThreadMessages(bag),
        threads: threadSummaries(bag),
      })
    }

    if (body.action === 'rename') {
      if (!body.threadId) return jsonError('threadId is required')
      if (!body.title?.trim()) return jsonError('title is required')
      const bag = await renameChatThread(supabase, body.projectId, body.threadId, body.title)
      return Response.json({
        messages: activeThreadMessages(bag),
        threads: threadSummaries(bag),
      })
    }

    return jsonError('action must be new, switch, or rename')
  } catch (error) {
    return handleRouteError(error, 'Chat thread failed')
  }
}
