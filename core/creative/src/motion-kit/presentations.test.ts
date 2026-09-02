import { describe, expect, it } from 'vitest'
import { MOTION_TRANSITION_FAMILIES, sceneWipeProgress, sceneWipeStyle } from './presentations'

describe('SceneWipe presentations (#1193)', () => {
  it('ships five families with different mid-transition silhouettes', () => {
    expect(MOTION_TRANSITION_FAMILIES).toEqual(['fade', 'slide', 'iris', 'brand-wipe', 'star'])
    const mid = 0.5
    const paths = MOTION_TRANSITION_FAMILIES.map(
      (id) => sceneWipeStyle({ presentationId: id, progress: mid, brandColor: '#c45c26' }).clipPath,
    )
    expect(new Set(paths).size).toBe(MOTION_TRANSITION_FAMILIES.length)
    expect(sceneWipeStyle({ presentationId: 'iris', progress: mid }).clipPath).toMatch(/circle/)
    expect(sceneWipeStyle({ presentationId: 'star', progress: mid }).clipPath).toMatch(/polygon/)
    expect(sceneWipeStyle({ presentationId: 'slide', progress: mid }).clipPath).toMatch(/inset/)
    expect(sceneWipeStyle({ presentationId: 'brand-wipe', progress: mid }).clipPath).toMatch(
      /polygon/,
    )
    expect(sceneWipeStyle({ presentationId: 'fade', progress: mid }).opacity).toBe(0.5)
    expect(
      sceneWipeStyle({ presentationId: 'brand-wipe', progress: mid, brandColor: '#c45c26' })
        .backgroundColor,
    ).toBe('#c45c26')
  })

  it('is frame-driven (progress from frame, not CSS time)', () => {
    expect(sceneWipeProgress(0, 18)).toBe(0)
    expect(sceneWipeProgress(9, 18)).toBe(0.5)
    expect(sceneWipeProgress(18, 18)).toBe(1)
  })
})
