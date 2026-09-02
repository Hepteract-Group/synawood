import { isHostedRuntime, refreshInboundMcpTools } from '@synawood/creative/mcp/inbound'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ serverId: string }> }

export const POST = async (request: Request, { params }: Params) => {
  try {
    const body = (await request.json().catch(() => null)) as { productId?: string } | null
    const productId =
      body?.productId?.trim() || new URL(request.url).searchParams.get('productId')?.trim()
    const { serverId } = await params
    if (!productId) return jsonError('productId is required', 400)
    if (!serverId) return jsonError('serverId is required', 400)
    const access = await requireStudioAccess({ productId, minRole: 'editor' })
    const result = await refreshInboundMcpTools({
      supabase: access.supabase,
      productId,
      serverId,
      hosted: isHostedRuntime(),
    })
    return Response.json(result)
  } catch (error) {
    return handleRouteError(error, 'Failed to refresh MCP tools')
  }
}
