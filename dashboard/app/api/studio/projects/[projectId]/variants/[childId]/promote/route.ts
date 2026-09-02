import { promoteFieldSchema, promoteVariantFieldsToParent } from '@synawood/creative/variant'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z
  .object({
    fields: z.array(promoteFieldSchema).min(1),
    expectedRevision: z.number().int().positive(),
  })
  .strict()

/**
 * Promote selected fields from a variant child onto the parent main cut (#158).
 * Never overwrites the whole parent — founder confirms the field list in UI.
 */
export const POST = async (
  request: Request,
  context: { params: Promise<{ projectId: string; childId: string }> },
) => {
  try {
    const { projectId: parentProjectId, childId } = await context.params
    const body = bodySchema.parse(await request.json())
    await requireStudioAccess({ projectId: parentProjectId, minRole: 'editor' })
    const access = await requireStudioAccess({ projectId: childId, minRole: 'editor' })

    const result = await promoteVariantFieldsToParent({
      supabase: access.supabase,
      parentProjectId,
      childProjectId: childId,
      fields: body.fields,
      expectedRevision: body.expectedRevision,
    })

    return Response.json({
      parent: result.parent,
      applied: result.applied,
      skipped: result.skipped,
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to promote fields to parent', (err) => {
      const message = err instanceof Error ? err.message : ''
      if (message.includes('revision conflict')) return jsonError(message, 409)
      if (
        message.includes('does not belong') ||
        message.includes('at least one') ||
        message.includes('Nothing to promote') ||
        message.includes('only promote')
      ) {
        return jsonError(message, 400)
      }
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return null
    })
  }
}
