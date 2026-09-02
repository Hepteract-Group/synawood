import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { assertExpectedSupabaseProjectRef } from './supabase-project-ref'

export type SupabaseEnv = {
  url: string
  serviceRoleKey: string
  anonKey: string
  projectRef: string
}

export type EnvMap = Record<string, string | undefined>

export const readSupabaseEnv = (env: EnvMap = process.env): SupabaseEnv => {
  const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.SUPABASE_ANON_KEY
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
  const projectRef = env.SUPABASE_PROJECT_REF
  if (!url || !anonKey || !serviceRoleKey || !projectRef) {
    throw new Error(
      'Supabase env incomplete: need URL, anon key, service role key, and SUPABASE_PROJECT_REF',
    )
  }
  assertExpectedSupabaseProjectRef(projectRef, env)
  return { url, anonKey, serviceRoleKey, projectRef }
}

export const createServiceSupabase = (supabaseEnv: SupabaseEnv): SupabaseClient =>
  createClient(supabaseEnv.url, supabaseEnv.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
