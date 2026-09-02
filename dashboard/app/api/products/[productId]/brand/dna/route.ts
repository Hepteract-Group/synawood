import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  applyDnaDraftFields,
  brandDnaSchema,
  ingestDnaFromUrl,
  loadBrandDna,
  loadProductBrandDna,
  saveBrandDnaDraft,
  saveProductBrandDna,
} from '@synawood/creative/brand'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ productId: string }> }

const patchSchema = brandDnaSchema.partial().extend({
  productId: z.string().min(1).optional(),
})

const ingestSchema = z.object({ url: z.string().min(1).max(500) }).strict()

const applySchema = z
  .object({
    fields: z.array(z.string().min(1).max(40)).min(1).max(16),
  })
  .strict()

/** GET Brand DNA + pending ingest draft (editor+). */
export const GET = async (_request: Request, context: RouteContext) => {
  try {
    const { productId } = await context.params
    const access = await requireStudioAccess({ productId, minRole: 'editor' })
    const loaded = await loadProductBrandDna(access.supabase, productId)
    return NextResponse.json({
      dna: loaded.dna,
      source: loaded.source,
      draft: loaded.draft?.draft ?? null,
      draftUrl: loaded.draft?.sourceUrl ?? null,
    })
  } catch (error) {
    return handleRouteError(error, 'Could not load Brand DNA.')
  }
}

/** PATCH upserts DNA cache. POST ingest | apply | discard. */
export const PATCH = async (request: Request, context: RouteContext) => {
  try {
    const { productId } = await context.params
    const access = await requireStudioAccess({ productId, minRole: 'editor' })
    const body = patchSchema.parse(await request.json())
    const loaded = await loadProductBrandDna(access.supabase, productId)
    const next = brandDnaSchema.parse({
      ...loaded.dna,
      ...body,
      productId,
      business: { ...loaded.dna.business, ...(body.business ?? {}) },
    })
    const dna = await saveProductBrandDna(access.supabase, next)
    return NextResponse.json({ dna, source: 'cache' })
  } catch (error) {
    return handleRouteError(error, 'Could not save Brand DNA.', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return null
    })
  }
}

export const POST = async (request: Request, context: RouteContext) => {
  try {
    const { productId } = await context.params
    const access = await requireStudioAccess({ productId, minRole: 'editor' })
    const url = new URL(request.url)
    const action = url.searchParams.get('action') ?? 'ingest'
    const loaded = await loadProductBrandDna(access.supabase, productId)

    if (action === 'reset') {
      const seeded = await loadBrandDna({ productId, cache: null })
      const dna = await saveProductBrandDna(access.supabase, seeded.dna)
      await saveBrandDnaDraft(access.supabase, productId, null)
      return NextResponse.json({
        dna,
        source: 'cache',
        draft: null,
        draftUrl: null,
        resetFrom: seeded.source,
      })
    }

    if (action === 'discard') {
      await saveBrandDnaDraft(access.supabase, productId, null)
      return NextResponse.json({
        dna: loaded.dna,
        source: loaded.source,
        draft: null,
        draftUrl: null,
      })
    }

    if (action === 'apply') {
      const body = applySchema.parse(await request.json())
      if (!loaded.draft) {
        return jsonError('No ingest draft to apply. Fetch a URL first.', 400)
      }
      const dna = await saveProductBrandDna(
        access.supabase,
        applyDnaDraftFields({
          current: loaded.dna,
          draft: loaded.draft.draft,
          fields: body.fields,
        }),
      )
      await saveBrandDnaDraft(access.supabase, productId, null)
      return NextResponse.json({ dna, source: 'cache', draft: null, draftUrl: null })
    }

    const body = ingestSchema.parse(await request.json())
    const ingested = await ingestDnaFromUrl({ productId, url: body.url })
    await saveBrandDnaDraft(access.supabase, productId, ingested)
    return NextResponse.json({
      dna: loaded.dna,
      source: loaded.source,
      draft: ingested.draft,
      draftUrl: ingested.sourceUrl,
    })
  } catch (error) {
    return handleRouteError(error, 'Could not update Brand DNA.', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return null
    })
  }
}
