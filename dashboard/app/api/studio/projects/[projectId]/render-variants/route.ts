import { renderVariantsForParent, variantSpecSchema } from '@synawood/creative/variant'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { spawnLocalRenderWorker } from '@/lib/spawn-local-render'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z
  .object({
    items: z.array(variantSpecSchema).min(1),
    confirmSpend: z.boolean().optional(),
    enqueueRenders: z.boolean().optional(),
    renderTargets: z.enum(['stills', 'mp4', 'both']).optional(),
  })
  .strict()

const shouldSpawnInline = (): boolean =>
  process.env.NODE_ENV === 'development' && process.env.STUDIO_RENDER_INLINE !== 'false'

export const POST = async (
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const body = bodySchema.parse(await request.json())
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })

    const result = await renderVariantsForParent({
      supabase: access.supabase,
      parentProjectId: projectId,
      items: body.items,
      confirmSpend: body.confirmSpend,
      enqueueRenders: body.enqueueRenders,
      renderTargets: body.renderTargets,
    })

    const spawned: string[] = []
    if (body.enqueueRenders !== false && shouldSpawnInline()) {
      for (const child of result.children) {
        if (!child.renderJobId) continue
        try {
          spawnLocalRenderWorker(child.renderJobId)
          spawned.push(child.renderJobId)
        } catch (spawnError) {
          console.error('[render-variants inline]', spawnError)
        }
      }
    }

    return Response.json({
      estimatedGbp: result.estimatedGbp,
      createEstimatedGbp: result.plan.createEstimatedGbp,
      exportEstimatedGbp: result.plan.exportEstimatedGbp,
      warnings: result.plan.warnings,
      children: result.children,
      spawnedInlineJobIds: spawned,
      workerHint:
        body.enqueueRenders === false
          ? null
          : spawned.length > 0
            ? 'Inline render workers started for variant jobs.'
            : 'Variant renders queued. Start workers with npm run render:local if they stay queued.',
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to render variants', (err) => {
      const message = err instanceof Error ? err.message : 'Failed to render variants'
      if (message.includes('confirmSpend') || message.includes('soft cap')) {
        return jsonError(message, 402)
      }
      if (message.includes('child project') || message.includes('ExtractedBrief')) {
        return jsonError(message, 400)
      }
      return null
    })
  }
}
