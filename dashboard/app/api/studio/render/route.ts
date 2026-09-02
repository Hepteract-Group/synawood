import { enqueueRenderJob, type RenderTargets } from '@synawood/creative/render'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { spawnLocalRenderWorker } from '@/lib/spawn-local-render'

const shouldRunInlineLocalRender = (): boolean =>
  process.env.NODE_ENV === 'development' && process.env.STUDIO_RENDER_INLINE !== 'false'

export const POST = async (request: Request) => {
  try {
    if (process.env.STUDIO_RENDER_API === 'false') {
      return jsonError('Render API is disabled by STUDIO_RENDER_API=false', 403)
    }
    const body = (await request.json().catch(() => ({}))) as {
      projectId?: string
      targets?: RenderTargets
    }
    if (!body.projectId) {
      return jsonError('projectId is required')
    }
    const targets =
      body.targets === 'stills' || body.targets === 'mp4' || body.targets === 'both'
        ? body.targets
        : 'both'
    const access = await requireStudioAccess({ projectId: body.projectId, minRole: 'editor' })
    const { supabase } = access
    const job = await enqueueRenderJob(supabase, body.projectId, { targets })

    const inlineLocal = shouldRunInlineLocalRender()
    if (inlineLocal) {
      try {
        spawnLocalRenderWorker(job.id)
      } catch (error: unknown) {
        console.error('[studio render inline]', error)
      }
    }

    return Response.json(
      {
        job: {
          id: job.id,
          status: job.status,
          projectId: job.project_id,
          errorMessage: job.error_message,
          targets,
        },
        inlineLocal,
        workerHint: inlineLocal
          ? null
          : 'Render queued. Start the local worker: npm run render:local -- --job <id>',
      },
      { status: 201 },
    )
  } catch (error) {
    return handleRouteError(error, 'Failed to enqueue render')
  }
}
