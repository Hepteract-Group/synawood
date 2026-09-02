import { describe, expect, it } from 'vitest'
import {
  authoredCoveredLastFrame,
  authoredMotionSpanLayout,
  authoredPlayStartFrame,
  authoredSequenceCoverage,
} from './sequence-coverage'

const POVotra = `export default function PovotraAd() {
  return (
    <AbsoluteFill>
      <Sequence from={0} durationInFrames={60}><HookBeat /></Sequence>
      <Sequence from={60} durationInFrames={120}><StatBeat /></Sequence>
      <Sequence from={180} durationInFrames={150}><DeviceBeat /></Sequence>
      <Sequence durationInFrames={120} from={330}><CTABeat /></Sequence>
    </AbsoluteFill>
  )
}
`

describe('authoredSequenceCoverage (#1265)', () => {
  it('spans every Sequence beat including swapped attribute order', () => {
    expect(authoredSequenceCoverage(POVotra)).toEqual({ from: 0, end: 450 })
  })

  it('returns null when the tree is one global-clock composition', () => {
    expect(authoredSequenceCoverage('export default () => <AbsoluteFill />')).toBeNull()
  })

  it('clamps inspect last-frame to the last Sequence, not the empty tail', () => {
    expect(authoredCoveredLastFrame(POVotra, 497)).toBe(449)
    expect(authoredCoveredLastFrame('export default () => null', 90)).toBe(89)
  })

  it('lays out the MAIN span on Sequence coverage, not the canvas tail (#1267)', () => {
    const coverage = authoredSequenceCoverage(POVotra)
    expect(coverage).toEqual({ from: 0, end: 450 })
    expect(authoredMotionSpanLayout(coverage!, 2)).toEqual({ left: 0, width: 900 })
  })

  it('restarts Play from 0 after ended or the empty tail (#1268)', () => {
    const covered = authoredCoveredLastFrame(POVotra, 497)
    expect(authoredPlayStartFrame(496, 497, covered)).toBe(0)
    expect(authoredPlayStartFrame(450, 497, covered)).toBe(0)
    expect(authoredPlayStartFrame(449, 497, covered)).toBe(0)
    expect(authoredPlayStartFrame(300, 497, covered)).toBe(300)
    expect(authoredPlayStartFrame(0, 497, covered)).toBe(0)
    expect(authoredPlayStartFrame(89, 90)).toBe(0)
    expect(authoredPlayStartFrame(40, 90)).toBe(40)
  })
})
