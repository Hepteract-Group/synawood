import { getBlobBytes } from '@synawood/creative'
import {
  createPostizPublishAdapter,
  isPostizLiveConfigured,
  latestFinalForProject,
  publishChannelSchema,
} from '@synawood/channels'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { POSTIZ_NOT_CONFIGURED_TITLE } from '@/lib/schedule-publish-copy'
import { z } from 'zod'

const bodySchema = z.object({
  productId: z.string().min(1),
  finalAssetId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  channel: publishChannelSchema,
  caption: z.string().max(5000).optional(),
  contentSlotId: z.string().uuid().nullable().optional(),
  scheduledAt: z.string().min(1).optional(),
})

/**
 * Live Postiz schedule / post-now. Mock is never used here.
 * Prepare-for-paste stays on POST /api/studio/publish (manual adapter).
 */
export const POST = async (request: Request) => {
  try {
    if (!isPostizLiveConfigured()) {
      return jsonError(POSTIZ_NOT_CONFIGURED_TITLE, 503)
    }
    const body = bodySchema.parse(await request.json())
    const access = await requireStudioAccess({
      productId: body.productId,
      projectId: body.projectId,
      minRole: 'editor',
    })
    const { supabase, blobEnv } = access

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

    let scheduledAt: Date | undefined
    if (body.scheduledAt) {
      scheduledAt = new Date(body.scheduledAt)
      if (Number.isNaN(scheduledAt.getTime())) {
        return jsonError('scheduledAt must be a valid time.', 400)
      }
    }

    const adapter = createPostizPublishAdapter(process.env, {
      supabase,
      readBytes: (blobKey) => getBlobBytes({ blobEnv, blobKey }),
    })
    const result = await adapter.schedule({
      productId: body.productId,
      finalAssetId,
      channel: body.channel,
      caption: body.caption,
      contentSlotId: body.contentSlotId,
      scheduledAt,
    })
    return Response.json(result)
  } catch (error) {
    return handleRouteError(error, 'Failed to schedule post', (error) => {
      if (error instanceof z.ZodError) {
        return jsonError(error.issues.map((issue) => issue.message).join('; '), 400)
      }
      return null
    })
  }
}
