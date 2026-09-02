import { describe, expect, it } from 'vitest'
import { isMotionGraphicsBrief, isMotionGraphicsTurn } from './motion-brief'

describe('isMotionGraphicsBrief (#1196)', () => {
  it('matches kinetic type, stat slam, and device briefs', () => {
    expect(isMotionGraphicsBrief('30s kinetic type on the pricing claim')).toBe(true)
    expect(isMotionGraphicsBrief('make a kinetic type ad')).toBe(true)
    expect(isMotionGraphicsBrief('stat slam with CountUp')).toBe(true)
    expect(isMotionGraphicsBrief('put the app in a phone')).toBe(true)
  })

  it('does not match a talking-head make-ad', () => {
    expect(isMotionGraphicsBrief('produce a 25s ad for okiki alaso')).toBe(false)
    expect(isMotionGraphicsBrief('polish this talking-head take')).toBe(false)
  })

  it('treats authored projects as motion turns even on “fix it” (#1263)', () => {
    expect(isMotionGraphicsTurn({ userMessage: 'fix it, continue till its done' })).toBe(false)
    expect(
      isMotionGraphicsTurn({
        userMessage: 'fix it, continue till its done',
        compositionId: 'authored',
      }),
    ).toBe(true)
    expect(
      isMotionGraphicsTurn({
        userMessage: 'produce a 25s ad',
        compositionId: 'talking-head-60',
        craft: 'motion',
      }),
    ).toBe(true)
  })
})
