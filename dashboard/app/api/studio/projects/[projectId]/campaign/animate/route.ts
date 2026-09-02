import { loadProject } from '@synawood/creative/project'
import { runAnimateCampaignCreative } from '@synawood/creative/campaign/animate-creative'
import type { StudioToolContext } from '@synawood/creative/tools'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    creativeId: z.string().min(1),
    withoutText: z.boolean().optional(),
    confirmSpend: z.boolean().optional(),
    durationSeconds: z.number().int().positive().max(8).optional(),
    estimateOnly: z.boolean().optional(),
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

    const toolContext: StudioToolContext = {
      productId: project.productId,
      projectId,
      project,
      expectedRevision: body.expectedRevision,
      supabase: access.supabase,
      blobEnv: access.blobEnv,
      modelProfileId: row.model_profile_id,
      persist: true,
      toolTrace: [],
      confirmSpend: body.confirmSpend,
    }

    const outcome = await runAnimateCampaignCreative(toolContext, {
      creativeId: body.creativeId,
      withoutText: body.withoutText,
      confirmSpend: body.confirmSpend,
      durationSeconds: body.durationSeconds,
      estimateOnly: body.estimateOnly,
    })

    if (!outcome.ok) {
      return jsonError(outcome.error, 400)
    }

    return Response.json({
      summary: outcome.summary,
      ...(outcome.data ?? {}),
      project: toolContext.project,
      revision: toolContext.project.revision,
    })
  } catch (error) {
    return handleRouteError(error, 'Animate failed', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return null
    })
  }
}
