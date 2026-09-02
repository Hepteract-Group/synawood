import { getGenerationJob, loadBriefForJob } from '@synawood/creative/generation-jobs'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = async (_request: Request, context: { params: Promise<{ jobId: string }> }) => {
  try {
    const { jobId } = await context.params
    const access = await requireStudioAccess({ generationJobId: jobId, minRole: 'viewer' })
    const job = await getGenerationJob(access.supabase, jobId)
    if (!job) {
      return jsonError('Generation job not found', 404)
    }
    const brief = job.status === 'ready' ? await loadBriefForJob(access.supabase, job.id) : null
    return Response.json({
      job: {
        id: job.id,
        status: job.status,
        role: job.role,
        projectId: job.project_id,
        errorMessage: job.error_message,
        estimatedGbp: job.estimated_gbp,
        actualGbp: job.actual_gbp,
      },
      brief,
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to load generation job')
  }
}
