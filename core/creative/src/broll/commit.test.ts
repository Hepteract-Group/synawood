import { describe, expect, it } from 'vitest'
import { createEmptyProject } from '../project/schema'
import { addClip, attachAsset } from '../project/operations'
import { BROLL_TRACK_ID, MAIN_VIDEO_TRACK_ID } from '../project/tracks'
import { buildBrollPlan } from './assemble'
import { commitBrollPlanToProject, placeGeneratedFill } from './commit'
import type { MomentHit } from '../asset-intelligence/moments'
import type { BrollPlan } from './schema'

const ASSET_ID = '11111111-1111-4111-8111-111111111111'
const SHOT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SHOT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const scene = (id: string, role: 'hook' | 'proof', locked = false) => ({
  id,
  role,
  label: role,
  clipIds: [] as string[],
  overlayIds: [] as string[],
  locked,
  targetDurationFrames: 90,
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

describe('commitBrollPlanToProject (#519)', () => {
  it('fails closed when estimate > £0 without confirmSpend', async () => {
    const project = projectWithLibrary()
    const plan = buildBrollPlan({
      project,
      modelProfileId: 'founder-edit',
      momentsByScene: {
        sc_hook: [hit(SHOT_A)],
        sc_proof: [hit(SHOT_B)],
      },
    })
    expect(plan.estimatedGbp).toBeGreaterThan(0)
    const clipsBefore = JSON.stringify(project.clips)
    const result = await commitBrollPlanToProject(project, plan, { confirmSpend: false })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/confirmSpend/)
    expect(JSON.stringify(project.clips)).toBe(clipsBefore)
  })

  it('places library moments on track_broll and assigns them to scenes', async () => {
    const project = projectWithLibrary()
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
    expect(result.placedClipIds).toHaveLength(2)
    const broll = result.project.clips.filter((clip) => clip.trackId === BROLL_TRACK_ID)
    expect(broll).toHaveLength(2)
    const hook = result.project.scenes.find((item) => item.id === 'sc_hook')
    const proof = result.project.scenes.find((item) => item.id === 'sc_proof')
    expect(hook?.clipIds).toEqual(expect.arrayContaining([result.placedClipIds[0]]))
    expect(proof?.clipIds).toEqual(expect.arrayContaining([result.placedClipIds[1]]))
    expect(result.plan.status).toBe('applied')
  })

  it('skips locked scenes and keeps already-placed library shots if a later row fails', async () => {
    const project = {
      ...projectWithLibrary(),
      scenes: [scene('sc_hook', 'hook'), scene('sc_proof', 'proof', true)],
    }
    const plan = buildBrollPlan({
      project,
      modelProfileId: 'ci-stub',
      momentsByScene: {
        sc_hook: [hit(SHOT_A)],
        sc_proof: [hit(SHOT_B)],
      },
    })
    const broken: BrollPlan = {
      ...plan,
      rows: [
        ...plan.rows.filter((row) => row.kind === 'moment'),
        {
          kind: 'generate',
          id: 'generate_fail',
          sceneId: 'sc_missing',
          media: 'video',
          prompt: 'unmatched',
          durationSeconds: 4,
          estimatedGbp: 0,
        },
      ],
    }
    const result = await commitBrollPlanToProject(project, broken, { confirmSpend: true })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.placedClipIds).toHaveLength(1)
    expect(result.skippedLocked).toContain('sc_proof')
    expect(result.pendingGenerate).toBe(1)
    expect(result.project.clips.filter((clip) => clip.trackId === BROLL_TRACK_ID)).toHaveLength(1)
  })

  it('fills a generate miss without rolling back library shots', async () => {
    const stillId = '33333333-3333-4333-8333-333333333333'
    const project = {
      ...projectWithLibrary(),
      brand: { productId: 'demo', stillAssetId: stillId },
    }
    const plan = buildBrollPlan({
      project,
      modelProfileId: 'ci-stub',
      momentsByScene: { sc_proof: [hit(SHOT_B)] },
    })
    const fillId = '55555555-5555-4555-8555-555555555555'
    const result = await commitBrollPlanToProject(project, plan, {
      confirmSpend: true,
      fillGenerate: ({ project: current, from, until }) => {
        const withAsset = attachAsset(current, {
          id: fillId,
          kind: 'video',
          blobKey: `memory/${fillId}.mp4`,
          source: 'generator',
          probe: { durationFrames: 120 },
        })
        return placeGeneratedFill(withAsset, {
          assetId: fillId,
          durationInFrames: 120,
          from,
          until,
        })
      },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.pendingGenerate).toBe(0)
    expect(result.placedClipIds.length).toBeGreaterThanOrEqual(2)
    expect(
      result.project.clips.filter((clip) => clip.trackId === BROLL_TRACK_ID).length,
    ).toBeGreaterThanOrEqual(2)
  })

  it('places a music bed on the audio track without touching B-roll', async () => {
    const project = projectWithLibrary()
    const plan = buildBrollPlan({
      project,
      modelProfileId: 'ci-stub',
      momentsByScene: {
        sc_hook: [hit(SHOT_A)],
        sc_proof: [hit(SHOT_B)],
      },
    })
    expect(plan.rows.some((row) => row.kind === 'music')).toBe(true)
    const musicId = '66666666-6666-4666-8666-666666666666'
    const brollBefore = 2
    const result = await commitBrollPlanToProject(project, plan, {
      confirmSpend: true,
      fillMusic: ({ project: current, row }) => {
        const withAsset = attachAsset(current, {
          id: musicId,
          kind: 'audio',
          blobKey: `memory/${musicId}.mp3`,
          source: 'generator',
          probe: { durationFrames: Math.round(row.durationSeconds * 30) },
        })
        const before = new Set(withAsset.clips.map((clip) => clip.id))
        const placed = addClip(withAsset, {
          assetId: musicId,
          durationInFrames: Math.max(1, Math.round(row.durationSeconds * 30)),
        })
        const clip = placed.clips.find((item) => !before.has(item.id))
        if (!clip) return { ok: false, error: 'no music clip' }
        return { ok: true, project: placed, clipId: clip.id }
      },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.pendingMusic).toBe(0)
    expect(result.project.clips.filter((clip) => clip.trackId === BROLL_TRACK_ID)).toHaveLength(
      brollBefore,
    )
    const audio = result.project.clips.filter((clip) => clip.trackId === 'track_audio')
    expect(audio).toHaveLength(1)
    expect(audio[0]?.assetId).toBe(musicId)
  })

  it('places a library still on track_broll', async () => {
    const stillId = '33333333-3333-4333-8333-333333333333'
    const project = {
      ...projectWithLibrary(),
      assets: [
        ...projectWithLibrary().assets,
        {
          id: stillId,
          kind: 'image' as const,
          blobKey: 'local/still.png',
          source: 'upload' as const,
          probe: {},
        },
      ],
      scenes: [scene('sc_hook', 'hook')],
    }
    const plan = buildBrollPlan({
      project,
      modelProfileId: 'founder-edit',
      momentsByScene: {},
    })
    const stillRows = plan.rows.filter((row) => row.kind === 'still')
    expect(stillRows).toHaveLength(1)
    const result = await commitBrollPlanToProject(project, plan, {
      confirmSpend: true,
      fillGenerate: ({ project: current, row, from, until }) =>
        placeGeneratedFill(current, {
          assetId: row.sourceImageAssetId ?? stillId,
          durationInFrames: 120,
          from,
          until,
        }),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.pendingGenerate).toBe(0)
    const broll = result.project.clips.filter((clip) => clip.trackId === BROLL_TRACK_ID)
    expect(broll).toHaveLength(1)
    expect(broll[0]?.assetId).toBe(stillId)
  })
})
