import {
  buildMonthBoard,
  buildProductBoard,
  buildWeekBoard,
  repoRootFromCwd,
} from '@/lib/content-week-board'
import { isIsoWeekId, isoWeekIdFromDate } from '@/lib/content-week-board-shared'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const GET = async (request: Request) => {
  try {
    const url = new URL(request.url)
    const productId = url.searchParams.get('productId')?.trim()
    if (!productId) {
      return jsonError('productId is required', 400)
    }
    const requestedWeek = url.searchParams.get('weekId')
    const month = url.searchParams.get('month')
    const scope = url.searchParams.get('scope')
    const access = await requireStudioAccess({ productId, minRole: 'viewer' })
    const { supabase } = access
    const repoRoot = repoRootFromCwd()

    if (scope === 'board') {
      const productBoard = await buildProductBoard({ supabase, productId, repoRoot })
      return Response.json({
        productId,
        board: null,
        monthBoard: null,
        productBoard,
      })
    }

    if (month) {
      const board = await buildMonthBoard({ supabase, productId, month, repoRoot })
      return Response.json({
        productId,
        month,
        board: null,
        monthBoard: board,
        productBoard: null,
      })
    }

    const weekId =
      requestedWeek && isIsoWeekId(requestedWeek) ? requestedWeek : isoWeekIdFromDate(new Date())
    const board = await buildWeekBoard({ supabase, productId, weekId, repoRoot })
    return Response.json({ productId, board, monthBoard: null, productBoard: null })
  } catch (error) {
    return handleRouteError(error, 'Failed to load week board')
  }
}
