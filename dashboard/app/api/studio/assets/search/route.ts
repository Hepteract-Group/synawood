import { findAssetsSemantic } from '@synawood/creative/asset-intelligence'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const querySchema = z.object({
  productId: z.string().trim().min(1),
  q: z.string().trim().min(1).max(400),
  limit: z.coerce.number().int().min(1).max(50).optional(),
})

/** GET — semantic asset search (viewer). Mirrors find_assets tool. */
export const GET = async (request: Request) => {
  try {
    const url = new URL(request.url)
    const parsed = querySchema.parse({
      productId: url.searchParams.get('productId') ?? undefined,
      q: url.searchParams.get('q') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
    })
    const access = await requireStudioAccess({
      productId: parsed.productId,
      minRole: 'viewer',
    })
    const hits = await findAssetsSemantic({
      supabase: access.supabase,
      productId: parsed.productId,
      query: parsed.q,
      limit: parsed.limit,
      useMock: process.env.MODEL_PROFILE === 'ci-stub',
    })
    return Response.json({ hits })
  } catch (error) {
    return handleRouteError(error, 'Asset search failed', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return null
    })
  }
}
