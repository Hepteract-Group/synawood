import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { applyAuthCookies, authCookieOptions } from './lib/auth-browser-cookie'
import { isOnboardingExemptPath, isProtectedPath, unauthenticatedLoginNext } from './lib/auth-paths'
import { isProfileExemptPath, isUserProfileComplete } from './lib/user-profile'
import {
  ACCESS_GATE_COOKIE,
  ACCESS_GATE_TTL_MS,
  sealAccessGate,
  unsealAccessGate,
} from './lib/access-gate-cookie'
import { decideProtectedNavigation, resolveAppAccess } from './lib/product-access-gate'
import { createMiddlewareServiceSupabase } from './lib/service-supabase-edge'
import { supabaseUrlForServer } from './lib/supabase-url-for-server'

const isApiPath = (pathname: string): boolean => pathname.startsWith('/api/')

const denyUnauthenticated = (request: NextRequest, pathname: string): NextResponse => {
  if (isApiPath(pathname)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const login = request.nextUrl.clone()
  login.pathname = '/login'
  login.searchParams.set('next', unauthenticatedLoginNext(pathname))
  return NextResponse.redirect(login)
}

const denyNotAllowlisted = (request: NextRequest, pathname: string): NextResponse => {
  if (isApiPath(pathname)) {
    return NextResponse.json(
      { error: 'Access is invite-only. Join the waitlist or ask an owner.' },
      { status: 403 },
    )
  }
  const denied = request.nextUrl.clone()
  denied.pathname = '/access-denied'
  denied.search = ''
  return NextResponse.redirect(denied)
}

const redirectToOnboarding = (request: NextRequest): NextResponse => {
  if (isApiPath(request.nextUrl.pathname)) {
    return NextResponse.json(
      { error: 'Create or join a Product first.', code: 'needs_onboarding' },
      { status: 403 },
    )
  }
  const onboarding = request.nextUrl.clone()
  onboarding.pathname = '/onboarding/organization'
  onboarding.search = ''
  return NextResponse.redirect(onboarding)
}

const redirectToProfile = (request: NextRequest): NextResponse => {
  if (isApiPath(request.nextUrl.pathname)) {
    return NextResponse.json(
      { error: 'Finish or skip About you first.', code: 'needs_profile' },
      { status: 403 },
    )
  }
  const profile = request.nextUrl.clone()
  profile.pathname = '/onboarding/profile'
  profile.search = ''
  return NextResponse.redirect(profile)
}

export const middleware = async (request: NextRequest) => {
  const { pathname, searchParams } = request.nextUrl

  const oauthCode = searchParams.get('code')
  if (oauthCode && pathname !== '/auth/callback') {
    const callback = request.nextUrl.clone()
    callback.pathname = '/auth/callback'
    return NextResponse.redirect(callback)
  }

  if (!isProtectedPath(pathname)) {
    return NextResponse.next()
  }

  const url = supabaseUrlForServer()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    if (isApiPath(pathname)) {
      return NextResponse.json({ error: 'Auth is not configured' }, { status: 503 })
    }
    const login = request.nextUrl.clone()
    login.pathname = '/login'
    return NextResponse.redirect(login)
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(url, anonKey, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (
        cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[],
      ) => {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request: { headers: request.headers } })
        applyAuthCookies(response, cookiesToSet)
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return denyUnauthenticated(request, pathname)
  }

  let service
  try {
    service = createMiddlewareServiceSupabase()
  } catch {
    if (isApiPath(pathname)) {
      return NextResponse.json({ error: 'Auth is not configured' }, { status: 503 })
    }
    const login = request.nextUrl.clone()
    login.pathname = '/login'
    return NextResponse.redirect(login)
  }

  const gateSecret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  const cached =
    gateSecret && request.cookies.get(ACCESS_GATE_COOKIE)?.value
      ? await unsealAccessGate(request.cookies.get(ACCESS_GATE_COOKIE)!.value, {
          userId: user.id,
          secret: gateSecret,
        })
      : null

  let access = cached ? { allowed: cached.allowed, membershipCount: cached.membershipCount } : null
  if (!access) {
    try {
      access = await resolveAppAccess(service, {
        userId: user.id,
        email: user.email,
      })
    } catch {
      return NextResponse.json({ error: 'Could not verify access.' }, { status: 503 })
    }
  }

  const profileExempt = isProfileExemptPath(pathname)
  let profileComplete = cached?.profileComplete === true
  if (!profileComplete && !profileExempt) {
    try {
      profileComplete = await isUserProfileComplete(service, user.id)
    } catch {
      return NextResponse.json({ error: 'Could not verify access.' }, { status: 503 })
    }
  }

  const decision = decideProtectedNavigation({
    allowed: access.allowed,
    membershipCount: access.membershipCount,
    onboardingExempt: isOnboardingExemptPath(pathname),
    profileComplete,
    profileExempt,
  })
  if (decision === 'deny') {
    await supabase.auth.signOut()
    return denyNotAllowlisted(request, pathname)
  }
  if (decision === 'profile') {
    return redirectToProfile(request)
  }
  if (decision === 'onboarding') {
    return redirectToOnboarding(request)
  }

  if (gateSecret && (!cached || (profileComplete && cached.profileComplete !== true))) {
    const token = await sealAccessGate({
      userId: user.id,
      membershipCount: access.membershipCount,
      allowed: access.allowed,
      secret: gateSecret,
      profileComplete,
    })
    response.cookies.set(ACCESS_GATE_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor(ACCESS_GATE_TTL_MS / 1000),
      secure: process.env.NODE_ENV === 'production',
    })
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
