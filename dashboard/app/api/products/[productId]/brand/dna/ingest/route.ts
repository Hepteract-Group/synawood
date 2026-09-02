import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ingestDnaFromUrl, loadProductBrandDna, saveBrandDnaDraft } from '@synawood/creative/brand'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ingestSchema = z.object({ url: z.string().min(1).max(500) }).strict()

/** POST public-page ingest → persistent DNA draft (ADR-0044 / #106). */
export const POST = async (
  request: Request,
  context: { params: Promise<{ productId: string }> },
) => {
  try {
    const { productId } = await context.params
    const access = await requireStudioAccess({ productId, minRole: 'editor' })
    const body = ingestSchema.parse(await request.json())
    const loaded = await loadProductBrandDna(access.supabase, productId)
    const ingested = await ingestDnaFromUrl({ productId, url: body.url })
    await saveBrandDnaDraft(access.supabase, productId, ingested)
    return NextResponse.json({
      dna: loaded.dna,
      source: loaded.source,
      draft: ingested.draft,
      draftUrl: ingested.sourceUrl,
    })
  } catch (error) {
    return handleRouteError(error, 'Could not ingest Brand DNA.', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return null
    })
  }
}
