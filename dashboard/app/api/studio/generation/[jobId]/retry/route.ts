import { z } from 'zod'
import { enqueueGenerationJob, getGenerationJob } from '@synawood/creative/generation-jobs'
import { loadProject } from '@synawood/creative/project'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { runStudioProjectTool } from '@/lib/studio-tool-route'
import type { StudioToolName } from '@synawood/creative/tools'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z
  .object({
    confirmSpend: z.boolean().optional(),
  })
  .strict()

const toolForRole = (role: string): StudioToolName | null => {
  if (role === 'image') return 'generate_image'
  if (role === 'video') return 'generate_video_clip'
  if (role === 'music') return 'generate_music'
  if (role === 'speech' || role.startsWith('voice_')) return 'generate_voiceover'
  return null
}

/** Re-run a failed generation job (same role / snapshot / project). */
export const POST = async (request: Request, context: { params: Promise<{ jobId: string }> }) => {
  try {
    const { jobId } = await context.params
    const body = bodySchema.parse(await request.json().catch(() => ({})))
    const access = await requireStudioAccess({ generationJobId: jobId, minRole: 'editor' })
    const job = await getGenerationJob(access.supabase, jobId)
    if (!job) return jsonError('Generation job not found', 404)
    if (job.status !== 'failed') {
      return jsonError('Retry is for failed jobs.', 400)
    }
    const estimatedGbp = job.estimated_gbp ?? 0
    if (estimatedGbp > 0 && body.confirmSpend !== true) {
      return Response.json(
        {
          error: `Retry would cost about £${estimatedGbp.toFixed(2)}. Confirm to continue.`,
          needsConfirm: true,
          estimatedGbp,
        },
        { status: 402 },
      )
    }
    const toolName = toolForRole(job.role)
    const snapshot = job.input_snapshot ?? {}
    const prompt = typeof snapshot.prompt === 'string' ? snapshot.prompt : null
    if (job.project_id && toolName && prompt) {
      const { project } = await loadProject(access.supabase, job.project_id)
      const generated = await runStudioProjectTool(
        access,
        job.project_id,
        project.revision,
        toolName,
        {
          prompt,
          confirmSpend: true,
        },
      )
      if (!generated.outcome.ok) {
        return Response.json({ error: generated.outcome.error }, { status: 400 })
      }
      return Response.json({ jobId, status: 'generating' })
    }
    if (!job.model_id || !job.model_profile_id) {
      return jsonError('This job has no model to retry with.', 400)
    }
    const queued = await enqueueGenerationJob(access.supabase, {
      productId: job.product_id,
      projectId: job.project_id,
      role: job.role,
      modelId: job.model_id,
      modelProfileId: job.model_profile_id,
      estimatedGbp,
      units: job.units ?? undefined,
      inputSnapshot: job.input_snapshot ?? {},
    })
    return Response.json({
      jobId: queued.id,
      status: queued.status,
    })
  } catch (error) {
    return handleRouteError(error, 'Could not retry generation')
  }
}
