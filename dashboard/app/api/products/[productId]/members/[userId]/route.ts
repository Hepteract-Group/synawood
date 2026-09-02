import { NextResponse } from 'next/server'
import { isFunctionalRole } from '../../../../../../lib/functional-roles'
import { updateMemberFunctionalRole } from '../../../../../../lib/product-onboarding'
import {
  handleRouteError,
  jsonError,
  requireStudioAccess,
} from '../../../../../../lib/studio-server'

type RouteContext = { params: Promise<{ productId: string; userId: string }> }

/** Owner changes a member's job function (ADR-0037). Tenancy role is unchanged. */
export const PATCH = async (request: Request, context: RouteContext) => {
  try {
    const { productId, userId } = await context.params
    const access = await requireStudioAccess({ productId, minRole: 'owner' })

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return jsonError('Send JSON with functionalRole.', 400)
    }

    const functionalRole =
      body &&
      typeof body === 'object' &&
      'functionalRole' in body &&
      typeof (body as { functionalRole: unknown }).functionalRole === 'string'
        ? (body as { functionalRole: string }).functionalRole
        : ''

    if (!isFunctionalRole(functionalRole)) {
      return jsonError(
        'Job function must be founder, editor, reviewer, publisher, or analyst.',
        400,
      )
    }

    const member = await updateMemberFunctionalRole(access.supabase, {
      productId,
      userId,
      functionalRole,
      actorUserId: access.userId,
    })

    return NextResponse.json({ member })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not update job function.'
    if (message.includes('founder') || message.includes('not found')) {
      return jsonError(message, 400)
    }
    return handleRouteError(error, 'Could not update job function.')
  }
}
