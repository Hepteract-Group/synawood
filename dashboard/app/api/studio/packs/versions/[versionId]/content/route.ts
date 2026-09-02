import { loadPackVersionPreview } from '@synawood/creative/packs/preview'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ versionId: string }> }

/** Readable pack entry (skill/style markdown) for browse detail (#492). */
export const GET = async (request: Request, { params }: Params) => {
  try {
    const { versionId } = await params
    const productId = new URL(request.url).searchParams.get('productId')?.trim()
    if (!productId) return jsonError('productId is required', 400)
    const access = await requireStudioAccess({ productId, minRole: 'viewer' })
    const preview = await loadPackVersionPreview({
      supabase: access.supabase,
      blobEnv: access.blobEnv,
      packVersionId: versionId,
    })
    return Response.json({ preview })
  } catch (error) {
    return handleRouteError(error, 'Failed to load pack preview')
  }
}
