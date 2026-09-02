import { describe, expect, it } from 'vitest'
import { reciprocalRankFusion, RRF_K, RRF_VISUAL_WEIGHT } from './fuse-moment-ranks'

describe('reciprocalRankFusion (#583)', () => {
  it('ranks a visual-only shot above a caption-only distractor', () => {
    const scores = reciprocalRankFusion([
      { weight: RRF_VISUAL_WEIGHT, hits: [{ shotId: 'ui' }] },
      { weight: 1, hits: [{ shotId: 'office' }] },
    ])
    expect(scores.get('ui')!).toBeGreaterThan(scores.get('office')!)
    expect(scores.get('ui')).toBeCloseTo(RRF_VISUAL_WEIGHT / (RRF_K + 1), 8)
  })

  it('sums ranks when a shot appears in more than one list', () => {
    const scores = reciprocalRankFusion([
      { weight: 1, hits: [{ shotId: 'both' }, { shotId: 'text' }] },
      { weight: 1, hits: [{ shotId: 'both' }] },
    ])
    expect(scores.get('both')!).toBeGreaterThan(scores.get('text')!)
  })
})
