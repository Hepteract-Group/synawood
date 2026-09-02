import {
  isHostedRuntime,
  isMissingMcpSchema,
  listInboundMcpServers,
  parseInboundMcpTransport,
  registerInboundMcpServer,
} from '@synawood/creative/mcp/inbound'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = async (request: Request) => {
  try {
    const productId = new URL(request.url).searchParams.get('productId')?.trim()
    if (!productId) return jsonError('productId is required', 400)
    const access = await requireStudioAccess({ productId, minRole: 'viewer' })
    const hosted = isHostedRuntime()
    try {
      const servers = await listInboundMcpServers(access.supabase, productId)
      return Response.json({
        servers,
        hosted,
        localTransportsAllowed: !hosted,
        canEdit: access.membership.role !== 'viewer',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list MCP servers'
      if (isMissingMcpSchema(message)) {
        return Response.json({
          servers: [],
          hosted,
          localTransportsAllowed: !hosted,
          canEdit: access.membership.role !== 'viewer',
          schemaMissing: true,
        })
      }
      throw error
    }
  } catch (error) {
    return handleRouteError(error, 'Failed to list MCP servers')
  }
}

export const POST = async (request: Request) => {
  try {
    const body = (await request.json().catch(() => null)) as {
      productId?: string
      displayName?: string
      transport?: unknown
      endpoint?: string
      authToken?: string
    } | null
    const productId = body?.productId?.trim()
    const displayName = body?.displayName?.trim()
    const endpoint = body?.endpoint?.trim()
    if (!productId) return jsonError('productId is required', 400)
    if (!displayName) return jsonError('Display name is required', 400)
    if (!endpoint) return jsonError('Endpoint is required', 400)
    const access = await requireStudioAccess({ productId, minRole: 'editor' })
    const server = await registerInboundMcpServer({
      supabase: access.supabase,
      productId,
      displayName,
      transport: parseInboundMcpTransport(body?.transport ?? 'https'),
      endpoint,
      authToken: body?.authToken,
      hosted: isHostedRuntime(),
    })
    return Response.json({ server })
  } catch (error) {
    return handleRouteError(error, 'Failed to register MCP server')
  }
}
