import { NextResponse } from 'next/server'
import { clearAccessGateCookieOptions } from '../../../lib/access-gate-cookie'
import { activeProductCookieHeader } from '../../../lib/active-product-cookie'
import { createProductAsOwner, listMembershipsForUser } from '../../../lib/product-onboarding'
import { AuthRequiredError, requireUser } from '../../../lib/require-user'
import { getStudioClients, handleRouteError, jsonError } from '../../../lib/studio-server'

/** List Products the signed-in user belongs to. */
export const GET = async () => {
  try {
    const user = await requireUser()
    const { supabase } = getStudioClients()
    const memberships = await listMembershipsForUser(supabase, user.id)
    return NextResponse.json({
      memberships: memberships.map((m) => ({
        productId: m.productId,
        role: m.role,
        product: m.product,
      })),
    })
  } catch (error) {
    return handleRouteError(error, 'Could not load Products.')
  }
}

/** Create a Product; creator becomes owner. */
export const POST = async (request: Request) => {
  try {
    const user = await requireUser()
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return jsonError('Send a JSON body with name (and optional slug).', 400)
    }

    const name =
      body &&
      typeof body === 'object' &&
      'name' in body &&
      typeof (body as { name: unknown }).name === 'string'
        ? (body as { name: string }).name
        : ''
    const slug =
      body &&
      typeof body === 'object' &&
      'slug' in body &&
      typeof (body as { slug: unknown }).slug === 'string'
        ? (body as { slug: string }).slug
        : undefined

    const { supabase } = getStudioClients()
    const product = await createProductAsOwner(supabase, {
      userId: user.id,
      name,
      slug,
    })

    const response = NextResponse.json({ product, role: 'owner' }, { status: 201 })
    const cookie = activeProductCookieHeader(product.id)
    response.cookies.set(cookie.name, cookie.value, cookie.options)
    // Membership just changed — drop the cached gate so middleware re-counts (#1171).
    const clearGate = clearAccessGateCookieOptions()
    response.cookies.set(clearGate.name, clearGate.value, clearGate.options)
    return response
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return jsonError(error.message, error.status)
    }
    const message = error instanceof Error ? error.message : 'Could not create Product.'
    const status = message.includes('already taken') ? 409 : 400
    return jsonError(message, status)
  }
}
