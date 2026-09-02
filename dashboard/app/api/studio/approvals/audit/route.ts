import { listApprovalAuditRows, approvalAuditToCsv } from '@synawood/creative/governance'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const GET = async (request: Request) => {
  try {
    const productId = new URL(request.url).searchParams.get('productId')
    if (!productId) return jsonError('productId is required', 400)
    const access = await requireStudioAccess({ productId, minRole: 'owner' })
    const rows = await listApprovalAuditRows(access.supabase, { productId })
    const csv = approvalAuditToCsv(rows)
    const stamp = new Date().toISOString().slice(0, 10)
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="approval-audit-${productId}-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return handleRouteError(error, 'Failed to export approval audit')
  }
}
