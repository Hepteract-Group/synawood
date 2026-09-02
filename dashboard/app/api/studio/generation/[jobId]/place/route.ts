import { addClip, ensureAssetOnProject, loadProject, saveProject } from '@synawood/creative/project'
import { getGenerationJob } from '@synawood/creative/generation-jobs'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Attach a ready job's output to its Studio project timeline. */
export const POST = async (_request: Request, context: { params: Promise<{ jobId: string }> }) => {
  try {
    const { jobId } = await context.params
    const access = await requireStudioAccess({ generationJobId: jobId, minRole: 'editor' })
    const job = await getGenerationJob(access.supabase, jobId)
    if (!job) return jsonError('Generation job not found', 404)
    if (job.status !== 'ready' || !job.output_asset_id) {
      return jsonError('Place needs a ready file.', 400)
    }
    if (!job.project_id) {
      return Response.json({ href: '/studio', placed: false })
    }
    const { project } = await loadProject(access.supabase, job.project_id)
    const expectedRevision = project.revision
    const ensured = await ensureAssetOnProject({
      supabase: access.supabase,
      project,
      assetId: job.output_asset_id,
    })
    const from = ensured.project.clips.reduce(
      (end, clip) => Math.max(end, clip.from + clip.durationInFrames),
      0,
    )
    const next = addClip(ensured.project, { assetId: job.output_asset_id, from })
    await saveProject(access.supabase, next, expectedRevision)
    return Response.json({
      projectId: job.project_id,
      href: `/studio/${job.project_id}`,
    })
  } catch (error) {
    return handleRouteError(error, 'Could not place in Studio')
  }
}
