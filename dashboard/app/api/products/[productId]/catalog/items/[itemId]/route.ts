import { NextResponse } from 'next/server'
import {
  loadProductCatalogRow,
  parseProductCatalog,
  saveProductCatalogRow,
} from '@synawood/creative/brand'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ productId: string; itemId: string }> }

/** DELETE removes a live Catalog item. Historical campaign snapshots are not rewritten. */
export const DELETE = async (_request: Request, context: RouteContext) => {
  try {
    const { productId, itemId } = await context.params
    const access = await requireStudioAccess({ productId, minRole: 'editor' })
    const loaded = await loadProductCatalogRow(access.supabase, productId)
    const items = loaded.catalog.items.filter((row) => row.id !== itemId)
    if (items.length === loaded.catalog.items.length) {
      return jsonError(`Catalog item ${itemId} was not found.`, 404)
    }
    const catalog = await saveProductCatalogRow(
      access.supabase,
      parseProductCatalog({ productId, items }, productId),
    )
    return NextResponse.json({ catalog, source: 'cache' })
  } catch (error) {
    return handleRouteError(error, 'Could not delete Catalog item.')
  }
}
