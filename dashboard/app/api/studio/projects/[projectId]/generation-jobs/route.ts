import { listGenerationJobsForProject } from '@synawood/creative/generation-jobs'
import { handleRouteError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET — project generation jobs for workspace banners (reload-safe). */
export const GET = async (
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const access = await requireStudioAccess({ projectId, minRole: 'viewer' })
    const active = new URL(request.url).searchParams.get('active') === '1'
    const jobs = await listGenerationJobsForProject(access.supabase, {
      projectId,
      statuses: active ? ['queued', 'generating'] : undefined,
      limit: 40,
    })
    return Response.json({
      jobs: jobs.map((job) => ({
        id: job.id,
        status: job.status,
        role: job.role,
        errorMessage: job.error_message,
        estimatedGbp: job.estimated_gbp,
        libraryKind:
          typeof job.input_snapshot?.libraryKind === 'string'
            ? job.input_snapshot.libraryKind
            : null,
        extractKind:
          typeof job.input_snapshot?.extractKind === 'string'
            ? job.input_snapshot.extractKind
            : null,
        aspect: typeof job.input_snapshot?.aspect === 'string' ? job.input_snapshot.aspect : null,
      })),
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to list generation jobs')
  }
}
