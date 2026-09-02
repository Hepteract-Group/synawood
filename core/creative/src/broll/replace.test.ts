import { describe, expect, it } from 'vitest'
import { createEmptyProject, type StudioProject } from '../project/schema'
import { addClip } from '../project/operations'
import { BROLL_TRACK_ID, MAIN_VIDEO_TRACK_ID } from '../project/tracks'
import { buildBrollPlan } from './assemble'
import { commitBrollPlanToProject } from './commit'
import { overlappingBrollClipIds, rangesOverlap, sceneWindowFrames } from './replace'
import type { MomentHit } from '../asset-intelligence/moments'

const ASSET_ID = '11111111-1111-4111-8111-111111111111'
const SHOT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SHOT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const scene = (id: string, role: 'hook' | 'proof', locked = false, frames = 90) => ({
  id,
  role,
  label: role,
  clipIds: [] as string[],
  overlayIds: [] as string[],
  locked,
  targetDurationFrames: frames,
})

const hit = (shotId: string): MomentHit => ({
  assetId: ASSET_ID,
  shotId,
  startMs: 8000,
  endMs: 10000,
  score: 8,
  caption: 'export',
  transcriptExcerpt: null,
  tags: ['export'],
})

const projectWithLibrary = () => {
  const project = createEmptyProject({
    id: '22222222-2222-4222-8222-222222222222',
    productId: 'demo',
  })
  const seeded = {
    ...project,
    assets: [
      {
        id: ASSET_ID,
        kind: 'video' as const,
        blobKey: 'local/a.mp4',
        source: 'upload' as const,
        probe: { durationFrames: 600 },
      },
    ],
    intent: { ...project.intent, lengthSeconds: 30, keywords: ['export'] },
    scenes: [scene('sc_hook', 'hook'), scene('sc_proof', 'proof')],
  }
  return addClip(seeded, {
    assetId: ASSET_ID,
    trackId: MAIN_VIDEO_TRACK_ID,
    from: 0,
    durationInFrames: 900,
  })
}

describe('B-roll replace overlap math (#522)', () => {
  it('treats half-open ranges as overlapping when they share frames', () => {
    expect(rangesOverlap({ from: 0, to: 90 }, { from: 89, to: 180 })).toBe(true)
    expect(rangesOverlap({ from: 0, to: 90 }, { from: 90, to: 180 })).toBe(false)
    expect(rangesOverlap({ from: 60, to: 120 }, { from: 0, to: 60 })).toBe(false)
  })

  it('lays scene windows out sequentially from targetDurationFrames', () => {
    const project = projectWithLibrary()
    expect(sceneWindowFrames(project, 'sc_hook')).toEqual({ from: 0, to: 90 })
    expect(sceneWindowFrames(project, 'sc_proof')).toEqual({ from: 90, to: 180 })
  })

  it('uses assigned clip span when a scene already has clips', () => {
    const project = projectWithLibrary()
    const withClip = {
      ...project,
      clips: [
        {
          id: 'clip_proof',
          trackId: BROLL_TRACK_ID,
          assetId: ASSET_ID,
          from: 40,
          durationInFrames: 30,
          trim: { startFrames: 0 },
        },
      ],
      scenes: [
        scene('sc_hook', 'hook'),
        { ...scene('sc_proof', 'proof'), clipIds: ['clip_proof'] },
      ],
    }
    expect(sceneWindowFrames(withClip, 'sc_proof')).toEqual({ from: 40, to: 70 })
    expect(overlappingBrollClipIds(withClip, { from: 40, to: 70 })).toEqual(['clip_proof'])
  })

  it('ignores assigned A-roll when computing the B-roll window', () => {
    const project = projectWithLibrary()
    const withAroll = {
      ...project,
      clips: [
        {
          id: 'clip_aroll',
          trackId: MAIN_VIDEO_TRACK_ID,
          assetId: ASSET_ID,
          from: 0,
          durationInFrames: 900,
          trim: { startFrames: 0 },
        },
      ],
      scenes: [
        { ...scene('sc_hook', 'hook'), clipIds: ['clip_aroll'] },
        scene('sc_proof', 'proof'),
      ],
    }
    expect(sceneWindowFrames(withAroll, 'sc_hook')).toEqual({ from: 0, to: 90 })
  })
})

describe('commitBrollPlanToProject replace (#522)', () => {
  it('second assembly on the same scene leaves one B-roll clip, not two stacked', async () => {
    const project = projectWithLibrary()
    const firstPlan = buildBrollPlan({
      project,
      modelProfileId: 'ci-stub',
      momentsByScene: {
        sc_hook: [hit(SHOT_A)],
        sc_proof: [hit(SHOT_B)],
      },
    })
    const first = await commitBrollPlanToProject(project, firstPlan, { confirmSpend: true })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.project.clips.filter((clip) => clip.trackId === BROLL_TRACK_ID)).toHaveLength(2)

    const secondPlan = buildBrollPlan({
      project: first.project,
      modelProfileId: 'ci-stub',
      momentsByScene: {
        sc_hook: [hit(SHOT_A)],
        sc_proof: [hit(SHOT_B)],
      },
    })
    const second = await commitBrollPlanToProject(first.project, secondPlan, { confirmSpend: true })
    expect(second.ok).toBe(true)
    if (!second.ok) return
    const broll = second.project.clips.filter((clip) => clip.trackId === BROLL_TRACK_ID)
    expect(broll).toHaveLength(2)
    const proofId = second.project.scenes.find((item) => item.id === 'sc_proof')?.clipIds ?? []
    expect(proofId).toHaveLength(1)
    expect(broll.filter((clip) => proofId.includes(clip.id))).toHaveLength(1)
  })

  it('does not remove A-roll clips that overlap the scene window', async () => {
    const project: StudioProject = projectWithLibrary()
    const aRollId = project.clips.find((clip) => clip.trackId === MAIN_VIDEO_TRACK_ID)?.id
    const plan = buildBrollPlan({
      project,
      modelProfileId: 'ci-stub',
      momentsByScene: {
        sc_hook: [hit(SHOT_A)],
        sc_proof: [hit(SHOT_B)],
      },
    })
    const result = await commitBrollPlanToProject(project, plan, { confirmSpend: true })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.project.clips.some((clip) => clip.id === aRollId)).toBe(true)
    expect(
      result.project.clips.filter((clip) => clip.trackId === MAIN_VIDEO_TRACK_ID),
    ).toHaveLength(1)
  })

  it('skips locked scenes so existing B-roll in that window stays', async () => {
    const project = projectWithLibrary()
    const firstPlan = buildBrollPlan({
      project,
      modelProfileId: 'ci-stub',
      momentsByScene: {
        sc_hook: [hit(SHOT_A)],
        sc_proof: [hit(SHOT_B)],
      },
    })
    const first = await commitBrollPlanToProject(project, firstPlan, { confirmSpend: true })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const proofClip = first.project.scenes.find((item) => item.id === 'sc_proof')?.clipIds[0]
    const locked = {
      ...first.project,
      scenes: first.project.scenes.map((item) =>
        item.id === 'sc_proof' ? { ...item, locked: true } : item,
      ),
    }
    const secondPlan = buildBrollPlan({
      project: locked,
      modelProfileId: 'ci-stub',
      momentsByScene: {
        sc_hook: [hit(SHOT_A)],
        sc_proof: [hit(SHOT_B)],
      },
    })
    const second = await commitBrollPlanToProject(locked, secondPlan, { confirmSpend: true })
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.skippedLocked).toContain('sc_proof')
    expect(second.project.clips.some((clip) => clip.id === proofClip)).toBe(true)
  })

  it('keeps existing B-roll when generate-to-fill fails', async () => {
    const project = projectWithLibrary()
    const firstPlan = buildBrollPlan({
      project,
      modelProfileId: 'ci-stub',
      momentsByScene: {
        sc_hook: [hit(SHOT_A)],
        sc_proof: [hit(SHOT_B)],
      },
    })
    const first = await commitBrollPlanToProject(project, firstPlan, { confirmSpend: true })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const before = first.project.clips
      .filter((clip) => clip.trackId === BROLL_TRACK_ID)
      .map((clip) => clip.id)
      .sort()
    const branded = {
      ...first.project,
      brand: { productId: 'demo', stillAssetId: ASSET_ID },
    }
    const missPlan = buildBrollPlan({
      project: branded,
      modelProfileId: 'ci-stub',
      momentsByScene: {},
    })
    const second = await commitBrollPlanToProject(branded, missPlan, {
      confirmSpend: true,
      fillGenerate: () => ({ ok: false, error: 'generator down' }),
    })
    expect(second.ok).toBe(true)
    if (!second.ok) return
    const after = second.project.clips
      .filter((clip) => clip.trackId === BROLL_TRACK_ID)
      .map((clip) => clip.id)
      .sort()
    expect(after).toEqual(before)
    expect(second.rowErrors.some((error) => error.includes('generator down'))).toBe(true)
  })
})
