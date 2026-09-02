import { NextResponse } from 'next/server'
import { loadHostedSpendContext } from '@synawood/creative/billing/load-hosted-spend-context'
import {
  effectiveSeatLimit,
  inviteWithinSeatLimit,
  occupiedSeats,
  seatCapRejectCopy,
} from '@synawood/creative/billing/seat-cap'
import {
  createProductInvite,
  isInviteFunctionalRole,
  listInvitesForProduct,
  listMembersForProduct,
} from '../../../../../lib/product-onboarding'
import { handleRouteError, jsonError, requireStudioAccess } from '../../../../../lib/studio-server'

type RouteContext = { params: Promise<{ productId: string }> }

/** Owner invites editor or viewer by email. */
export const POST = async (request: Request, context: RouteContext) => {
  try {
    const { productId } = await context.params
    const access = await requireStudioAccess({ productId, minRole: 'owner' })

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return jsonError('Send JSON with email and role (editor|viewer).', 400)
    }

    const email =
      body &&
      typeof body === 'object' &&
      'email' in body &&
      typeof (body as { email: unknown }).email === 'string'
        ? (body as { email: string }).email
        : ''
    const role =
      body &&
      typeof body === 'object' &&
      'role' in body &&
      typeof (body as { role: unknown }).role === 'string'
        ? (body as { role: string }).role
        : ''

    if (role !== 'editor' && role !== 'viewer') {
      return jsonError('Role must be editor or viewer.', 400)
    }

    const functionalRoleRaw =
      body &&
      typeof body === 'object' &&
      'functionalRole' in body &&
      typeof (body as { functionalRole: unknown }).functionalRole === 'string'
        ? (body as { functionalRole: string }).functionalRole
        : undefined
    if (functionalRoleRaw && !isInviteFunctionalRole(functionalRoleRaw)) {
      return jsonError('Job function must be editor, reviewer, publisher, or analyst.', 400)
    }

    const [members, invites, spendCtx] = await Promise.all([
      listMembersForProduct(access.supabase, productId),
      listInvitesForProduct(access.supabase, productId),
      loadHostedSpendContext(access.supabase, { productId }),
    ])
    const pendingInviteCount = invites.filter((invite) => !invite.acceptedAt).length
    const occupied = occupiedSeats(members.length, pendingInviteCount)
    const { seatLimit, planId } = spendCtx
    if (!inviteWithinSeatLimit({ occupied, seatLimit })) {
      return jsonError(seatCapRejectCopy(planId, effectiveSeatLimit(seatLimit)), 403)
    }

    const invite = await createProductInvite(access.supabase, {
      productId,
      email,
      role,
      functionalRole: isInviteFunctionalRole(functionalRoleRaw) ? functionalRoleRaw : undefined,
      invitedBy: access.userId,
    })

    return NextResponse.json(
      {
        invite: {
          id: invite.id,
          email: invite.email,
          role: invite.role,
          functionalRole: invite.functionalRole,
          token: invite.token,
          expiresAt: invite.expiresAt,
          acceptPath: `/invite/${invite.token}`,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    return handleRouteError(error, 'Could not create invite.')
  }
}
