import { NextResponse } from 'next/server'
import { z } from 'zod'
import { API_KEY_OWNER_ONLY_COPY, HOSTED_WEBHOOK_LOCALHOST_COPY } from '@/lib/api-console-copy'
import { createProductWebhook, listProductWebhooks } from '@/lib/product-webhooks'
import { ProductAccessError } from '@/lib/product-membership'
import { WEBHOOK_EVENTS } from '@/lib/public-api-schema'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'
import { isHostedRuntime } from '@synawood/creative/mcp/inbound'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const createSchema = z
  .object({
    url: z.string().min(8).max(2048),
    events: z.array(z.enum(WEBHOOK_EVENTS)).optional(),
  })
  .strict()

type RouteContext = { params: Promise<{ productId: string }> }

export const GET = async (_request: Request, context: RouteContext) => {
  try {
    const { productId } = await context.params
    const access = await requireStudioAccess({ productId, minRole: 'viewer' })
    const webhooks = await listProductWebhooks(access.supabase, productId)
    return NextResponse.json({
      webhooks,
      canManage: access.membership.role === 'owner',
      hosted: isHostedRuntime(),
    })
  } catch (error) {
    return handleRouteError(error, 'Could not load webhooks.')
  }
}

export const POST = async (request: Request, context: RouteContext) => {
  try {
    const { productId } = await context.params
    const access = await requireStudioAccess({ productId, minRole: 'viewer' })
    if (access.membership.role !== 'owner') {
      throw new ProductAccessError(API_KEY_OWNER_ONLY_COPY, 403)
    }
    const body = createSchema.parse(await request.json())
    const created = await createProductWebhook({
      supabase: access.supabase,
      productId,
      url: body.url,
      events: body.events,
      hosted: isHostedRuntime(),
    })
    return NextResponse.json(created)
  } catch (error) {
    return handleRouteError(error, 'Could not create webhook.', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      if (err instanceof Error && err.message === HOSTED_WEBHOOK_LOCALHOST_COPY) {
        return jsonError(err.message, 400)
      }
      if (
        err instanceof Error &&
        (err.message.startsWith('Webhook URL') || err.message.startsWith('Enter a valid'))
      ) {
        return jsonError(err.message, 400)
      }
      return null
    })
  }
}
