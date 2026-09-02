import { createServiceSupabase, readSupabaseEnv } from '@synawood/creative'
import { NextResponse } from 'next/server'
import { getAuthAccessMode } from '../../../../lib/auth-access-mode'
import { ALLOWLIST_DENIED_MESSAGE, isEmailAllowlisted } from '../../../../lib/auth-allowlist'
import { hasPendingInviteForEmail } from '../../../../lib/product-onboarding'
import { jsonError } from '../../../../lib/studio-server'

/** Pre-check for login/signup UI (allowlist, invite, or open SaaS). */
export const POST = async (request: Request) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Send a JSON body with an email.', 400)
  }

  const email =
    body &&
    typeof body === 'object' &&
    'email' in body &&
    typeof (body as { email: unknown }).email === 'string'
      ? (body as { email: string }).email.trim()
      : ''

  if (!email) {
    return jsonError('Enter an email address.', 400)
  }

  if (getAuthAccessMode() === 'saas') {
    return NextResponse.json({ allowed: true, via: 'saas' })
  }

  if (isEmailAllowlisted(email, process.env)) {
    return NextResponse.json({ allowed: true })
  }

  if (getAuthAccessMode() === 'allowlist') {
    return NextResponse.json({ allowed: false, error: ALLOWLIST_DENIED_MESSAGE }, { status: 403 })
  }

  try {
    const supabase = createServiceSupabase(readSupabaseEnv(process.env))
    const invited = await hasPendingInviteForEmail(supabase, email)
    if (invited) {
      return NextResponse.json({ allowed: true, via: 'invite' })
    }
  } catch {
    // Fall through to deny if invite lookup is unavailable.
  }

  return NextResponse.json({ allowed: false, error: ALLOWLIST_DENIED_MESSAGE }, { status: 403 })
}
