import { createSignedBlobUrl } from '@synawood/creative'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const GET = async (
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const access = await requireStudioAccess({ projectId, minRole: 'viewer' })
    const { supabase, blobEnv } = access
    const { data, error } = await supabase
      .from('render_jobs')
      .select('id, status, error_message, project_id, created_at, updated_at, output_asset_ids')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) {
      return jsonError(`Failed to load render job: ${error.message}`, 500)
    }
    if (!data) {
      return Response.json({ job: null, outputs: [] })
    }

    const outputs = []
    for (const assetId of data.output_asset_ids ?? []) {
      const { data: asset, error: assetError } = await supabase
        .from('assets')
        .select('id, kind, blob_key, content_type')
        .eq('id', assetId)
        .maybeSingle()
      if (assetError || !asset) continue
      outputs.push({
        id: asset.id,
        kind: asset.kind,
        blobKey: asset.blob_key,
        contentType: asset.content_type,
        signedUrl: createSignedBlobUrl({
          blobEnv,
          blobKey: asset.blob_key,
          expiresInSeconds: 60 * 60,
        }),
      })
    }

    return Response.json({
      job: {
        id: data.id,
        status: data.status,
        projectId: data.project_id,
        errorMessage: data.error_message,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
      outputs,
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to load render job')
  }
}
