import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { User } from '@supabase/supabase-js'
import { AUTH_COOKIE_NAME } from './auth-cookie'
import { supabaseUrlForServer } from './supabase-url-for-server'

export class AuthRequiredError extends Error {
  readonly status = 401

  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'AuthRequiredError'
  }
}

/** Session user from Synawood auth cookies. Fail closed. */
export const requireUser = async (): Promise<User> => {
  const url = supabaseUrlForServer()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new AuthRequiredError('Auth is not configured')
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(url, anonKey, {
    cookieOptions: { name: AUTH_COOKIE_NAME },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (
        cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[],
      ) => {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options)
        }
      },
    },
  })

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new AuthRequiredError()
  }
  return user
}
