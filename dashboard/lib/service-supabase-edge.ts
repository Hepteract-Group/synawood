import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseUrlForServer } from './supabase-url-for-server'

/**
 * Service-role client for Edge middleware.
 * Do not import `@synawood/creative` here — its barrel pulls Azure Blob browser code
 * that crashes Edge (`document is not defined`).
 */
export const createMiddlewareServiceSupabase = (): SupabaseClient => {
  const url = supabaseUrlForServer()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const projectRef = process.env.SUPABASE_PROJECT_REF
  if (!url || !serviceRoleKey || !projectRef) {
    throw new Error('Supabase service env incomplete for middleware')
  }
  const expected = process.env.EXPECTED_SUPABASE_PROJECT_REF?.trim()
  if (expected && expected !== projectRef) {
    throw new Error('Supabase project ref does not match this environment')
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
