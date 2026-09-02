import { addComment, loadSlotDetail } from '@/lib/content-week-board'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { z } from 'zod'

const bodySchema = z.object({
  body: z.string().min(1).max(4000),
  author: z.string().max(80).optional(),
})

export const GET = async (_request: Request, context: { params: Promise<{ slotId: string }> }) => {
  try {
    const { slotId } = await context.params
    const access = await requireStudioAccess({ slotId, minRole: 'viewer' })
    const { supabase } = access
    const detail = await loadSlotDetail(supabase, slotId)
    if (!detail) return jsonError('Task not found', 404)
    return Response.json({ comments: detail.comments })
  } catch (error) {
    return handleRouteError(error, 'Failed to load comments')
  }
}

export const POST = async (request: Request, context: { params: Promise<{ slotId: string }> }) => {
  try {
    const { slotId } = await context.params
    const body = bodySchema.parse(await request.json())
    const access = await requireStudioAccess({ slotId, minRole: 'editor' })
    const { supabase } = access
    const comment = await addComment(supabase, {
      slotId,
      body: body.body,
      author: body.author,
    })
    return Response.json({ comment }, { status: 201 })
  } catch (error) {
    return handleRouteError(error, 'Failed to add comment', (error) => {
      if (error instanceof z.ZodError) {
        return jsonError(error.issues.map((issue) => issue.message).join('; '), 400)
      }
      return null
    })
  }
}
