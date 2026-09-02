import {
  createManualPublishAdapter,
  latestFinalForProject,
  listPublishRecords,
  listPublishRecordsForFinal,
  publishChannelSchema,
} from '@synawood/channels'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { z } from 'zod'

const scheduleSchema = z.object({
  productId: z.string().min(1),
  finalAssetId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  channel: publishChannelSchema,
  caption: z.string().max(5000).optional(),
  contentSlotId: z.string().uuid().nullable().optional(),
})

export const GET = async (request: Request) => {
  try {
    const url = new URL(request.url)
    const productId = url.searchParams.get('productId')
    const finalAssetId = url.searchParams.get('finalAssetId')
    const projectId = url.searchParams.get('projectId')
    if (!productId && !finalAssetId && !projectId) {
      return jsonError('productId, finalAssetId, or projectId is required', 400)
    }
    const access = await requireStudioAccess({
      productId: productId ?? undefined,
      projectId: projectId ?? undefined,
      finalAssetId: finalAssetId ?? undefined,
      minRole: 'viewer',
    })
    const { supabase } = access

    if (finalAssetId) {
      const records = await listPublishRecordsForFinal(supabase, finalAssetId)
      return Response.json({ records })
    }
    if (projectId) {
      const final = await latestFinalForProject(supabase, projectId)
      if (!final) {
        return Response.json({ final: null, records: [] })
      }
      const records = await listPublishRecordsForFinal(supabase, final.id)
      return Response.json({ final, records })
    }
    const records = await listPublishRecords(supabase, productId!)
    return Response.json({ records })
  } catch (error) {
    return handleRouteError(error, 'Failed to list publish records')
  }
}

export const POST = async (request: Request) => {
  try {
    const body = scheduleSchema.parse(await request.json())
    const access = await requireStudioAccess({
      productId: body.productId,
      projectId: body.projectId,
      minRole: 'editor',
    })
    const { supabase } = access

    let finalAssetId = body.finalAssetId
    if (!finalAssetId) {
      if (!body.projectId) {
        return jsonError('finalAssetId or projectId is required', 400)
      }
      const final = await latestFinalForProject(supabase, body.projectId)
      if (!final) {
        return jsonError('No Final asset for this project. Approve a candidate first.', 400)
      }
      finalAssetId = final.id
    }

    const adapter = createManualPublishAdapter(supabase)
    const result = await adapter.schedule({
      productId: body.productId,
      finalAssetId,
      channel: body.channel,
      caption: body.caption,
      contentSlotId: body.contentSlotId,
    })
    return Response.json(result)
  } catch (error) {
    return handleRouteError(error, 'Failed to prepare publish', (error) => {
      if (error instanceof z.ZodError) {
        return jsonError(error.issues.map((issue) => issue.message).join('; '), 400)
      }
      return null
    })
  }
}
