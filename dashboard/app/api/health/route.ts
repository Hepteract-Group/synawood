import { createClient } from '@supabase/supabase-js'
import { supabaseUrlForServer } from '../../../lib/supabase-url-for-server'

/**
 * Public liveness + DB reachability for post-deploy smoke.
 * No auth required — used by scripts/smoke.ts against SMOKE_BASE_URL.
 */
export const GET = async () => {
  const checks: Record<string, 'ok' | 'missing_env' | 'error'> = { app: 'ok' }
  const url = supabaseUrlForServer()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    checks.db = 'missing_env'
    return Response.json({ ok: false, checks }, { status: 503 })
  }

  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error } = await supabase.from('studio_projects').select('id').limit(1)
    if (error) {
      checks.db = 'error'
      return Response.json({ ok: false, checks, error: error.message }, { status: 503 })
    }
    checks.db = 'ok'
    return Response.json({ ok: true, checks })
  } catch (error) {
    checks.db = 'error'
    return Response.json(
      {
        ok: false,
        checks,
        error: error instanceof Error ? error.message : 'Health check failed',
      },
      { status: 503 },
    )
  }
}
