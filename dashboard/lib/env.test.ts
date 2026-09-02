import { describe, expect, it } from 'vitest'
import { readSupabaseEnv } from '@synawood/creative'

const Synawood = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  SUPABASE_PROJECT_REF: 'marketing-os-dev',
}

describe('readSupabaseEnv', () => {
  it('accepts a Synawood-shaped env', () => {
    const env = readSupabaseEnv(Synawood)
    expect(env.projectRef).toBe('marketing-os-dev')
    expect(env.url).toBe('https://example.supabase.co')
  })

  it('prefers SUPABASE_URL for server calls when both URLs are set (#1387)', () => {
    const env = readSupabaseEnv({
      ...Synawood,
      NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54341',
      SUPABASE_URL: 'http://host.docker.internal:54341',
    })
    expect(env.url).toBe('http://host.docker.internal:54341')
  })

  it('refuses a ref that does not match EXPECTED_SUPABASE_PROJECT_REF', () => {
    let message = ''
    try {
      readSupabaseEnv({
        ...Synawood,
        SUPABASE_PROJECT_REF: 'other-app',
        EXPECTED_SUPABASE_PROJECT_REF: 'marketing-os-dev',
      })
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toMatch(/does not match this environment/)
    expect(message).not.toMatch(/the private example/i)
  })
})
