import { describe, expect, it } from 'vitest'
import { GATEWAY_REASONER_MODEL_IDS } from '../reasoner-models'
import { resolveVideoModelFamily } from './index'
import { VEO_DURATION_SNAP } from './veo'
import { MINIMAX_H3_VIDEO_MODEL_ID } from './minimax-h3'
import { WAN3_VIDEO_MODEL_ID } from './wan3'

describe('video model families (#1069)', () => {
  it('routes Veo, Seedance, Wan, and MiniMax H3 to distinct families', () => {
    expect(resolveVideoModelFamily('google/veo-3.1-fast-generate-001')).toBe('veo')
    expect(resolveVideoModelFamily('bytedance/seedance-2.0-fast')).toBe('seedance')
    expect(resolveVideoModelFamily(WAN3_VIDEO_MODEL_ID)).toBe('wan3')
    expect(resolveVideoModelFamily(MINIMAX_H3_VIDEO_MODEL_ID)).toBe('minimax-h3')
  })

  it('keeps Veo on 4/6/8 duration snap', () => {
    expect(VEO_DURATION_SNAP).toEqual([4, 6, 8])
  })

  it('does not treat MiniMax M3 as a video family (ADR-0093)', () => {
    expect(resolveVideoModelFamily('minimax/minimax-m3')).toBe('unknown')
    expect(GATEWAY_REASONER_MODEL_IDS).toContain('minimax/minimax-m3')
  })
})
