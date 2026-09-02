import { loadProject } from '@synawood/creative/project'
import { adPlatformSchema, planVariantsForParent } from '@synawood/creative/variant'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z
  .object({
    platforms: z.array(adPlatformSchema).min(1),
    hookIndexes: z.array(z.number().int().min(0)).min(1),
    ctaIndexes: z.array(z.number().int().min(0)).min(1),
    softCap: z.number().int().positive().optional(),
    confirmSpend: z.boolean().optional(),
    locales: z.array(z.string().trim().min(2).max(8)).max(12).optional(),
  })
  .strict()

export const POST = async (
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const body = bodySchema.parse(await request.json())
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const { project, row } = await loadProject(access.supabase, projectId)
    if (row.parent_project_id) {
      return jsonError('Plan variants on the parent project, not a child variant', 400)
    }

    const plan = planVariantsForParent({
      parent: project,
      platforms: body.platforms,
      hookIndexes: body.hookIndexes,
      ctaIndexes: body.ctaIndexes,
      locales: body.locales,
      softCap: body.softCap,
      confirmSpend: body.confirmSpend,
    })

    return Response.json({
      plan: {
        items: plan.items,
        requestedCount: plan.requestedCount,
        truncated: plan.truncated,
        estimatedGbp: plan.estimatedGbp,
        createEstimatedGbp: plan.createEstimatedGbp,
        exportEstimatedGbp: plan.exportEstimatedGbp,
        warnings: plan.warnings,
      },
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to plan variants', (err) => {
      const message = err instanceof Error ? err.message : 'Failed to plan variants'
      if (message.includes('ExtractedBrief') || message.includes('hookIndexes')) {
        return jsonError(message, 400)
      }
      return null
    })
  }
}
