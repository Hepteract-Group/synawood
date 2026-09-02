export const DEFAULT_SEAT_LIMIT = 3

export const occupiedSeats = (memberCount: number, pendingInviteCount: number): number =>
  memberCount + pendingInviteCount

export const effectiveSeatLimit = (seatLimit: number | null | undefined): number =>
  seatLimit != null && Number.isFinite(seatLimit) && seatLimit > 0 ? seatLimit : DEFAULT_SEAT_LIMIT

export const planPeopleLabel = (planId: string | null | undefined): 'Studio' | 'Team' =>
  planId === 'team' ? 'Team' : 'Studio'

export const seatsOnPlanLine = (
  occupied: number,
  limit: number,
  planId: string | null | undefined,
): string => `${occupied} of ${limit} people on ${planPeopleLabel(planId)}`

export const seatCapRejectCopy = (planId: string | null | undefined, limit: number): string => {
  if (planId === 'team') {
    return `Team includes ${limit} people. Remove someone to invite another.`
  }
  return `Studio includes ${limit} people. Remove someone or move to Team.`
}

export const inviteWithinSeatLimit = (input: {
  occupied: number
  seatLimit: number | null | undefined
}): boolean => input.occupied < effectiveSeatLimit(input.seatLimit)
