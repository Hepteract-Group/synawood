import { listGenerationJobsForProduct } from '@synawood/creative/generation-jobs'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET — product-wide generation jobs for AI Media (reload-safe). */
export const GET = async (request: Request) => {
  try {
    const productId = new URL(request.url).searchParams.get('productId')
    if (!productId) return jsonError('productId is required', 400)
    const access = await requireStudioAccess({ productId, minRole: 'viewer' })
    const jobs = await listGenerationJobsForProduct(access.supabase, {
      productId: access.productId,
      limit: 80,
    })
    const outputIds = jobs
      .map((job) => job.output_asset_id)
      .filter((id): id is string => Boolean(id))
    const kinds = new Map<string, string>()
    if (outputIds.length > 0) {
      const { data, error } = await access.supabase
        .from('assets')
        .select('id, kind')
        .in('id', outputIds)
      if (error) throw new Error(`Failed to load output assets: ${error.message}`)
      for (const row of data ?? []) {
        if (row.id && row.kind) kinds.set(row.id as string, row.kind as string)
      }
    }
    return Response.json({
      jobs: jobs.map((job) => ({
        id: job.id,
        status: job.status,
        role: job.role,
        errorMessage: job.error_message,
        estimatedGbp: job.estimated_gbp,
        actualGbp: job.actual_gbp,
        projectId: job.project_id,
        outputAssetId: job.output_asset_id,
        outputKind: job.output_asset_id ? (kinds.get(job.output_asset_id) ?? null) : null,
        createdAt: job.created_at ?? null,
      })),
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to list generation jobs')
  }
}
