import { disconnectInboundMcpServer } from '@synawood/creative/mcp/inbound'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ serverId: string }> }

export const DELETE = async (request: Request, { params }: Params) => {
  try {
    const productId = new URL(request.url).searchParams.get('productId')?.trim()
    const { serverId } = await params
    if (!productId) return jsonError('productId is required', 400)
    if (!serverId) return jsonError('serverId is required', 400)
    const access = await requireStudioAccess({ productId, minRole: 'editor' })
    await disconnectInboundMcpServer(access.supabase, { productId, serverId })
    return Response.json({ ok: true })
  } catch (error) {
    return handleRouteError(error, 'Failed to disconnect MCP server')
  }
}
