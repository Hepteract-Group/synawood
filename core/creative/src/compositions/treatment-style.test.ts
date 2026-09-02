import { describe, expect, it } from 'vitest'
import { styleForTreatments, treatmentIsActive } from './treatment-style'

describe('treatment styles (ADR-0058 / #714)', () => {
  it('zoom_punch scales 1 to 1.08 over the first 12 frames', () => {
    const start = styleForTreatments([{ id: 'zoom_punch', intensity: 1 }], 0)
    const mid = styleForTreatments([{ id: 'zoom_punch', intensity: 1 }], 6)
    const done = styleForTreatments([{ id: 'zoom_punch', intensity: 1 }], 12)
    expect(start.transform).toBe('none')
    expect(mid.transform).toMatch(/scale\(1\.0/)
    expect(done.transform).toMatch(/scale\(1\.08/)
  })

  it('flash is opaque at clip in and gone by frame 8', () => {
    expect(styleForTreatments([{ id: 'flash', intensity: 1 }], 0).flashOpacity).toBe(1)
    expect(styleForTreatments([{ id: 'flash', intensity: 1 }], 8).flashOpacity).toBe(0)
  })

  it('shake is zero at identity intensity 0 and moves at 1', () => {
    expect(styleForTreatments([{ id: 'shake', intensity: 0 }], 5).transform).toBe('none')
    expect(styleForTreatments([{ id: 'shake', intensity: 1 }], 5).transform).toMatch(/translate/)
  })

  it('respects from/duration window', () => {
    const treatment = { id: 'glow' as const, intensity: 1, from: 10, durationInFrames: 5 }
    expect(treatmentIsActive(treatment, 9)).toBe(false)
    expect(treatmentIsActive(treatment, 10)).toBe(true)
    expect(treatmentIsActive(treatment, 14)).toBe(true)
    expect(treatmentIsActive(treatment, 15)).toBe(false)
  })
})
