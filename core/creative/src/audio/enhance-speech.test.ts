import { describe, expect, it } from 'vitest'
import { addClip, attachAsset, retargetClipAsset } from '../project/operations'
import { createEmptyProject } from '../project/schema'
import {
  enhancedProbeFor,
  isSpeechEnhancedProbe,
  isStubEnhanceModelId,
  planEnhanceSpeech,
} from './enhance-speech'

const VIDEO_ID = '11111111-1111-4111-8111-111111111111'

const projectWithTalkingHead = () => {
  const empty = createEmptyProject({
    id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    productId: 'demo',
  })
  const withAsset = attachAsset(empty, {
    id: VIDEO_ID,
    kind: 'video',
    blobKey: 'local/take.mp4',
    source: 'upload',
    probe: { durationFrames: 240 },
  })
  return addClip(withAsset, { assetId: VIDEO_ID, from: 0 })
}

describe('planEnhanceSpeech', () => {
  it('fails when no clip is selected', () => {
    const project = createEmptyProject({
      id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      productId: 'demo',
    })
    expect(planEnhanceSpeech(project, {}).ok).toBe(false)
  })

  it('fails on an image clip', () => {
    const empty = createEmptyProject({
      id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      productId: 'demo',
    })
    const imageId = '33333333-3333-4333-8333-333333333333'
    const withAsset = attachAsset(empty, {
      id: imageId,
      kind: 'image',
      blobKey: 'local/still.png',
      source: 'upload',
      probe: {},
    })
    const project = addClip(withAsset, { assetId: imageId, from: 0 })
    const plan = planEnhanceSpeech(project, { clipId: project.clips[0]!.id })
    expect(plan.ok).toBe(false)
  })

  it('plans a video talking-head clip', () => {
    const project = projectWithTalkingHead()
    const clipId = project.clips[0]!.id
    const plan = planEnhanceSpeech(project, { clipId })
    expect(plan.ok).toBe(true)
    if (!plan.ok || plan.skip) throw new Error('expected a plan')
    expect(plan.asset.id).toBe(VIDEO_ID)
  })

  it('skips when the take is already enhanced', () => {
    const project = projectWithTalkingHead()
    const clip = project.clips[0]!
    const next = {
      ...project,
      assets: project.assets.map((asset) =>
        asset.id === clip.assetId
          ? { ...asset, probe: enhancedProbeFor(asset, 'mock-enhance') }
          : asset,
      ),
    }
    const plan = planEnhanceSpeech(next, { clipId: clip.id })
    expect(plan.ok && 'skip' in plan && plan.skip).toBe(true)
  })
})

describe('retargetClipAsset', () => {
  it('points the clip at the enhanced asset', () => {
    const project = projectWithTalkingHead()
    const clipId = project.clips[0]!.id
    const enhancedId = '22222222-2222-4222-8222-222222222222'
    const withNew = attachAsset(project, {
      id: enhancedId,
      kind: 'video',
      blobKey: 'local/enhanced.mp4',
      source: 'generator',
      probe: { speechEnhanced: true },
    })
    const swapped = retargetClipAsset(withNew, clipId, enhancedId)
    expect(swapped.clips[0]?.assetId).toBe(enhancedId)
    expect(
      isSpeechEnhancedProbe(swapped.assets.find((item) => item.id === enhancedId)?.probe),
    ).toBe(true)
  })
})

describe('isStubEnhanceModelId', () => {
  it('treats mock and ci ids as stub', () => {
    expect(isStubEnhanceModelId('mock-enhance')).toBe(true)
    expect(isStubEnhanceModelId('ci-stub-enhance')).toBe(true)
    expect(isStubEnhanceModelId('elevenlabs/audio-isolation')).toBe(false)
  })
})
