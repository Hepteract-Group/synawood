import {
  analyzeAsset,
  listAssetAnalyses,
  mapAnalyzeHttpError,
  parseAnalyzeGetQuery,
  parseAnalyzePostBody,
} from '@synawood/creative/asset-intelligence'
import { DEFAULT_MODEL_PROFILE_ID } from '@synawood/creative/model-profiles'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { z } from 'zod'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const uuidOk = (value: string) => z.string().uuid().safeParse(value).success

/**
 * POST — run analyze_asset for one library item (editor). Same function as the chat tool.
 * GET — latest stored analyses (viewer). Product-scoped.
 */
export const POST = async (request: Request, context: { params: Promise<{ assetId: string }> }) => {
  try {
    const { assetId } = await context.params
    if (!uuidOk(assetId)) {
      return jsonError('assetId must be a uuid', 400)
    }
    const body = parseAnalyzePostBody(await request.json())
    const access = await requireStudioAccess({
      productId: body.productId,
      minRole: 'editor',
    })

    const analysis = await analyzeAsset({
      supabase: access.supabase,
      blobEnv: access.blobEnv,
      productId: body.productId,
      projectId: body.projectId,
      modelProfileId: body.modelProfileId ?? DEFAULT_MODEL_PROFILE_ID,
      assetId,
      shotId: body.shotId,
      startMs: body.startMs,
      endMs: body.endMs,
      prompt: body.prompt,
      schema: body.schema,
      kind: body.kind,
      schemaId: body.schemaId,
      confirmSpend: body.confirmSpend,
    })

    return Response.json({ analysis })
  } catch (error) {
    return handleRouteError(error, 'Analyze failed', (err) => {
      const mapped = mapAnalyzeHttpError(err)
      if (!mapped) return null
      return jsonError(mapped.message, mapped.status)
    })
  }
}

export const GET = async (request: Request, context: { params: Promise<{ assetId: string }> }) => {
  try {
    const { assetId } = await context.params
    if (!uuidOk(assetId)) {
      return jsonError('assetId must be a uuid', 400)
    }
    const url = new URL(request.url)
    const parsed = parseAnalyzeGetQuery({
      productId: url.searchParams.get('productId') ?? undefined,
      kind: url.searchParams.get('kind') ?? undefined,
    })
    const access = await requireStudioAccess({
      productId: parsed.productId,
      minRole: 'viewer',
    })

    const { data: assetRow, error: assetError } = await access.supabase
      .from('assets')
      .select('id, product_id')
      .eq('id', assetId)
      .maybeSingle()
    if (assetError) {
      throw new Error(`Failed to load asset: ${assetError.message}`)
    }
    if (!assetRow || assetRow.product_id !== parsed.productId) {
      return jsonError('Asset not found for this product', 404)
    }

    const analyses = await listAssetAnalyses(access.supabase, {
      productId: parsed.productId,
      assetId,
      kind: parsed.kind,
    })
    return Response.json({ analyses })
  } catch (error) {
    return handleRouteError(error, 'Failed to load analyses', (err) => {
      const mapped = mapAnalyzeHttpError(err)
      if (!mapped) return null
      return jsonError(mapped.message, mapped.status)
    })
  }
}
