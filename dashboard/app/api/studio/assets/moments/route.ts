import { findMoments } from '@synawood/creative/asset-intelligence'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const querySchema = z
  .object({
    productId: z.string().trim().min(1),
    q: z.string().trim().max(400).optional(),
    imageAssetId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .refine((value) => Boolean(value.q) || Boolean(value.imageAssetId), {
    message: 'q or imageAssetId is required',
  })

/** GET — shot-level Moments (viewer). Mirrors find_moments tool. */
export const GET = async (request: Request) => {
  try {
    const url = new URL(request.url)
    const parsed = querySchema.parse({
      productId: url.searchParams.get('productId') ?? undefined,
      q: url.searchParams.get('q') ?? undefined,
      imageAssetId: url.searchParams.get('imageAssetId') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
    })
    const access = await requireStudioAccess({
      productId: parsed.productId,
      minRole: 'viewer',
    })
    const hits = await findMoments({
      supabase: access.supabase,
      productId: parsed.productId,
      query: parsed.q ?? '',
      imageAssetId: parsed.imageAssetId,
      limit: parsed.limit,
      useMock: process.env.MODEL_PROFILE === 'ci-stub',
      blobEnv: access.blobEnv,
    })
    return Response.json({ hits })
  } catch (error) {
    return handleRouteError(error, 'Moment search failed', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return null
    })
  }
}
