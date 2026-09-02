import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SEAT_LIMIT,
  effectiveSeatLimit,
  inviteWithinSeatLimit,
  occupiedSeats,
  planPeopleLabel,
  seatCapRejectCopy,
  seatsOnPlanLine,
} from './seat-cap'

describe('seat cap (#1059)', () => {
  it('occupied = members + pending invites', () => {
    expect(occupiedSeats(2, 1)).toBe(3)
    expect(occupiedSeats(0, 0)).toBe(0)
  })

  it('missing or invalid seatLimit defaults to 3', () => {
    expect(effectiveSeatLimit(null)).toBe(DEFAULT_SEAT_LIMIT)
    expect(effectiveSeatLimit(undefined)).toBe(DEFAULT_SEAT_LIMIT)
    expect(effectiveSeatLimit(0)).toBe(DEFAULT_SEAT_LIMIT)
    expect(effectiveSeatLimit(-1)).toBe(DEFAULT_SEAT_LIMIT)
    expect(effectiveSeatLimit(Number.NaN)).toBe(DEFAULT_SEAT_LIMIT)
  })

  it('uses explicit seatLimit when positive', () => {
    expect(effectiveSeatLimit(8)).toBe(8)
    expect(effectiveSeatLimit(3)).toBe(3)
  })

  it('planPeopleLabel: team vs studio/trial/null', () => {
    expect(planPeopleLabel('team')).toBe('Team')
    expect(planPeopleLabel('studio')).toBe('Studio')
    expect(planPeopleLabel('trial')).toBe('Studio')
    expect(planPeopleLabel(null)).toBe('Studio')
  })

  it('seatsOnPlanLine: "2 of 3 people on Studio"', () => {
    expect(seatsOnPlanLine(2, 3, 'studio')).toBe('2 of 3 people on Studio')
    expect(seatsOnPlanLine(5, 8, 'team')).toBe('5 of 8 people on Team')
  })

  it('Studio/trial/null reject copy mentions move to Team', () => {
    expect(seatCapRejectCopy(null, 3)).toBe(
      'Studio includes 3 people. Remove someone or move to Team.',
    )
    expect(seatCapRejectCopy('studio', 3)).toBe(
      'Studio includes 3 people. Remove someone or move to Team.',
    )
    expect(seatCapRejectCopy('trial', 3)).toBe(
      'Studio includes 3 people. Remove someone or move to Team.',
    )
  })

  it('Team reject copy uses plan limit', () => {
    expect(seatCapRejectCopy('team', 8)).toBe(
      'Team includes 8 people. Remove someone to invite another.',
    )
  })

  it('inviteWithinSeatLimit: 2 occupied on limit 3 is true; 3 occupied is false', () => {
    expect(inviteWithinSeatLimit({ occupied: 2, seatLimit: 3 })).toBe(true)
    expect(inviteWithinSeatLimit({ occupied: 3, seatLimit: 3 })).toBe(false)
    expect(inviteWithinSeatLimit({ occupied: 3, seatLimit: null })).toBe(false)
    expect(inviteWithinSeatLimit({ occupied: 2, seatLimit: null })).toBe(true)
  })
})
