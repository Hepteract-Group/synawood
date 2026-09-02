import { listProductExtracts } from '@synawood/creative/extract'
import { createSignedBlobUrl } from '@synawood/creative/persistence/blob'
import { handleRouteError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SIGNED_URL_TTL_SECONDS = 60 * 60

export const GET = async (
  request: Request,
  context: { params: Promise<{ productId: string }> },
) => {
  try {
    const { productId } = await context.params
    const url = new URL(request.url)
    const limitParam = url.searchParams.get('limit')
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 200) : 100

    const access = await requireStudioAccess({ productId, minRole: 'viewer' })
    const extracts = await listProductExtracts({ supabase: access.supabase, productId, limit })

    const { blobEnv } = access
    const items = extracts.map((e) => ({
      id: e.id,
      kind: e.kind,
      sourceUrl: e.sourceUrl,
      text: e.text ?? null,
      quality: e.quality,
      qualityNote: e.qualityNote ?? null,
      createdAt: e.createdAt,
      thumbUrl:
        e.blobKey && (e.kind === 'screenshot' || e.kind === 'still')
          ? createSignedBlobUrl({
              blobEnv,
              blobKey: e.blobKey,
              expiresInSeconds: SIGNED_URL_TTL_SECONDS,
            })
          : null,
    }))

    return Response.json({ extracts: items })
  } catch (error) {
    return handleRouteError(error, 'Failed to load product extracts')
  }
}
