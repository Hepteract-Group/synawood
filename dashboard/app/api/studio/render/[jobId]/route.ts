import { createSignedBlobUrl } from '@synawood/creative'
import { getRenderJob } from '@synawood/creative/render'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const GET = async (_request: Request, context: { params: Promise<{ jobId: string }> }) => {
  try {
    const { jobId } = await context.params
    const access = await requireStudioAccess({ renderJobId: jobId, minRole: 'viewer' })
    const { supabase, blobEnv } = access
    const job = await getRenderJob(supabase, jobId)

    const outputs = []
    for (const assetId of job.output_asset_ids ?? []) {
      const { data, error } = await supabase
        .from('assets')
        .select('id, kind, blob_key, content_type')
        .eq('id', assetId)
        .maybeSingle()
      if (error || !data) {
        continue
      }
      outputs.push({
        id: data.id,
        kind: data.kind,
        blobKey: data.blob_key,
        contentType: data.content_type,
        signedUrl: createSignedBlobUrl({
          blobEnv,
          blobKey: data.blob_key,
          expiresInSeconds: 60 * 60,
        }),
      })
    }

    return Response.json({
      job: {
        id: job.id,
        status: job.status,
        projectId: job.project_id,
        errorMessage: job.error_message,
        durationMs: job.duration_ms,
        attemptCount: job.attempt_count ?? 0,
      },
      outputs,
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to load render job', (error) => {
      const message = error instanceof Error ? error.message : 'Failed to load render job'
      if (message.includes('not found')) return jsonError(message, 404)
      return null
    })
  }
}
