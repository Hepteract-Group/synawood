import { loadProject, RevisionConflictError } from '@synawood/creative/project'
import { DEFAULT_MODEL_PROFILE_ID } from '@synawood/creative/model-profiles'
import {
  estimateMusicGbp,
  generateMusicForProject,
  listMusicGenerationsForProject,
} from '@synawood/creative/music'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
/** Live ElevenLabs beds can take > default serverless window. */
export const maxDuration = 120

const generateBodySchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    prompt: z.string().trim().min(1).max(800),
    durationSeconds: z.number().positive().max(120).optional(),
    forceInstrumental: z.boolean().optional(),
    confirmSpend: z.boolean().optional(),
    placeOnTimeline: z.boolean().optional(),
    /** When true, return estimate only — no generation. */
    estimateOnly: z.boolean().optional(),
  })
  .strict()

export const GET = async (
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const access = await requireStudioAccess({ projectId, minRole: 'viewer' })
    const rows = await listMusicGenerationsForProject(access.supabase, {
      productId: access.productId,
      projectId,
    })
    return Response.json({ generations: rows })
  } catch (error) {
    return handleRouteError(error, 'Failed to list music generations')
  }
}

export const POST = async (
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const body = generateBodySchema.parse(await request.json())
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const { supabase, blobEnv } = access
    const { project, row } = await loadProject(supabase, projectId)
    const modelProfileId =
      (typeof row.model_profile_id === 'string' && row.model_profile_id) || DEFAULT_MODEL_PROFILE_ID
    const durationMs = Math.round((body.durationSeconds ?? 30) * 1000)
    const estimate = estimateMusicGbp({ modelProfileId, durationMs })

    if (body.estimateOnly) {
      return Response.json({
        estimatedGbp: estimate.estimatedGbp,
        modelId: estimate.modelId,
        units: estimate.units,
        stub: estimate.stub,
        durationMs,
      })
    }

    const result = await generateMusicForProject({
      supabase,
      blobEnv,
      productId: access.productId,
      project,
      expectedRevision: body.expectedRevision,
      modelProfileId,
      prompt: body.prompt,
      durationMs,
      forceInstrumental: body.forceInstrumental,
      confirmSpend: body.confirmSpend,
      placeOnTimeline: body.placeOnTimeline,
    })

    return Response.json({
      jobId: result.jobId,
      assetId: result.assetId,
      estimatedGbp: result.estimatedGbp,
      actualGbp: result.actualGbp,
      modelId: result.modelId,
      musicGeneration: result.musicGeneration,
      project: result.project,
      revision: result.project.revision,
    })
  } catch (error) {
    return handleRouteError(error, 'Music generation failed', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      if (err instanceof RevisionConflictError) {
        return jsonError(err.message, 409)
      }
      if (
        err instanceof Error &&
        /confirmSpend|soft cap|monthly cap|ELEVENLABS_API_KEY/i.test(err.message)
      ) {
        return jsonError(err.message, 400)
      }
      return null
    })
  }
}
