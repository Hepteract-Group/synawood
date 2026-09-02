import { NextResponse } from 'next/server'
import { clearAccessGateCookieOptions } from '../../../../lib/access-gate-cookie'
import { activeProductCookieHeader } from '../../../../lib/active-product-cookie'
import { acceptProductInvite, loadInviteByToken } from '../../../../lib/product-onboarding'
import { requireUser } from '../../../../lib/require-user'
import { getStudioClients, handleRouteError, jsonError } from '../../../../lib/studio-server'

type RouteContext = { params: Promise<{ token: string }> }

/** Public-ish preview: auth required so we do not leak invite emails broadly via scraping. */
export const GET = async (_request: Request, context: RouteContext) => {
  try {
    await requireUser()
    const { token } = await context.params
    const { supabase } = getStudioClients()
    const invite = await loadInviteByToken(supabase, token)
    if (!invite) {
      return jsonError('Invite not found. Ask an owner for a new link.', 404)
    }
    return NextResponse.json({
      productId: invite.productId,
      productName: invite.productName,
      email: invite.email,
      role: invite.role,
      functionalRole: invite.functionalRole,
      expiresAt: invite.expiresAt,
      acceptedAt: invite.acceptedAt,
    })
  } catch (error) {
    return handleRouteError(error, 'Could not load invite.')
  }
}

export const POST = async (_request: Request, context: RouteContext) => {
  try {
    const user = await requireUser()
    const { token } = await context.params
    if (!user.email) {
      return jsonError('Your account needs an email to accept an invite.', 400)
    }
    const { supabase } = getStudioClients()
    const result = await acceptProductInvite(supabase, {
      token,
      userId: user.id,
      email: user.email,
    })
    const response = NextResponse.json({ ok: true, ...result })
    const cookie = activeProductCookieHeader(result.productId)
    response.cookies.set(cookie.name, cookie.value, cookie.options)
    // Membership just changed — drop the cached gate so middleware re-counts (#1171).
    const clearGate = clearAccessGateCookieOptions()
    response.cookies.set(clearGate.name, clearGate.value, clearGate.options)
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not accept invite.'
    if (
      message.includes('Sign in as') ||
      message.includes('expired') ||
      message.includes('already accepted') ||
      message.includes('not found')
    ) {
      return jsonError(message, 400)
    }
    return handleRouteError(error, message)
  }
}
