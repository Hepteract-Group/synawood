import { loadProject, saveProject } from '@synawood/creative/project'
import {
  applyGenerationPlanToProject,
  generationPlanSceneSchema,
  parseGenerationPlan,
  type GenerationPlan,
} from '@synawood/creative/generation-plan'
import { enqueueExtractOnPlanConfirm } from '@synawood/creative/extract/enqueue-extract-on-plan-confirm'
import { UnsafeUrlError } from '@synawood/creative/extract/ssrf'
import { DEFAULT_MODEL_PROFILE_ID, isFrozenVideoModelId } from '@synawood/creative/model-profiles'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const patchBodySchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    goal: z.string().min(1).max(240).optional(),
    tone: z.string().min(1).max(120).optional(),
    runtimeSeconds: z.number().positive().max(600).optional(),
    platform: z.string().min(1).max(80).optional(),
    scenes: z.array(generationPlanSceneSchema).optional(),
    extraExtractUrls: z.array(z.string().url()).optional(),
    reExtractThisTurn: z.boolean().optional(),
  })
  .strict()

const confirmBodySchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    planId: z.string().uuid(),
  })
  .strict()

/** GET — current generation plan from project (reload-safe poll). */
export const GET = async (
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const access = await requireStudioAccess({ projectId, minRole: 'viewer' })
    const { project } = await loadProject(access.supabase, projectId)
    return Response.json({ plan: project.generationPlan ?? null })
  } catch (error) {
    return handleRouteError(error, 'Failed to load generation plan')
  }
}

/** PATCH — operator edits plan fields (goal, tone, scenes, etc.) from the modal. */
export const PATCH = async (
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const raw = await request.json().catch(() => ({}))
    const body = patchBodySchema.parse(raw)
    const { project } = await loadProject(access.supabase, projectId)

    const existing = project.generationPlan
    if (!existing) {
      return jsonError('No generation plan on this project', 404)
    }
    if (existing.status === 'applied') {
      return jsonError('Cannot edit an applied generation plan', 409)
    }

    const updated: GenerationPlan = parseGenerationPlan({
      ...existing,
      ...(body.goal !== undefined && { goal: body.goal }),
      ...(body.tone !== undefined && { tone: body.tone }),
      ...(body.runtimeSeconds !== undefined && { runtimeSeconds: body.runtimeSeconds }),
      ...(body.platform !== undefined && { platform: body.platform }),
      ...(body.scenes !== undefined && { scenes: body.scenes }),
      ...(body.extraExtractUrls !== undefined && { extraExtractUrls: body.extraExtractUrls }),
      ...(body.reExtractThisTurn !== undefined && { reExtractThisTurn: body.reExtractThisTurn }),
    })

    const { project: saved } = await saveProject(
      access.supabase,
      applyGenerationPlanToProject(project, updated),
      body.expectedRevision,
    )
    return Response.json({ plan: saved.generationPlan ?? null, revision: saved.revision })
  } catch (error) {
    return handleRouteError(error, 'Failed to update generation plan', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((i) => i.message).join('; '), 400)
      }
      const msg = err instanceof Error ? err.message : ''
      if (msg.toLowerCase().includes('conflict')) return jsonError(msg, 409)
      return null
    })
  }
}

/** POST — operator confirms spend; marks plan status → ready for generate trigger. */
export const POST = async (
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const access = await requireStudioAccess({ projectId, minRole: 'editor' })
    const raw = await request.json().catch(() => ({}))
    const body = confirmBodySchema.parse(raw)
    const { project, row } = await loadProject(access.supabase, projectId)

    const existing = project.generationPlan
    if (!existing) {
      return jsonError('No generation plan on this project', 404)
    }
    if (existing.id !== body.planId) {
      return jsonError('Plan id mismatch — reload and try again', 409)
    }
    if (existing.status === 'applied') {
      return jsonError('Plan already applied', 409)
    }
    // ADR-0085: frozen video model id blocks confirm — no spend, no enqueue.
    if (existing.videoModelId && isFrozenVideoModelId(existing.videoModelId)) {
      return jsonError(
        'Video model is frozen — update the model in Settings before confirming',
        409,
      )
    }

    await enqueueExtractOnPlanConfirm({
      supabase: access.supabase,
      productId: access.productId,
      projectId,
      reExtractThisTurn: existing.reExtractThisTurn,
      extraExtractUrls: existing.extraExtractUrls,
      modelProfileId:
        (typeof row.model_profile_id === 'string' && row.model_profile_id) ||
        DEFAULT_MODEL_PROFILE_ID,
    })

    const confirmed: GenerationPlan = parseGenerationPlan({
      ...existing,
      status: 'ready',
    })

    const { project: saved } = await saveProject(
      access.supabase,
      applyGenerationPlanToProject(project, confirmed),
      body.expectedRevision,
    )
    return Response.json({ plan: saved.generationPlan ?? null, revision: saved.revision })
  } catch (error) {
    return handleRouteError(error, 'Failed to confirm generation plan', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((i) => i.message).join('; '), 400)
      }
      if (err instanceof UnsafeUrlError) {
        return jsonError(err.message, 400)
      }
      const msg = err instanceof Error ? err.message : ''
      if (msg.toLowerCase().includes('conflict')) return jsonError(msg, 409)
      if (/budget|cap|credit|wallet|confirm spend/i.test(msg)) return jsonError(msg, 402)
      return null
    })
  }
}
