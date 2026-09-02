import { describe, expect, it } from 'vitest'
import { treatmentPreviewClass } from './overlay-catalog'

describe('overlay catalog tiles', () => {
  it('maps treatment ids to a hover preview class without inventing new primitives', () => {
    expect(treatmentPreviewClass('shake')).toBe('overlay-tile-motion is-shake')
    expect(treatmentPreviewClass('zoom_punch')).toBe('overlay-tile-motion is-zoom-punch')
    expect(treatmentPreviewClass('hook_punch')).toBe('overlay-tile-motion is-hook-punch')
    expect(treatmentPreviewClass('cta_hit')).toBe('overlay-tile-motion is-cta-hit')
  })
})
