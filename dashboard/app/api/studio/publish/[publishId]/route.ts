import {
  createManualPublishAdapter,
  createPostizPublishAdapter,
  isPostizLiveConfigured,
  POSTED_CANCEL_COPY,
  recordManualPosted,
} from '@synawood/channels'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { z } from 'zod'

const bodySchema = z.object({
  postedUrl: z.string().min(1),
})

const publishAdapter = (supabase: Parameters<typeof createManualPublishAdapter>[0]) =>
  isPostizLiveConfigured()
    ? createPostizPublishAdapter(process.env, {
        supabase,
        readBytes: async () => {
          throw new Error('This publish action does not read Blob.')
        },
      })
    : createManualPublishAdapter(supabase)

export const GET = async (
  _request: Request,
  context: { params: Promise<{ publishId: string }> },
) => {
  try {
    const { publishId } = await context.params
    const access = await requireStudioAccess({ publishId, minRole: 'viewer' })
    const result = await publishAdapter(access.supabase).getStatus(publishId)
    return Response.json(result)
  } catch (error) {
    return handleRouteError(error, 'Failed to load post status')
  }
}

export const PATCH = async (
  request: Request,
  context: { params: Promise<{ publishId: string }> },
) => {
  try {
    const { publishId } = await context.params
    const body = bodySchema.parse(await request.json())
    const access = await requireStudioAccess({ publishId, minRole: 'editor' })
    const { supabase } = access
    const record = await recordManualPosted(supabase, {
      publishRecordId: publishId,
      postedUrl: body.postedUrl,
    })
    return Response.json({ record })
  } catch (error) {
    return handleRouteError(error, 'Failed to record posted URL', (error) => {
      if (error instanceof z.ZodError) {
        return jsonError(error.issues.map((issue) => issue.message).join('; '), 400)
      }
      return null
    })
  }
}

export const DELETE = async (
  _request: Request,
  context: { params: Promise<{ publishId: string }> },
) => {
  try {
    const { publishId } = await context.params
    const access = await requireStudioAccess({ publishId, minRole: 'editor' })
    const { supabase } = access
    const adapter = publishAdapter(supabase)
    const result = await adapter.cancel(publishId)
    return Response.json(result)
  } catch (error) {
    return handleRouteError(error, 'Failed to cancel post', (error) => {
      if (error instanceof Error && error.message === POSTED_CANCEL_COPY) {
        return jsonError(error.message, 409)
      }
      return null
    })
  }
}
