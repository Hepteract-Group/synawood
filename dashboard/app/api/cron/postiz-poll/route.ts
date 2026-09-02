import { NextResponse } from 'next/server'
import { createServiceSupabase, readSupabaseEnv } from '@synawood/creative'
import {
  createPostizPublishAdapter,
  isPostizLiveConfigured,
  runPostizPollJob,
} from '@synawood/channels'
import { cronAuthorized } from '@/lib/cron-auth'
import { jsonError } from '@/lib/studio-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Vercel cron + local `curl` with CRON_SECRET (#805). Mock never used here. */
export const GET = async (request: Request) => {
  if (!cronAuthorized(request)) {
    return jsonError('Cron unauthorized.', 401)
  }
  if (!isPostizLiveConfigured()) {
    return NextResponse.json({ ok: true, skipped: 'postiz_not_configured', polled: 0 })
  }
  try {
    const supabase = createServiceSupabase(readSupabaseEnv(process.env))
    const adapter = createPostizPublishAdapter(process.env, {
      supabase,
      readBytes: async () => {
        throw new Error('Postiz poll does not read Blob.')
      },
    })
    const result = await runPostizPollJob({ supabase, adapter })
    return NextResponse.json({
      ok: true,
      polled: result.polled,
      failed: result.errors.length,
      statuses: result.results.map((row) => ({
        id: row.record.id,
        status: row.status,
        postedUrl: row.postedUrl,
      })),
    })
  } catch (error) {
    console.error('[postiz-poll]', error)
    return jsonError('Postiz poll failed.', 500)
  }
}

/** Vercel cron uses GET. POST is for local curl parity. */
export const POST = GET
