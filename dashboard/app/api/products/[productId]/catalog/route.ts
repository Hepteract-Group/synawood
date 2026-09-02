import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  catalogItemSchema,
  loadProductCatalogRow,
  parseProductCatalog,
  saveProductCatalogRow,
} from '@synawood/creative/brand'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ productId: string }> }

const upsertItemSchema = catalogItemSchema

/** GET Product Catalog (editor+). Distinct from the Asset Library. */
export const GET = async (_request: Request, context: RouteContext) => {
  try {
    const { productId } = await context.params
    const access = await requireStudioAccess({ productId, minRole: 'editor' })
    const loaded = await loadProductCatalogRow(access.supabase, productId)
    return NextResponse.json({ catalog: loaded.catalog, source: loaded.source })
  } catch (error) {
    return handleRouteError(error, 'Could not load Catalog.')
  }
}

/** POST upserts one catalog item. */
export const POST = async (request: Request, context: RouteContext) => {
  try {
    const { productId } = await context.params
    const access = await requireStudioAccess({ productId, minRole: 'editor' })
    const item = upsertItemSchema.parse(await request.json())
    const loaded = await loadProductCatalogRow(access.supabase, productId)
    const items = loaded.catalog.items.filter((row) => row.id !== item.id)
    items.push(item)
    const catalog = await saveProductCatalogRow(
      access.supabase,
      parseProductCatalog({ productId, items }, productId),
    )
    return NextResponse.json({ catalog, source: 'cache' })
  } catch (error) {
    return handleRouteError(error, 'Could not save Catalog item.', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return null
    })
  }
}
