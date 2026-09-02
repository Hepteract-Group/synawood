import {
  loadMcpCatalogRowsForProduct,
  removeMcpCatalogTool,
  setMcpToolEnabled,
} from '@synawood/creative/mcp/inbound'
import {
  buildFirstPartyToolCatalog,
  sanitizeDisabledOptionalTools,
} from '@synawood/creative/tools/first-party-catalog'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const loadDisabledOptional = async (
  supabase: Awaited<ReturnType<typeof requireStudioAccess>>['supabase'],
  productId: string,
): Promise<string[]> => {
  const { data, error } = await supabase
    .from('products')
    .select('disabled_optional_tools')
    .eq('id', productId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return sanitizeDisabledOptionalTools(
    Array.isArray(data?.disabled_optional_tools) ? data.disabled_optional_tools : [],
  )
}

export const GET = async (request: Request) => {
  try {
    const productId = new URL(request.url).searchParams.get('productId')?.trim()
    if (!productId) return jsonError('productId is required', 400)
    const access = await requireStudioAccess({ productId, minRole: 'viewer' })
    const disabledOptional = await loadDisabledOptional(access.supabase, productId)
    const mcpRows = await loadMcpCatalogRowsForProduct(access.supabase, productId)
    return Response.json({
      disabledOptional,
      canEdit: access.membership.role !== 'viewer',
      catalog: buildFirstPartyToolCatalog({ disabledOptional, mcpRows }),
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to load agent tools')
  }
}

export const PATCH = async (request: Request) => {
  try {
    const body = (await request.json().catch(() => null)) as {
      productId?: string
      disabledOptional?: unknown
      mcpTool?: { catalogId?: unknown; enabled?: unknown }
      mcpToolRemove?: { catalogId?: unknown }
    } | null
    const productId = body?.productId?.trim()
    if (!productId) return jsonError('productId is required', 400)

    const hasDisabledPatch = body?.disabledOptional !== undefined
    const hasMcpPatch = body?.mcpTool !== undefined && body.mcpTool !== null
    const hasMcpRemove = body?.mcpToolRemove !== undefined && body.mcpToolRemove !== null
    if (!hasDisabledPatch && !hasMcpPatch && !hasMcpRemove) {
      return jsonError('Send disabledOptional, mcpTool, and/or mcpToolRemove', 400)
    }

    const access = await requireStudioAccess({ productId, minRole: 'editor' })
    let disabledOptional = await loadDisabledOptional(access.supabase, productId)

    if (hasDisabledPatch) {
      if (!Array.isArray(body?.disabledOptional)) {
        return jsonError('disabledOptional must be an array of tool names', 400)
      }
      disabledOptional = sanitizeDisabledOptionalTools(
        body.disabledOptional.filter((name): name is string => typeof name === 'string'),
      )
      const { error } = await access.supabase
        .from('products')
        .update({ disabled_optional_tools: disabledOptional })
        .eq('id', productId)
      if (error) throw new Error(error.message)
    }

    if (hasMcpPatch) {
      const catalogId =
        typeof body?.mcpTool?.catalogId === 'string' ? body.mcpTool.catalogId.trim() : ''
      if (!catalogId) return jsonError('mcpTool.catalogId is required', 400)
      if (typeof body?.mcpTool?.enabled !== 'boolean') {
        return jsonError('mcpTool.enabled must be a boolean', 400)
      }
      await setMcpToolEnabled({
        supabase: access.supabase,
        productId,
        catalogId,
        enabled: body.mcpTool.enabled,
      })
    }

    if (hasMcpRemove) {
      const catalogId =
        typeof body?.mcpToolRemove?.catalogId === 'string'
          ? body.mcpToolRemove.catalogId.trim()
          : ''
      if (!catalogId) return jsonError('mcpToolRemove.catalogId is required', 400)
      await removeMcpCatalogTool({
        supabase: access.supabase,
        productId,
        catalogId,
      })
    }

    const mcpRows = await loadMcpCatalogRowsForProduct(access.supabase, productId)
    return Response.json({
      disabledOptional,
      canEdit: true,
      catalog: buildFirstPartyToolCatalog({ disabledOptional, mcpRows }),
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to save agent tools')
  }
}
