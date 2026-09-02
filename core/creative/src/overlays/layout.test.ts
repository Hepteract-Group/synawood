import { describe, expect, it } from 'vitest'
import { clampOverlayLayout } from './layout'

describe('clampOverlayLayout', () => {
  it('keeps the box inside the 0–1 frame', () => {
    expect(clampOverlayLayout({ x: 0.9, y: 0.9, width: 0.4, height: 0.4, rotation: 0 })).toEqual({
      x: 0.6,
      y: 0.6,
      width: 0.4,
      height: 0.4,
      rotation: 0,
    })
  })
})
