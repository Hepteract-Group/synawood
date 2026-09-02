import { loadProject, setCampaignBrief } from '@synawood/creative/project'
import { campaignAspectSchema } from '@synawood/creative/project/campaign-pack'
import { applyProjectMutation, type StudioToolContext } from '@synawood/creative/tools'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    prompt: z.string().max(2000).optional(),
    productId: z.string().min(1).nullable().optional(),
    aspect: campaignAspectSchema.optional(),
    notes: z.string().max(2000).nullable().optional(),
    imageAssetIds: z.array(z.string().uuid()).max(8).nullable().optional(),
    suggestionSource: z.enum(['manual', 'dna', 'catalog']).nullable().optional(),
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
    }

    const { expectedRevision: _rev, ...briefInput } = body
    const mutated = await applyProjectMutation(toolContext, (current) =>
      setCampaignBrief(current, briefInput),
    )

    return Response.json({
      brief: mutated.project.campaignPack?.brief,
      project: mutated.project,
      revision: mutated.project.revision,
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to save campaign brief', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      const message = err instanceof Error ? err.message : 'Failed to save campaign brief'
      if (message.includes('Campaign Pack') || message.includes('campaignPack')) {
        return jsonError(message, 400)
      }
      return null
    })
  }
}
