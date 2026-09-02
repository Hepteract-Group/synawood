import { listAssetsByTag } from '@synawood/creative/asset-intelligence'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const querySchema = z.object({
  productId: z.string().trim().min(1),
  tag: z.string().trim().min(1).max(64),
  prefix: z
    .enum(['1', 'true', '0', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === '1' || value === 'true')),
  limit: z.coerce.number().int().min(1).max(50).optional(),
})

/** GET — list indexed assets by tag (viewer). Mirrors list_assets_by_tag tool. */
export const GET = async (request: Request) => {
  try {
    const url = new URL(request.url)
    const parsed = querySchema.parse({
      productId: url.searchParams.get('productId') ?? undefined,
      tag: url.searchParams.get('tag') ?? undefined,
      prefix: url.searchParams.get('prefix') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
    })
    const access = await requireStudioAccess({
      productId: parsed.productId,
      minRole: 'viewer',
    })
    const hits = await listAssetsByTag({
      supabase: access.supabase,
      productId: parsed.productId,
      tag: parsed.tag,
      prefix: parsed.prefix,
      limit: parsed.limit,
    })
    return Response.json({ hits })
  } catch (error) {
    return handleRouteError(error, 'Tag list failed', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return null
    })
  }
}
