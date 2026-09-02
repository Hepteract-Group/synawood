import { describe, expect, it } from 'vitest'
import { supabaseUrlForServer } from './supabase-url-for-server'

describe('supabaseUrlForServer (#1387)', () => {
  it('prefers SUPABASE_URL when the browser URL is localhost', () => {
    expect(
      supabaseUrlForServer({
        NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54341',
        SUPABASE_URL: 'http://host.docker.internal:54341',
      }),
    ).toBe('http://host.docker.internal:54341')
  })

  it('falls back to NEXT_PUBLIC_SUPABASE_URL when that is the only URL (hosted)', () => {
    expect(
      supabaseUrlForServer({
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      }),
    ).toBe('https://example.supabase.co')
  })
})
