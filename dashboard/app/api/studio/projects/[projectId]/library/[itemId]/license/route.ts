import { clearLibraryItemCommercialUse } from '@synawood/creative/library/license'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { mapStudioRouteError } from '@/lib/studio-tool-route'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z
  .object({
    commercialUseAllowed: z.literal(true),
  })
  .strict()

/**
 * Founder-only commercial-use checkbox. There is no Studio Agent tool for this
 * on purpose — the model cannot tick the box (ADR-0059 / #718).
 */
export const POST = async (
  request: Request,
  context: { params: Promise<{ projectId: string; itemId: string }> },
) => {
  try {
    const { projectId, itemId } = await context.params
    bodySchema.parse(await request.json())
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const item = await clearLibraryItemCommercialUse({
      supabase: access.supabase,
      productId: access.productId,
      itemId,
    })
    return Response.json({ item, projectId })
  } catch (error) {
    return handleRouteError(error, 'Could not clear library license.', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return mapStudioRouteError(err)
    })
  }
}
