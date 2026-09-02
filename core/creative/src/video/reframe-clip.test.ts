import { describe, expect, it } from 'vitest'
import { addClip, attachAsset } from '../project/operations'
import { createEmptyProject } from '../project/schema'
import {
  applyReframeClip,
  cropWindowForAspect,
  interpolateTracking,
  panScanStyle,
  planReframeClip,
} from './reframe-clip'

const VIDEO_ID = '11111111-1111-4111-8111-111111111111'

const talkingHead = () => {
  const empty = createEmptyProject({
    id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    productId: 'demo',
  })
  const withAsset = attachAsset(empty, {
    id: VIDEO_ID,
    kind: 'video',
    blobKey: 'local/take.mp4',
    source: 'upload',
    probe: { durationFrames: 240, width: 1920, height: 1080 },
  })
  return addClip(withAsset, { assetId: VIDEO_ID, from: 0 })
}

describe('cropWindowForAspect', () => {
  it('crops a 16:9 source to a vertical 9:16 strip', () => {
    const box = cropWindowForAspect(1920, 1080, '9:16')
    expect(box.h).toBe(1)
    expect(box.w).toBeCloseTo(9 / 16 / (16 / 9), 3)
    expect(box.x).toBeCloseTo((1 - box.w) / 2, 3)
  })

  it('shifts the window toward a face box', () => {
    const center = cropWindowForAspect(1920, 1080, '9:16')
    const faced = cropWindowForAspect(1920, 1080, '9:16', { x: 0.8, y: 0.4 })
    expect(faced.x).toBeGreaterThan(center.x)
    expect(faced.x + faced.w).toBeLessThanOrEqual(1.0001)
  })
})

describe('interpolateTracking', () => {
  it('lerps between keyframes', () => {
    const mid = interpolateTracking(
      [
        { t: 0, x: 0, y: 0, w: 0.5, h: 1 },
        { t: 2, x: 0.5, y: 0, w: 0.5, h: 1 },
      ],
      1,
    )
    expect(mid.x).toBeCloseTo(0.25)
  })
})

describe('panScanStyle', () => {
  it('scales the source so the crop fills the frame', () => {
    const style = panScanStyle({ x: 0.25, y: 0, w: 0.5, h: 1 })
    expect(style.width).toBe('200%')
    expect(style.left).toBe('-50%')
  })
})

describe('planReframeClip', () => {
  it('plans a 9:16 crop on a 16:9 talking-head take', () => {
    const project = talkingHead()
    const plan = planReframeClip(project, { clipId: project.clips[0]!.id, aspect: '9:16' })
    expect(plan.ok).toBe(true)
    if (!plan.ok || plan.skip) throw new Error('expected a plan')
    expect(plan.reframe.aspect).toBe('9:16')
    expect(plan.reframe.tracking[0]?.h).toBe(1)
    expect(plan.reframe.tracking[0]!.w).toBeLessThan(1)
  })

  it('skips when that aspect is already applied', () => {
    const project = talkingHead()
    const clipId = project.clips[0]!.id
    const planned = planReframeClip(project, { clipId, aspect: '9:16' })
    if (!planned.ok || planned.skip) throw new Error('expected a plan')
    const next = applyReframeClip(project, { clipId, reframe: planned.reframe })
    expect(next.whyLog[0]?.action).toBe('reframe')
    expect(next.whyLog[0]?.reason).toMatch(/9:16/)
    const again = planReframeClip(next, { clipId, aspect: '9:16' })
    expect(again.ok && again.skip).toBe(true)
  })

  it('rejects audio clips', () => {
    const empty = createEmptyProject({
      id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      productId: 'demo',
    })
    const audioId = '33333333-3333-4333-8333-333333333333'
    const withAsset = attachAsset(empty, {
      id: audioId,
      kind: 'audio',
      blobKey: 'local/vo.mp3',
      source: 'upload',
      probe: { durationFrames: 120 },
    })
    const project = addClip(withAsset, { assetId: audioId, from: 0 })
    expect(planReframeClip(project, { clipId: project.clips[0]!.id }).ok).toBe(false)
  })
})
