import { cancelRenderJob } from '@synawood/creative/render'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const POST = async (_request: Request, context: { params: Promise<{ jobId: string }> }) => {
  try {
    const { jobId } = await context.params
    const access = await requireStudioAccess({ renderJobId: jobId, minRole: 'editor' })
    const { supabase } = access
    const job = await cancelRenderJob(supabase, jobId)
    return Response.json({
      job: {
        id: job.id,
        status: job.status,
        projectId: job.project_id,
        errorMessage: job.error_message,
      },
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to cancel render', (error) => {
      const message = error instanceof Error ? error.message : 'Failed to cancel render'
      if (/nothing to cancel/i.test(message)) return jsonError(message, 400)
      return null
    })
  }
}
