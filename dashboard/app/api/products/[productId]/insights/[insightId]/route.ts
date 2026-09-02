import { NextResponse } from 'next/server'
import { z } from 'zod'
import { applyInsight, dismissInsight, snoozeInsight } from '@synawood/creative/learning'
import { insightActionSchema } from '@synawood/creative/learning/schema'
import { handleRouteError, jsonError, requireStudioAccess } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const POST = async (
  request: Request,
  context: { params: Promise<{ productId: string; insightId: string }> },
) => {
  try {
    const { productId, insightId } = await context.params
    const access = await requireStudioAccess({ productId, minRole: 'editor' })
    const body = insightActionSchema.parse(await request.json())
    if (body.action === 'apply') {
      const result = await applyInsight(access.supabase, { productId, insightId })
      return NextResponse.json(result)
    }
    if (body.action === 'dismiss') {
      await dismissInsight(access.supabase, { productId, insightId })
      return NextResponse.json({ ok: true })
    }
    await snoozeInsight(access.supabase, {
      productId,
      insightId,
      snoozeDays: body.snoozeDays,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleRouteError(error, 'Could not update insight.', (err) => {
      if (err instanceof z.ZodError) {
        return jsonError(err.issues.map((issue) => issue.message).join('; '), 400)
      }
      return null
    })
  }
}
