import { NextResponse } from 'next/server'
import { listAuditEvents } from '../../../../../lib/audit'
import { handleRouteError, requireStudioAccess } from '../../../../../lib/studio-server'

type RouteContext = { params: Promise<{ productId: string }> }

/** Members can read this Product’s audit log (ADR-0037). */
export const GET = async (request: Request, context: RouteContext) => {
  try {
    const { productId } = await context.params
    const access = await requireStudioAccess({ productId, minRole: 'viewer' })
    const url = new URL(request.url)
    const rawLimit = Number(url.searchParams.get('limit') ?? '50')
    const events = await listAuditEvents(access.supabase, {
      productId,
      limit: Number.isFinite(rawLimit) ? rawLimit : 50,
    })
    return NextResponse.json({ events })
  } catch (error) {
    return handleRouteError(error, 'Could not load the audit log.')
  }
}
