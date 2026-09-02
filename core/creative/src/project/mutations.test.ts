import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { applyStudioMutation, studioMutationSchema } from './mutations'
import { addClip, attachAsset } from './operations'
import { createEmptyProject } from './schema'

const projectWithClip = () => {
  const base = createEmptyProject({ id: randomUUID(), productId: 'demo' })
  const asset = {
    id: randomUUID(),
    kind: 'video' as const,
    blobKey: 'local/test.mp4',
    source: 'upload' as const,
    probe: { durationFrames: 300 },
  }
  return addClip(attachAsset(base, asset), { assetId: asset.id })
}

describe('studio mutation dispatcher', () => {
  it('validates and applies a clip placement', () => {
    const project = projectWithClip()
    const mutation = studioMutationSchema.parse({
      type: 'place_clip',
      clipId: project.clips[0].id,
      from: 120,
    })

    const next = applyStudioMutation(project, mutation)

    expect(next.clips[0].from).toBe(120)
  })

  it('applies a left-edge trim atomically', () => {
    const project = projectWithClip()
    const next = applyStudioMutation(project, {
      type: 'trim_clip',
      clipId: project.clips[0].id,
      from: 30,
      durationInFrames: 270,
      trimStartFrames: 30,
    })

    expect(next.clips[0]).toMatchObject({
      from: 30,
      durationInFrames: 270,
      trim: { startFrames: 30 },
    })
    expect(next.revision).toBe(project.revision + 1)
  })

  it('applies track chrome flags and cover frame', () => {
    const project = createEmptyProject({ id: randomUUID(), productId: 'demo' })
    const flagged = applyStudioMutation(project, {
      type: 'set_track_flags',
      trackId: 'track_audio',
      hidden: true,
    })
    expect(flagged.tracks.find((track) => track.id === 'track_audio')?.hidden).toBe(true)

    const covered = applyStudioMutation(flagged, { type: 'set_cover_frame', frame: 15 })
    expect(covered.coverFrame).toBe(15)
  })

  it('applies hook title, end card, and captions mutations', () => {
    const project = projectWithClip()
    const hooked = applyStudioMutation(project, {
      type: 'set_hook_title',
      text: 'Stop scrolling',
    })
    expect(hooked.overlays.some((overlay) => overlay.kind === 'hook_title')).toBe(true)

    const ended = applyStudioMutation(hooked, {
      type: 'set_end_card',
      text: 'Try the private example',
    })
    expect(ended.overlays.some((overlay) => overlay.kind === 'end_card')).toBe(true)

    const captioned = applyStudioMutation(ended, {
      type: 'add_captions',
      text: 'Tip one',
      from: 0,
      durationInFrames: 45,
      style: { presetId: 'two-line' },
    })
    const caption = captioned.overlays.find((overlay) => overlay.kind === 'caption')
    expect(caption?.text).toBe('Tip one')
    expect(caption?.style?.presetId).toBe('two-line')
  })

  it('applies add_text and update_overlay mutations', () => {
    const project = projectWithClip()
    const added = applyStudioMutation(project, {
      type: 'add_text',
      text: 'On-screen type',
      kind: 'title',
      layout: { x: 0.1, y: 0.08, width: 0.8, height: 0.2, rotation: 0 },
    })
    const title = added.overlays.find((overlay) => overlay.kind === 'title')
    expect(title?.text).toBe('On-screen type')
    expect(title?.id).toBeTruthy()

    const updated = applyStudioMutation(added, {
      type: 'update_overlay',
      overlayId: title!.id,
      text: 'Edited type',
    })
    expect(updated.overlays.find((overlay) => overlay.id === title!.id)?.text).toBe('Edited type')
  })

  it('applies a clip filter without changing the cut pack', () => {
    const project = projectWithClip()
    const next = applyStudioMutation(project, {
      type: 'apply_filter',
      clipId: project.clips[0]!.id,
      filterId: 'vhs',
      intensity: 0.8,
    })
    expect(next.clips[0]?.filterId).toBe('vhs')
    expect(next.stylePackId ?? null).toBeNull()
  })

  it('applies and clears a clip treatment', () => {
    const project = projectWithClip()
    const next = applyStudioMutation(project, {
      type: 'apply_effect',
      clipId: project.clips[0]!.id,
      effectId: 'shake',
      intensity: 0.6,
    })
    expect(next.clips[0]?.treatments).toEqual([{ id: 'shake', intensity: 0.6 }])
    const cleared = applyStudioMutation(next, {
      type: 'clear_effect',
      clipId: project.clips[0]!.id,
      effectId: 'shake',
    })
    expect(cleared.clips[0]?.treatments ?? []).toEqual([])
  })

  it('regenerates one clip treatment without clearing the others', () => {
    const project = projectWithClip()
    const clipId = project.clips[0]!.id
    const shaken = applyStudioMutation(project, {
      type: 'apply_effect',
      clipId,
      effectId: 'shake',
      intensity: 0.6,
    })
    const next = applyStudioMutation(shaken, { type: 'regen_effect', clipId, effectId: 'shake' })
    expect(next.clips[0]?.treatments).toEqual([{ id: 'shake', intensity: 1 }])
    expect(next.whyLog?.at(-1)?.action).toBe('effect')
  })

  it('picks a thumbnail still on the project', () => {
    const project = projectWithClip()
    const stillId = randomUUID()
    const withStill = attachAsset(project, {
      id: stillId,
      kind: 'image',
      blobKey: 'local/thumb.png',
      source: 'upload',
      probe: {},
    })
    const next = applyStudioMutation(withStill, { type: 'pick_thumbnail', assetId: stillId })
    expect(next.thumbnailAssetId).toBe(stillId)
    expect(next.thumbnailCandidateIds).toContain(stillId)
  })

  it('refuses place_sfx without a sound file for a new pack (#939)', () => {
    const project = createEmptyProject({ id: randomUUID(), productId: 'demo' })
    expect(() =>
      applyStudioMutation(project, { type: 'place_sfx', packId: 'whoosh', from: 0 }),
    ).toThrow(/Missing sound file/)
  })
})
