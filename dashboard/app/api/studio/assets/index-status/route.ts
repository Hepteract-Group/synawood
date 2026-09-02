import {
  attachVisualEmbeddingFlags,
  listUnindexedAssetIds,
  resolveLibraryBackfill,
  summarizeAssetIndexStatuses,
} from '@synawood/creative/asset-intelligence'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const querySchema = z.object({
  productId: z.string().trim().min(1),
  projectId: z.string().uuid(),
})

/** GET — project Media bin index status for the chip (#173 / #445 / #584). */
export const GET = async (request: Request) => {
  try {
    const url = new URL(request.url)
    const parsed = querySchema.parse({
      productId: url.searchParams.get('productId') ?? undefined,
      projectId: url.searchParams.get('projectId') ?? undefined,
    })
    const access = await requireStudioAccess({
      productId: parsed.productId,
      projectId: parsed.projectId,
      minRole: 'viewer',
    })

    const { indexed, backfillAssetIds, assetIds } = await resolveLibraryBackfill({
      supabase: access.supabase,
      productId: parsed.productId,
      projectId: parsed.projectId,
    })
    const unindexedAssetIds = listUnindexedAssetIds(assetIds, indexed)
    const items = await attachVisualEmbeddingFlags({
      supabase: access.supabase,
      productId: parsed.productId,
      items: indexed,
    })
    return Response.json({
      items,
      summary: summarizeAssetIndexStatuses(items),
      unindexedAssetIds,
      unindexedCount: unindexedAssetIds.length,
      backfillAssetIds,
      backfillCount: backfillAssetIds.length,
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to load index status', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return null
    })
  }
}
