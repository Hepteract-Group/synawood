import { applyStudioMutation, loadProject, saveProject } from '@synawood/creative/project'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import {
  jsonFromToolOutcome,
  mapStudioRouteError,
  runStudioProjectTool,
} from '@/lib/studio-tool-route'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    action: z.enum(['pick', 'add', 'generate']),
    assetId: z.string().uuid().nullable().optional(),
    confirmSpend: z.boolean().optional(),
  })
  .strict()

const stillUrl = (projectId: string, assetId: string) =>
  `/api/studio/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}/content`

const syncFinalThumbnail = async (
  supabase: Awaited<ReturnType<typeof requireStudioAccess>>['supabase'],
  projectId: string,
  thumbnailAssetId: string | null,
) => {
  const { error } = await supabase
    .from('final_assets')
    .update({ thumbnail_asset_id: thumbnailAssetId })
    .eq('project_id', projectId)
  if (error) {
    throw new Error(`Could not save the thumbnail on the Final: ${error.message}`)
  }
}

/** GET current thumbnail options. POST pick / add / generate. */
export const GET = async (
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const { project } = await loadProject(access.supabase, projectId)
    const stills = project.assets.filter((asset) => asset.kind === 'image')
    const candidateIds = project.thumbnailCandidateIds ?? []
    return Response.json({
      thumbnailAssetId: project.thumbnailAssetId ?? null,
      candidates: candidateIds.map((id) => ({
        assetId: id,
        url: stillUrl(projectId, id),
      })),
      stills: stills.map((asset) => ({
        assetId: asset.id,
        url: stillUrl(projectId, asset.id),
      })),
      revision: project.revision,
    })
  } catch (error) {
    return handleRouteError(error, 'Could not load thumbnails.')
  }
}

export const POST = async (
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const body = bodySchema.parse(await request.json())
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    if (body.action === 'generate') {
      const generated = await runStudioProjectTool(
        access,
        projectId,
        body.expectedRevision,
        'generate_image',
        {
          prompt:
            'Channel thumbnail still for this ad. Bold hook, product logo, no tiny paragraphs.',
          aspectRatio: '16:9',
        },
      )
      if (!generated.outcome.ok) {
        return jsonFromToolOutcome(generated.outcome, {
          project: generated.project,
          traceWarning: generated.traceWarning,
        })
      }
      const assetId = (generated.outcome.data as { assetId?: string } | undefined)?.assetId
      if (!assetId) {
        return jsonError('Generate finished without a still.', 500)
      }
      const next = applyStudioMutation(generated.project, {
        type: 'add_thumbnail_candidate',
        assetId,
      })
      const saved = await saveProject(access.supabase, next, next.revision - 1)
      return Response.json({
        thumbnailAssetId: saved.project.thumbnailAssetId ?? null,
        candidates: (saved.project.thumbnailCandidateIds ?? []).map((id) => ({
          assetId: id,
          url: stillUrl(projectId, id),
        })),
        revision: saved.project.revision,
        generatedAssetId: assetId,
      })
    }
    const { project } = await loadProject(access.supabase, projectId)
    const mutation =
      body.action === 'pick'
        ? { type: 'pick_thumbnail' as const, assetId: body.assetId ?? null }
        : { type: 'add_thumbnail_candidate' as const, assetId: body.assetId! }
    if (body.action === 'add' && !body.assetId) {
      return jsonError('Pick a still to add.', 400)
    }
    const next = applyStudioMutation(project, mutation)
    const saved = await saveProject(access.supabase, next, body.expectedRevision)
    if (body.action === 'pick') {
      await syncFinalThumbnail(access.supabase, projectId, saved.project.thumbnailAssetId ?? null)
    }
    return Response.json({
      thumbnailAssetId: saved.project.thumbnailAssetId ?? null,
      candidates: (saved.project.thumbnailCandidateIds ?? []).map((id) => ({
        assetId: id,
        url: stillUrl(projectId, id),
      })),
      revision: saved.project.revision,
    })
  } catch (error) {
    return handleRouteError(error, 'Could not update thumbnail', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return mapStudioRouteError(err)
    })
  }
}
