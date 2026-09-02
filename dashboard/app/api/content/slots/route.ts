import { createSlot } from '@/lib/content-week-board'
import { pmColumnSchema, slotPrioritySchema } from '@/lib/content-slot-schemas'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { z } from 'zod'

const createSchema = z.object({
  productId: z.string().trim().min(1),
  title: z.string().min(1).max(200),
  channel: z.string().min(1).optional(),
  weekId: z.string().optional(),
  plannedDate: z.string().optional(),
  boardColumn: pmColumnSchema.optional(),
  priority: slotPrioritySchema.nullable().optional(),
  dueDate: z.string().nullable().optional(),
  labels: z.array(z.string()).optional(),
  assignee: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
})

export const POST = async (request: Request) => {
  try {
    const body = createSchema.parse(await request.json())
    const access = await requireStudioAccess({ productId: body.productId, minRole: 'editor' })
    const { supabase } = access
    const slot = await createSlot(supabase, body)
    return Response.json({ slot }, { status: 201 })
  } catch (error) {
    return handleRouteError(error, 'Failed to create task', (error) => {
      if (error instanceof z.ZodError) {
        return jsonError(error.issues.map((issue) => issue.message).join('; '), 400)
      }
      return null
    })
  }
}
