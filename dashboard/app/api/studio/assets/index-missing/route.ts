import {
  enqueueAndRunAssetIndexInline,
  resolveLibraryBackfill,
} from '@synawood/creative/asset-intelligence'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z
  .object({
    productId: z.string().trim().min(1),
    projectId: z.string().uuid(),
    /** Cap inline runs so a large library does not block the request forever. */
    limit: z.number().int().min(1).max(20).optional().default(8),
  })
  .strict()

/**
 * POST — index unindexed assets and reindex video/image missing thumbs or visual (#445 / #584).
 * Local-first: enqueue + run inline (same as upload / reindex). Spend gate: confirmSpend + #175 caps.
 */
export const POST = async (request: Request) => {
  try {
    const body = bodySchema.parse(await request.json())
    const access = await requireStudioAccess({
      productId: body.productId,
      projectId: body.projectId,
      minRole: 'editor',
    })

    const { backfillAssetIds } = await resolveLibraryBackfill({
      supabase: access.supabase,
      productId: body.productId,
      projectId: body.projectId,
    })
    const missing = backfillAssetIds.slice(0, body.limit)

    const results: Array<{ assetId: string; jobId: string; ok: boolean; error?: string }> = []
    for (const assetId of missing) {
      try {
        const result = await enqueueAndRunAssetIndexInline({
          supabase: access.supabase,
          blobEnv: access.blobEnv,
          productId: body.productId,
          projectId: body.projectId,
          assetId,
          confirmSpend: true,
        })
        results.push({ assetId, jobId: result.jobId, ok: true })
      } catch (err) {
        results.push({
          assetId,
          jobId: '',
          ok: false,
          error: err instanceof Error ? err.message : 'Index failed',
        })
      }
    }

    return Response.json(
      {
        attempted: missing.length,
        remaining: Math.max(0, backfillAssetIds.length - missing.length),
        results,
      },
      { status: 201 },
    )
  } catch (error) {
    return handleRouteError(error, 'Failed to index missing assets', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return null
    })
  }
}
