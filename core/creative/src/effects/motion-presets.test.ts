import { describe, expect, it } from 'vitest'
import { addClip, attachAsset } from '../project/operations'
import { createEmptyProject } from '../project/schema'
import { TREATMENT_IDS } from './treatments'
import { applyMotionPreset, listMotionPresets } from './motion-presets'

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
    probe: { durationFrames: 90 },
  })
  return addClip(project, {
    assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    from: 0,
    durationInFrames: 90,
  })
}

describe('applyMotionPreset (#885)', () => {
  it('only stacks existing treatments', () => {
    for (const preset of listMotionPresets()) {
      for (const step of preset.steps) {
        expect(TREATMENT_IDS).toContain(step.effectId)
      }
    }
  })

  it('applies zoom punch and flash for hook_punch', () => {
    const project = talkingHead()
    const clipId = project.clips[0]!.id
    const next = applyMotionPreset(project, { clipId, presetId: 'hook_punch' })
    expect(next.clips[0]?.treatments?.map((item) => item.id).sort()).toEqual([
      'flash',
      'zoom_punch',
    ])
    expect(next.whyLog.at(-1)?.reason).toBe('Added a punch on the hook.')
  })

  it('is a no-op when the pack is already on the clip', () => {
    const project = talkingHead()
    const clipId = project.clips[0]!.id
    const once = applyMotionPreset(project, { clipId, presetId: 'cta_hit' })
    const twice = applyMotionPreset(once, { clipId, presetId: 'cta_hit' })
    expect(twice.revision).toBe(once.revision)
    expect(twice.whyLog).toHaveLength(once.whyLog.length)
  })
})
