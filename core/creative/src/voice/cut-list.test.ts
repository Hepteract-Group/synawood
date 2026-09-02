import { describe, expect, it } from 'vitest'
import { addCaptions, addClip, attachAsset } from '../project/operations'
import { createEmptyProject } from '../project/schema'
import { applyCutList, cutWhyReason } from './apply-cut-list'
import {
  buildCutList,
  clipLocalTimedCuts,
  proposeClarityRanges,
  timedCutsToFrameRanges,
} from './cut-list'

const talkingHead = () => {
  let project = createEmptyProject({
    id: '22222222-2222-4222-8222-222222222222',
    productId: 'demo',
  })
  project = attachAsset(project, {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    kind: 'video',
    blobKey: 'local/take.mp4',
    source: 'upload',
    probe: {},
  })
  project = addClip(project, {
    assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    from: 0,
    durationInFrames: 180,
  })
  return project
}

describe('buildCutList (#871)', () => {
  it('marks filler-only words with reason filler', () => {
    const cuts = buildCutList({
      segments: [
        { startMs: 0, endMs: 400, text: 'um' },
        { startMs: 400, endMs: 2000, text: 'Edit PDFs' },
      ],
      reasons: ['filler'],
    })
    expect(cuts).toEqual([{ startMs: 0, endMs: 400, reason: 'filler' }])
  })

  it('cuts dead air longer than 0.6s and leaves a 200ms breath', () => {
    const cuts = buildCutList({
      segments: [
        { startMs: 0, endMs: 500, text: 'Hello' },
        { startMs: 1500, endMs: 2000, text: 'there' },
      ],
      reasons: ['pause'],
    })
    expect(cuts).toEqual([{ startMs: 700, endMs: 1500, reason: 'pause' }])
  })

  it('keeps pauses shorter than 0.6s', () => {
    const cuts = buildCutList({
      segments: [
        { startMs: 0, endMs: 500, text: 'Hello' },
        { startMs: 900, endMs: 1200, text: 'there' },
      ],
      reasons: ['pause'],
    })
    expect(cuts).toEqual([])
  })

  it('cuts a false start and keeps the last complete take', () => {
    const cuts = buildCutList({
      segments: [
        { startMs: 0, endMs: 800, text: 'I think we should' },
        { startMs: 900, endMs: 2500, text: 'I think we should ship Friday' },
      ],
      reasons: ['retake'],
    })
    expect(cuts).toEqual([{ startMs: 0, endMs: 800, reason: 'retake' }])
  })

  it('does not invent clarity ranges', () => {
    const cuts = buildCutList({
      segments: [
        { startMs: 0, endMs: 2000, text: 'A long ramble about lunch' },
        { startMs: 2000, endMs: 4000, text: 'Edit PDFs in the browser' },
      ],
      reasons: ['clarity'],
    })
    expect(cuts).toEqual([])
  })

  it('keeps operator-marked clarity ranges', () => {
    const cuts = buildCutList({
      segments: [
        { startMs: 0, endMs: 2000, text: 'A long ramble about lunch' },
        { startMs: 2000, endMs: 4000, text: 'Edit PDFs in the browser' },
      ],
      reasons: ['clarity'],
      clarityRanges: [{ startMs: 0, endMs: 2000 }],
    })
    expect(cuts).toEqual([{ startMs: 0, endMs: 2000, reason: 'clarity' }])
  })

  it('proposes rambling spans that miss the brief (#875)', () => {
    expect(
      proposeClarityRanges({
        segments: [
          { startMs: 0, endMs: 2000, text: 'A long ramble about lunch' },
          { startMs: 2000, endMs: 4000, text: 'Edit PDFs in the browser' },
        ],
        briefText: 'Edit PDFs in the browser',
      }),
    ).toEqual([{ startMs: 0, endMs: 2000, reason: 'clarity' }])
  })

  it('proposes nothing when the brief is empty (#875)', () => {
    expect(
      proposeClarityRanges({
        segments: [{ startMs: 0, endMs: 2000, text: 'A long ramble about lunch' }],
        briefText: '',
      }),
    ).toEqual([])
  })

  it('converts timed cuts to clip frame ranges', () => {
    expect(
      timedCutsToFrameRanges([{ startMs: 0, endMs: 400, reason: 'filler' }], {
        fps: 30,
        clipFrom: 90,
      }),
    ).toEqual([{ from: 90, durationInFrames: 12 }])
  })
})

describe('clipLocalTimedCuts (#873)', () => {
  it('shifts asset-absolute pause cuts onto a trimmed clip', () => {
    expect(
      clipLocalTimedCuts([{ startMs: 2500, endMs: 3400, reason: 'pause' }], {
        trimStartMs: 2000,
        durationMs: 4000,
      }),
    ).toEqual([{ startMs: 500, endMs: 1400, reason: 'pause' }])
  })

  it('drops pauses that sit entirely outside the clip window', () => {
    expect(
      clipLocalTimedCuts([{ startMs: 0, endMs: 800, reason: 'pause' }], {
        trimStartMs: 2000,
        durationMs: 1000,
      }),
    ).toEqual([])
  })
})

describe('cutWhyReason (#873)', () => {
  it('names pause cuts in visitor language', () => {
    expect(cutWhyReason([{ startMs: 700, endMs: 1500, reason: 'pause' }])).toBe(
      'Removed silence and kept a short breath.',
    )
  })
})

describe('cutWhyReason (#874)', () => {
  it('names false-start cuts in visitor language', () => {
    expect(cutWhyReason([{ startMs: 0, endMs: 800, reason: 'retake' }])).toBe(
      'Removed the false start and kept the last take.',
    )
  })
})

describe('cutWhyReason (#875)', () => {
  it('names rambling cuts in visitor language', () => {
    expect(cutWhyReason([{ startMs: 0, endMs: 2000, reason: 'clarity' }])).toBe(
      'Cut rambling from this take.',
    )
  })
})

describe('applyCutList timed cuts + captions (#871)', () => {
  it('accepts millisecond cuts and shortens the clip', () => {
    const project = talkingHead()
    const clipId = project.clips[0]!.id
    const next = applyCutList(project, clipId, [{ startMs: 1000, endMs: 1333, reason: 'pause' }])
    const total = next.clips
      .filter((clip) => clip.assetId === 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
      .reduce((sum, clip) => sum + clip.durationInFrames, 0)
    expect(total).toBe(170)
    expect(next.whyLog[0]?.action).toBe('cut')
    expect(next.whyLog[0]?.reason).toBe('Removed silence and kept a short breath.')
  })

  it('shifts a caption that starts after the cut', () => {
    const withCaption = addCaptions(talkingHead(), {
      text: 'Edit PDFs',
      from: 60,
      durationInFrames: 30,
    })
    const clipId = withCaption.clips[0]!.id
    const next = applyCutList(withCaption, clipId, [{ from: 30, durationInFrames: 10 }])
    expect(next.overlays).toEqual([
      expect.objectContaining({ kind: 'caption', from: 50, durationInFrames: 30 }),
    ])
  })

  it('drops a caption that sits entirely in the cut', () => {
    const withCaption = addCaptions(talkingHead(), {
      text: 'um',
      from: 32,
      durationInFrames: 6,
    })
    const clipId = withCaption.clips[0]!.id
    const next = applyCutList(withCaption, clipId, [{ from: 30, durationInFrames: 10 }])
    expect(next.overlays).toEqual([])
  })
})
