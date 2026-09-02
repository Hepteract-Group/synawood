import { deleteProductExtract, isDeleteExtractError } from '@synawood/creative/extract'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const DELETE = async (
  _request: Request,
  context: { params: Promise<{ productId: string; extractId: string }> },
) => {
  try {
    const { productId, extractId } = await context.params
    const access = await requireStudioAccess({ productId, minRole: 'editor' })
    const result = await deleteProductExtract({
      supabase: access.supabase,
      blobEnv: access.blobEnv,
      productId,
      extractId,
    })
    return Response.json({ deleted: true, extractId: result.extractId })
  } catch (error) {
    return handleRouteError(error, 'Failed to delete extract', (err) => {
      if (isDeleteExtractError(err)) {
        return jsonError(err.message, err.status)
      }
      return null
    })
  }
}
