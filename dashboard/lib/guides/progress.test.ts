import { describe, expect, it } from 'vitest'
import { canTransitionGuideStatus, parseGuideProgressWrite } from './progress'

describe('parseGuideProgressWrite', () => {
  it('accepts dismiss and resume', () => {
    expect(parseGuideProgressWrite({ status: 'dismissed' })).toEqual({
      status: 'dismissed',
      stepIndex: 0,
    })
    expect(parseGuideProgressWrite({ status: 'in_progress', stepIndex: 2 })).toEqual({
      status: 'in_progress',
      stepIndex: 2,
    })
  })

  it('rejects unknown statuses', () => {
    expect(() => parseGuideProgressWrite({ status: 'snooze' })).toThrow(/valid guide status/)
  })
})

describe('canTransitionGuideStatus', () => {
  it('lets Settings replay a finished guide, and blocks a reset to pending', () => {
    expect(canTransitionGuideStatus('dismissed', 'in_progress')).toBe(true)
    expect(canTransitionGuideStatus('completed', 'pending')).toBe(false)
    expect(canTransitionGuideStatus('in_progress', 'completed')).toBe(true)
  })
})
