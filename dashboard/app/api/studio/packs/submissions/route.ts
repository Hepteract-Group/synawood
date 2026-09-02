import { listPackSubmissions, submitPackForReview } from '@synawood/creative/packs/catalog'
import { packManifestSchema } from '@synawood/creative/packs'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Curator queue — owner (or editor) lists submissions (#291). */
export const GET = async (request: Request) => {
  try {
    const url = new URL(request.url)
    const productId = url.searchParams.get('productId')?.trim()
    if (!productId) return jsonError('productId is required', 400)
    const status = url.searchParams.get('status')?.trim()
    const access = await requireStudioAccess({ productId, minRole: 'owner' })
    const submissions = await listPackSubmissions(access.supabase, {
      status:
        status === 'queued' || status === 'approved' || status === 'rejected' ? status : undefined,
    })
    return Response.json({ submissions })
  } catch (error) {
    return handleRouteError(error, 'Failed to list pack submissions')
  }
}

/** Submit a pack artifact metadata row for curator review. */
export const POST = async (request: Request) => {
  try {
    const body = (await request.json()) as {
      productId?: string
      slug?: string
      kind?: 'skill' | 'style'
      title?: string
      blobKey?: string
      checksumSha256?: string
      signature?: string | null
      manifest?: unknown
      packId?: string | null
    }
    const productId = body.productId?.trim()
    if (!productId) return jsonError('productId is required', 400)
    if (!body.slug?.trim() || !body.kind || !body.title?.trim()) {
      return jsonError('slug, kind, and title are required', 400)
    }
    if (!body.blobKey?.trim() || !body.checksumSha256?.trim()) {
      return jsonError('blobKey and checksumSha256 are required', 400)
    }
    const manifest = packManifestSchema.parse(body.manifest)
    const access = await requireStudioAccess({ productId, minRole: 'editor' })
    const submission = await submitPackForReview(access.supabase, {
      slug: body.slug.trim(),
      kind: body.kind,
      title: body.title.trim(),
      blobKey: body.blobKey.trim(),
      checksumSha256: body.checksumSha256.trim(),
      signature: body.signature ?? null,
      manifest,
      submittedBy: access.userId,
      packId: body.packId ?? null,
    })
    return Response.json({ submission }, { status: 201 })
  } catch (error) {
    return handleRouteError(error, 'Failed to submit pack')
  }
}
