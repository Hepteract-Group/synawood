import { getBlobBytes } from '@synawood/creative'
import { latestFinalForProject } from '@synawood/channels'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

/**
 * Stream the retained Final primary asset. Retained rows live in `assets` but
 * are not always mirrored onto the Studio Project JSON, so we resolve via
 * final_assets → assets.blob_key.
 */
export const GET = async (
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  try {
    const { projectId } = await context.params
    const access = await requireStudioAccess({ projectId, minRole: 'viewer' })
    const { supabase, blobEnv } = access
    const final = await latestFinalForProject(supabase, projectId)
    if (!final) {
      return jsonError('No Final asset. Approve a candidate first.', 404)
    }

    const { data: asset, error } = await supabase
      .from('assets')
      .select('id, blob_key, content_type, kind')
      .eq('id', final.primaryAssetId)
      .maybeSingle()
    if (error) {
      return jsonError(`Failed to load Final asset row: ${error.message}`, 500)
    }
    if (!asset) {
      return jsonError('Final primary asset row missing.', 404)
    }

    const row = asset as {
      id: string
      blob_key: string
      content_type: string | null
      kind: string
    }
    const bytes = await getBlobBytes({ blobEnv, blobKey: row.blob_key })
    const contentType = row.content_type ?? 'application/octet-stream'
    const fileName = row.blob_key.split('/').filter(Boolean).pop() ?? `final-${final.id}.bin`

    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'private, max-age=60',
        'X-Content-Type-Options': 'nosniff',
        'X-Final-Asset-Id': final.id,
        'X-Asset-Id': row.id,
      },
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to download Final')
  }
}
