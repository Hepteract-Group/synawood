import {
  allowUnsignedPacksFromEnv,
  installPublishedPackVersion,
  listPublishedPacks,
} from '@synawood/creative/packs/catalog'
import { seedStarterPacks } from '@synawood/creative/packs/seed-starters'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Browse published agent packs (ADR-0039 / #291). Auto-seeds Hepteract starters in local/dev. */
export const GET = async (request: Request) => {
  try {
    const url = new URL(request.url)
    const productId = url.searchParams.get('productId')?.trim()
    if (!productId) return jsonError('productId is required', 400)
    const kind = url.searchParams.get('kind')?.trim()
    const access = await requireStudioAccess({ productId, minRole: 'viewer' })
    const allowUnsigned = allowUnsignedPacksFromEnv()

    let listings = await listPublishedPacks(access.supabase, {
      kind: kind === 'skill' || kind === 'style' ? kind : undefined,
    })
    let seededStarters = false
    if (listings.length === 0 && allowUnsigned) {
      await seedStarterPacks({
        supabase: access.supabase,
        blobEnv: access.blobEnv,
        productId,
      })
      seededStarters = true
      listings = await listPublishedPacks(access.supabase, {
        kind: kind === 'skill' || kind === 'style' ? kind : undefined,
      })
    }

    return Response.json({ packs: listings, allowUnsigned, seededStarters })
  } catch (error) {
    return handleRouteError(error, 'Failed to list packs')
  }
}

/** Install a published pack version for a product. */
export const POST = async (request: Request) => {
  try {
    const body = (await request.json()) as {
      productId?: string
      packVersionId?: string
      allowUnsigned?: boolean
      scope?: 'product' | 'account'
    }
    const productId = body.productId?.trim()
    const packVersionId = body.packVersionId?.trim()
    if (!productId) return jsonError('productId is required', 400)
    if (!packVersionId) return jsonError('packVersionId is required', 400)

    const access = await requireStudioAccess({ productId, minRole: 'editor' })
    const result = await installPublishedPackVersion({
      supabase: access.supabase,
      blobEnv: access.blobEnv,
      productId,
      userId: access.userId,
      packVersionId,
      scope: body.scope === 'account' ? 'account' : 'product',
      allowUnsigned: body.allowUnsigned === true ? allowUnsignedPacksFromEnv() : undefined,
      publicKeyPem: process.env.PACK_SIGNING_PUBLIC_KEY_PEM ?? null,
    })
    return Response.json(result)
  } catch (error) {
    return handleRouteError(error, 'Failed to install pack')
  }
}
