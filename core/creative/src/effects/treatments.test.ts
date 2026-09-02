import { describe, expect, it } from 'vitest'
import { attachAsset, addClip } from '../project/operations'
import { createEmptyProject } from '../project/schema'
import { listAdReadyIssues } from '../project/ad-ready'
import {
  applyEffectToClip,
  clearEffectFromClip,
  nextTreatmentIntensity,
  regenEffect,
  resolveRegenEffectId,
} from './apply'
import {
  assertTreatmentsPublishable,
  isTreatmentId,
  listTreatments,
  TREATMENT_IDS,
} from './treatments'

const projectWithClip = () => {
  let project = createEmptyProject({
    id: '22222222-2222-4222-8222-222222222222',
    productId: 'demo',
  })
  const assetId = '11111111-1111-4111-8111-111111111111'
  project = addClip(
    attachAsset(project, {
      id: assetId,
      kind: 'video',
      blobKey: 'local/a.mp4',
      source: 'upload',
      probe: { durationFrames: 90 },
    }),
    { assetId },
  )
  return project
}

describe('treatments (ADR-0058 / #713)', () => {
  it('lists the four first-party primitives', () => {
    expect(listTreatments().map((item) => item.id)).toEqual([...TREATMENT_IDS])
    expect(isTreatmentId('shake')).toBe(true)
    expect(isTreatmentId('blur-face')).toBe(false)
  })

  it('applies and replaces a primitive on a clip', () => {
    const project = projectWithClip()
    const clipId = project.clips[0]!.id
    const punched = applyEffectToClip(project, { clipId, effectId: 'zoom_punch', intensity: 0.8 })
    expect(punched.clips[0]?.treatments).toEqual([{ id: 'zoom_punch', intensity: 0.8 }])
    const shaken = applyEffectToClip(punched, { clipId, effectId: 'shake', intensity: 0.4 })
    expect(shaken.clips[0]?.treatments?.map((item) => item.id)).toEqual(['zoom_punch', 'shake'])
    const louder = applyEffectToClip(shaken, { clipId, effectId: 'shake', intensity: 1 })
    expect(louder.clips[0]?.treatments).toEqual([
      { id: 'zoom_punch', intensity: 0.8 },
      { id: 'shake', intensity: 1 },
    ])
  })

  it('clears one treatment and rejects unknown ids', () => {
    const project = projectWithClip()
    const clipId = project.clips[0]!.id
    const applied = applyEffectToClip(project, { clipId, effectId: 'glow' })
    const cleared = clearEffectFromClip(applied, { clipId, effectId: 'glow' })
    expect(cleared.clips[0]?.treatments ?? []).toEqual([])
    expect(() => applyEffectToClip(project, { clipId, effectId: 'vhs' })).toThrow(
      /Unknown treatment/,
    )
  })

  it('Approve fails closed on an unknown treatment id', () => {
    expect(() => assertTreatmentsPublishable([{ id: 'shake' }])).not.toThrow()
    expect(() => assertTreatmentsPublishable([{ id: 'ae-glow' }])).toThrow(/unknown treatment/)
    const project = projectWithClip()
    const dirty = {
      ...project,
      clips: project.clips.map((clip) => ({
        ...clip,
        treatments: [{ id: 'mystery-shader', intensity: 1 }],
      })),
    }
    expect(listAdReadyIssues(dirty).some((issue) => issue.code === 'treatment')).toBe(true)
  })

  it('cycles treatment strength so regen is never a no-op', () => {
    expect(nextTreatmentIntensity(0.4)).toBe(0.7)
    expect(nextTreatmentIntensity(0.6)).toBe(1)
    expect(nextTreatmentIntensity(1)).toBe(0.4)
  })

  it('regenerates one clip treatment and leaves the rest of the cut', () => {
    const project = projectWithClip()
    const clipId = project.clips[0]!.id
    const withShake = applyEffectToClip(project, { clipId, effectId: 'shake', intensity: 0.6 })
    const withGlow = applyEffectToClip(withShake, { clipId, effectId: 'glow', intensity: 0.5 })
    const regenerated = regenEffect(withGlow, { clipId, effectId: 'shake' })
    expect(regenerated.clips[0]?.treatments).toEqual([
      { id: 'glow', intensity: 0.5 },
      { id: 'shake', intensity: 1 },
    ])
    expect(regenerated.whyLog?.at(-1)).toMatchObject({
      target: clipId,
      action: 'effect',
      reason: 'Tried Shake again.',
    })
    expect(regenerated.revision).toBe(withGlow.revision + 1)
  })

  it('regenerates the last treatment on a clip when effectId is omitted', () => {
    const project = projectWithClip()
    const clipId = project.clips[0]!.id
    const withShake = applyEffectToClip(project, { clipId, effectId: 'shake', intensity: 0.6 })
    const regenerated = regenEffect(withShake, { clipId })
    expect(regenerated.clips[0]?.treatments).toEqual([{ id: 'shake', intensity: 1 }])
  })

  it('refuses regen when the clip has no treatment', () => {
    const project = projectWithClip()
    expect(() => regenEffect(project, { clipId: project.clips[0]!.id })).toThrow(
      /Nothing to regenerate/,
    )
  })

  it('picks the treatment named in the why-log, not only the last one on the clip', () => {
    const treatments = [{ id: 'shake' }, { id: 'glow' }]
    expect(resolveRegenEffectId('Tried Shake again.', treatments)).toBe('shake')
    expect(resolveRegenEffectId('Added a punch on the hook.', treatments)).toBe('glow')
    expect(resolveRegenEffectId('Tried Shake again.', [{ id: 'glow' }])).toBe('glow')
  })
})
