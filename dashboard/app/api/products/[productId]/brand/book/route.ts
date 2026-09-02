import { NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { brandKitRoot } from '@synawood/creative/brand'
import { handleRouteError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Optional Brand Book markdown preview (#105). */
export const GET = async (
  _request: Request,
  context: { params: Promise<{ productId: string }> },
) => {
  try {
    const { productId } = await context.params
    await requireStudioAccess({ productId, minRole: 'editor' })
    const kit = brandKitRoot(productId)
    const bookPath = path.join(path.dirname(kit), 'product-marketing.md')
    try {
      const markdown = await readFile(bookPath, 'utf8')
      return NextResponse.json({ markdown, path: `products/${productId}/product-marketing.md` })
    } catch {
      return NextResponse.json({ markdown: null, path: null })
    }
  } catch (error) {
    return handleRouteError(error, 'Could not load Brand Book.')
  }
}
