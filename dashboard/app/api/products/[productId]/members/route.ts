import { NextResponse } from 'next/server'
import { loadHostedSpendContext } from '@synawood/creative/billing/load-hosted-spend-context'
import {
  effectiveSeatLimit,
  occupiedSeats,
  seatsOnPlanLine,
} from '@synawood/creative/billing/seat-cap'
import { listInvitesForProduct, listMembersForProduct } from '../../../../../lib/product-onboarding'
import { hydrateMembersWithIdentity } from '../../../../../lib/member-identity'
import { handleRouteError, requireStudioAccess } from '../../../../../lib/studio-server'

type RouteContext = { params: Promise<{ productId: string }> }

/** Members + invites for a Product (editor+). */
export const GET = async (_request: Request, context: RouteContext) => {
  try {
    const { productId } = await context.params
    const access = await requireStudioAccess({ productId, minRole: 'editor' })
    const [members, invites, spendCtx] = await Promise.all([
      listMembersForProduct(access.supabase, productId),
      listInvitesForProduct(access.supabase, productId),
      loadHostedSpendContext(access.supabase, { productId }),
    ])
    const people = await hydrateMembersWithIdentity(access.supabase, members)
    const pendingInviteCount = invites.filter((invite) => !invite.acceptedAt).length
    const seatsOccupied = occupiedSeats(members.length, pendingInviteCount)
    const seatLimit = effectiveSeatLimit(spendCtx.seatLimit)
    const planId = spendCtx.planId
    const seatsLine = seatsOnPlanLine(seatsOccupied, seatLimit, planId)
    return NextResponse.json({
      members: people.map((member) => ({
        userId: member.userId,
        email: member.email,
        displayName: member.displayName,
        unresolved: member.unresolved,
        role: member.role,
        functionalRole: member.functionalRole,
        createdAt: member.createdAt,
      })),
      canManageMembers: access.membership.role === 'owner',
      seatLimit,
      seatsOccupied,
      planId,
      seatsLine,
      invites: invites.map((invite) => ({
        id: invite.id,
        email: invite.email,
        role: invite.role,
        functionalRole: invite.functionalRole,
        token: invite.token,
        expiresAt: invite.expiresAt,
        acceptedAt: invite.acceptedAt,
        createdAt: invite.createdAt,
        pending: !invite.acceptedAt,
      })),
    })
  } catch (error) {
    return handleRouteError(error, 'Could not load members.')
  }
}
