import { describeAssetIndex } from '@synawood/creative/asset-intelligence'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const querySchema = z.object({
  productId: z.string().trim().min(1),
})

/** GET — index probe/status for one asset (viewer). Mirrors describe_asset tool. */
export const GET = async (request: Request, context: { params: Promise<{ assetId: string }> }) => {
  try {
    const { assetId } = await context.params
    if (!z.string().uuid().safeParse(assetId).success) {
      return jsonError('assetId must be a uuid', 400)
    }
    const url = new URL(request.url)
    const parsed = querySchema.parse({
      productId: url.searchParams.get('productId') ?? undefined,
    })
    const access = await requireStudioAccess({
      productId: parsed.productId,
      minRole: 'viewer',
    })
    const asset = await describeAssetIndex({
      supabase: access.supabase,
      productId: parsed.productId,
      assetId,
    })
    if (!asset) {
      return jsonError('Asset index not found for this product', 404)
    }
    return Response.json({ asset })
  } catch (error) {
    return handleRouteError(error, 'Failed to load asset index', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return null
    })
  }
}
