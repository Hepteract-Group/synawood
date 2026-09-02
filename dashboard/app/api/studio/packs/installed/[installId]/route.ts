import { setPackInstallEnabled, uninstallPack } from '@synawood/creative/packs/catalog'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ installId: string }> }

/** Enable / disable an installed pack. */
export const PATCH = async (request: Request, { params }: Params) => {
  try {
    const { installId } = await params
    const body = (await request.json()) as { productId?: string; enabled?: boolean }
    const productId = body.productId?.trim()
    if (!productId) return jsonError('productId is required', 400)
    if (typeof body.enabled !== 'boolean') return jsonError('enabled boolean is required', 400)

    const access = await requireStudioAccess({ productId, minRole: 'editor' })
    const install = await setPackInstallEnabled(access.supabase, {
      productId,
      userId: access.userId,
      installId,
      enabled: body.enabled,
    })
    return Response.json({ install })
  } catch (error) {
    return handleRouteError(error, 'Failed to update pack install')
  }
}

/** Uninstall (delete install row; blob history retained). */
export const DELETE = async (request: Request, { params }: Params) => {
  try {
    const { installId } = await params
    const productId = new URL(request.url).searchParams.get('productId')?.trim()
    if (!productId) return jsonError('productId is required', 400)

    const access = await requireStudioAccess({ productId, minRole: 'editor' })
    await uninstallPack(access.supabase, { productId, userId: access.userId, installId })
    return Response.json({ ok: true })
  } catch (error) {
    return handleRouteError(error, 'Failed to uninstall pack')
  }
}
