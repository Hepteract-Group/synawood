import { NextResponse } from 'next/server'
import { createServiceSupabase, readSupabaseEnv } from '@synawood/creative'
import { runPerformancePullJob } from '@synawood/creative/performance'
import { jsonError } from '@/lib/studio-server'
import { cronAuthorized } from '@/lib/cron-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Vercel cron + local `curl` with CRON_SECRET (#245). Adapters stay stub. */
export const GET = async (request: Request) => {
  if (!cronAuthorized(request)) {
    return jsonError('Cron unauthorized.', 401)
  }
  try {
    const supabase = createServiceSupabase(readSupabaseEnv(process.env))
    const productId = new URL(request.url).searchParams.get('productId')?.trim() || undefined
    const result = await runPerformancePullJob({ supabase, productId })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Performance pull failed.', 500)
  }
}

/** Vercel cron uses GET. POST is for local curl parity. */
export const POST = GET
