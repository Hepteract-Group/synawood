import { deleteSlot, loadSlotDetail, updateSlot } from '@/lib/content-week-board'
import { pmColumnSchema, slotPrioritySchema } from '@/lib/content-slot-schemas'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { z } from 'zod'

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  channel: z.string().min(1).optional(),
  boardColumn: pmColumnSchema.optional(),
  priority: slotPrioritySchema.nullable().optional(),
  dueDate: z.string().nullable().optional(),
  plannedDate: z.string().nullable().optional(),
  labels: z.array(z.string()).optional(),
  assignee: z.string().nullable().optional(),
  weekId: z.string().optional(),
})

export const GET = async (_request: Request, context: { params: Promise<{ slotId: string }> }) => {
  try {
    const { slotId } = await context.params
    const access = await requireStudioAccess({ slotId, minRole: 'viewer' })
    const { supabase } = access
    const detail = await loadSlotDetail(supabase, slotId)
    if (!detail) return jsonError('Task not found', 404)
    return Response.json(detail)
  } catch (error) {
    return handleRouteError(error, 'Failed to load task')
  }
}

export const PATCH = async (request: Request, context: { params: Promise<{ slotId: string }> }) => {
  try {
    const { slotId } = await context.params
    const body = patchSchema.parse(await request.json())
    const access = await requireStudioAccess({ slotId, minRole: 'editor' })
    const { supabase } = access
    const slot = await updateSlot(supabase, slotId, body)
    return Response.json({ slot })
  } catch (error) {
    return handleRouteError(error, 'Failed to update task', (error) => {
      if (error instanceof z.ZodError) {
        return jsonError(error.issues.map((issue) => issue.message).join('; '), 400)
      }
      return null
    })
  }
}

export const DELETE = async (
  _request: Request,
  context: { params: Promise<{ slotId: string }> },
) => {
  try {
    const { slotId } = await context.params
    const access = await requireStudioAccess({ slotId, minRole: 'editor' })
    const { supabase } = access
    await deleteSlot(supabase, slotId)
    return Response.json({ ok: true })
  } catch (error) {
    return handleRouteError(error, 'Failed to delete task')
  }
}
