import {
  ingestPostizWebhook,
  POSTIZ_WEBHOOK_BAD_SECRET_COPY,
  POSTIZ_WEBHOOK_NOT_CONFIGURED_COPY,
  POSTIZ_WEBHOOK_SECRET_HEADER,
} from '@synawood/channels/postiz-webhook'
import { createServiceSupabase, readSupabaseEnv } from '@synawood/creative'
import { jsonError } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Optional Postiz → Synawood posted/failed. Poll remains recovery if this is off. */
export const POST = async (request: Request) => {
  const rawBody = await request.text()
  try {
    const supabase = createServiceSupabase(readSupabaseEnv(process.env))
    const result = await ingestPostizWebhook({
      supabase,
      header: request.headers.get(POSTIZ_WEBHOOK_SECRET_HEADER),
      rawBody,
    })
    // Single-row persist is the ack. Do not call Postiz from this route.
    return Response.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Postiz webhook failed.'
    if (message === POSTIZ_WEBHOOK_NOT_CONFIGURED_COPY) {
      return jsonError(message, 503)
    }
    if (message === POSTIZ_WEBHOOK_BAD_SECRET_COPY) {
      return jsonError(message, 401)
    }
    return jsonError(message, 400)
  }
}
