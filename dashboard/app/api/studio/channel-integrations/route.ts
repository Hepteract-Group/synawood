import {
  bindProductChannelIntegration,
  channelIntegrationsPayload,
  isChannelBindError,
  isMissingChannelIntegrationsSchema,
  listPostizIntegrations,
  listProductChannelIntegrations,
  postizAppUrlFromApiRoot,
  unbindProductChannelIntegration,
  type ProductChannelIntegration,
} from '@synawood/channels'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const appUrl = () => postizAppUrlFromApiRoot(process.env.POSTIZ_BASE_URL ?? '')

const toResponse = (
  payload: ReturnType<typeof channelIntegrationsPayload>,
  binding: ProductChannelIntegration | null,
) => Response.json({ ...payload, binding })

const schemaMissingResponse = (
  integrations: Awaited<ReturnType<typeof listPostizIntegrations>>,
  canEdit: boolean,
) =>
  Response.json(
    channelIntegrationsPayload({
      integrations,
      bindings: [],
      canEdit,
      schemaMissing: true,
      postizAppUrl: appUrl(),
    }),
  )

export const GET = async (request: Request) => {
  try {
    const productId = new URL(request.url).searchParams.get('productId')?.trim()
    if (!productId) return jsonError('productId is required', 400)
    const access = await requireStudioAccess({ productId, minRole: 'viewer' })
    const canEdit = access.membership.role !== 'viewer'
    const integrations = await listPostizIntegrations()
    try {
      const bindings = await listProductChannelIntegrations(access.supabase, productId)
      return Response.json(
        channelIntegrationsPayload({
          integrations,
          bindings,
          canEdit,
          postizAppUrl: appUrl(),
        }),
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list channel bindings'
      if (isMissingChannelIntegrationsSchema(message)) {
        return schemaMissingResponse(integrations, canEdit)
      }
      throw error
    }
  } catch (error) {
    return handleRouteError(error, 'Failed to list channel bindings')
  }
}

export const POST = async (request: Request) => {
  try {
    const body = (await request.json().catch(() => null)) as {
      productId?: string
      channel?: string
      postizIntegrationId?: string | null
    } | null
    const productId = body?.productId?.trim()
    const channel = body?.channel?.trim()
    if (!productId) return jsonError('productId is required', 400)
    if (!channel) return jsonError('channel is required', 400)
    const access = await requireStudioAccess({ productId, minRole: 'editor' })
    const postizIntegrationId = body?.postizIntegrationId?.trim() ?? ''
    const integrations = await listPostizIntegrations()
    try {
      const existing = await listProductChannelIntegrations(access.supabase, productId)
      if (!postizIntegrationId) {
        await unbindProductChannelIntegration({
          supabase: access.supabase,
          productId,
          channel,
        })
        const bindings = existing.filter((row) => row.channel !== channel)
        return toResponse(
          channelIntegrationsPayload({
            integrations,
            bindings,
            canEdit: true,
            postizAppUrl: appUrl(),
          }),
          null,
        )
      }
      const binding = await bindProductChannelIntegration({
        supabase: access.supabase,
        productId,
        channel,
        postizIntegrationId,
        integrations,
        bindings: existing,
      })
      const bindings = [...existing.filter((row) => row.channel !== binding.channel), binding]
      return toResponse(
        channelIntegrationsPayload({
          integrations,
          bindings,
          canEdit: true,
          postizAppUrl: appUrl(),
        }),
        binding,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to bind channel'
      if (isMissingChannelIntegrationsSchema(message)) {
        return schemaMissingResponse(integrations, true)
      }
      throw error
    }
  } catch (error) {
    return handleRouteError(error, 'Failed to bind channel', (err) => {
      if (isChannelBindError(err)) return jsonError(err.message, err.status)
      return null
    })
  }
}
