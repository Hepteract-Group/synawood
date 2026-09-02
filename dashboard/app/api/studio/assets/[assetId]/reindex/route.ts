import { enqueueAndRunAssetIndexInline } from '@synawood/creative/asset-intelligence'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z
  .object({
    productId: z.string().trim().min(1),
    projectId: z.string().uuid().nullable().optional(),
    modelProfileId: z.string().trim().min(1).optional(),
    confirmSpend: z.boolean().optional(),
  })
  .strict()

/**
 * POST — force reindex for one asset (editor).
 * Local-first: enqueue + run inline (same as upload auto-index). A later worker
 * can drain role=index jobs without this inline path.
 */
export const POST = async (request: Request, context: { params: Promise<{ assetId: string }> }) => {
  try {
    const { assetId } = await context.params
    if (!z.string().uuid().safeParse(assetId).success) {
      return jsonError('assetId must be a uuid', 400)
    }
    const body = bodySchema.parse(await request.json())
    const access = await requireStudioAccess({
      productId: body.productId,
      minRole: 'editor',
    })

    const { data: assetRow, error: assetError } = await access.supabase
      .from('assets')
      .select('id, product_id, project_id')
      .eq('id', assetId)
      .maybeSingle()
    if (assetError) {
      throw new Error(`Failed to load asset: ${assetError.message}`)
    }
    if (!assetRow || assetRow.product_id !== body.productId) {
      return jsonError('Asset not found for this product', 404)
    }

    const projectId =
      body.projectId === undefined
        ? ((assetRow.project_id as string | null) ?? null)
        : body.projectId

    const result = await enqueueAndRunAssetIndexInline({
      supabase: access.supabase,
      blobEnv: access.blobEnv,
      productId: body.productId,
      projectId,
      assetId,
      modelProfileId: body.modelProfileId,
      confirmSpend: body.confirmSpend ?? true,
    })

    return Response.json(
      {
        jobId: result.jobId,
        state: result.state,
        shotCount: result.shotCount,
        tagCount: result.tagCount,
        hasTranscript: result.hasTranscript,
        hasTextEmbedding: result.hasTextEmbedding,
        hasVisualEmbedding: result.hasVisualEmbedding,
      },
      { status: 201 },
    )
  } catch (error) {
    return handleRouteError(error, 'Reindex failed', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return null
    })
  }
}
