import { describe, expect, it } from 'vitest'
import { createEmptyProject } from '../project/schema'
import { buildBrollPlan, BRAND_REQUIRED_COPY, VIDEO_PROFILE_SWITCH_COPY } from './assemble'
import type { MomentHit } from '../asset-intelligence/moments'

const scene = (id: string, role: 'hook' | 'proof' | 'cta', frames = 120) => ({
  id,
  role,
  label: role,
  clipIds: [] as string[],
  overlayIds: [] as string[],
  locked: false,
  targetDurationFrames: frames,
})

const momentHit = (shotId: string, score = 8): MomentHit => ({
  assetId: '11111111-1111-4111-8111-111111111111',
  shotId,
  startMs: 1000,
  endMs: 3000,
  score,
  caption: 'export close-up',
  transcriptExcerpt: 'export pdf',
  tags: ['export'],
})

const projectWithScenes = () => {
  const project = createEmptyProject({
    id: '22222222-2222-4222-8222-222222222222',
    productId: 'demo',
  })
  return {
    ...project,
    intent: { ...project.intent, lengthSeconds: 30, keywords: ['export'] },
    scenes: [scene('sc_hook', 'hook'), scene('sc_proof', 'proof'), scene('sc_cta', 'cta')],
  }
}

describe('buildBrollPlan (#518)', () => {
  it('empty library → all generate-to-fill (plus music)', () => {
    const project = projectWithScenes()
    const clipsBefore = JSON.stringify(project.clips)
    const plan = buildBrollPlan({
      project,
      modelProfileId: 'ci-stub',
      momentsByScene: {},
    })
    expect(JSON.stringify(project.clips)).toBe(clipsBefore)
    expect(plan.rows.filter((row) => row.kind === 'generate')).toHaveLength(3)
    expect(plan.rows.filter((row) => row.kind === 'moment')).toHaveLength(0)
    expect(plan.rows.some((row) => row.kind === 'music')).toBe(true)
    expect(plan.status).toBe('draft')
    expect(plan.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  it('full library → moment rows and no generate', () => {
    const project = projectWithScenes()
    const plan = buildBrollPlan({
      project,
      modelProfileId: 'ci-stub',
      momentsByScene: {
        sc_hook: [momentHit('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')],
        sc_proof: [momentHit('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')],
        sc_cta: [momentHit('cccccccc-cccc-4ccc-8ccc-cccccccccccc')],
      },
    })
    expect(plan.rows.filter((row) => row.kind === 'moment')).toHaveLength(3)
    expect(plan.rows.filter((row) => row.kind === 'generate')).toHaveLength(0)
    expect(plan.rationale).toMatch(/from your library/)
  })

  it('founder-edit generate rows fail closed without brand, then switch-profile with brand', () => {
    const project = projectWithScenes()
    const noBrand = buildBrollPlan({
      project,
      modelProfileId: 'founder-edit',
      momentsByScene: {},
    })
    const generate = noBrand.rows.filter((row) => row.kind === 'generate' || row.kind === 'still')
    expect(generate.length).toBeGreaterThan(0)
    expect(generate.every((row) => row.blockedReason === BRAND_REQUIRED_COPY)).toBe(true)

    const branded = buildBrollPlan({
      project: {
        ...project,
        brand: { productId: 'demo', stillAssetId: '11111111-1111-4111-8111-111111111111' },
      },
      modelProfileId: 'founder-edit',
      momentsByScene: {},
    })
    const blocked = branded.rows.filter((row) => row.kind === 'generate' || row.kind === 'still')
    expect(blocked.every((row) => row.kind === 'still')).toBe(true)
    expect(blocked.every((row) => row.blockedReason === VIDEO_PROFILE_SWITCH_COPY)).toBe(true)
  })

  it('skips music when the audio track already has a clip', () => {
    const project = projectWithScenes()
    const withAudio = {
      ...project,
      clips: [
        {
          id: 'clip_audio',
          trackId: 'track_audio',
          assetId: '11111111-1111-4111-8111-111111111111',
          from: 0,
          durationInFrames: 90,
          trim: { startFrames: 0 },
        },
      ],
    }
    const plan = buildBrollPlan({
      project: withAudio,
      modelProfileId: 'ci-stub',
      momentsByScene: {},
    })
    expect(plan.rows.some((row) => row.kind === 'music')).toBe(false)
  })

  it('reuses a library still without generate spend', () => {
    const stillId = '33333333-3333-4333-8333-333333333333'
    const project = {
      ...projectWithScenes(),
      assets: [
        {
          id: stillId,
          kind: 'image' as const,
          blobKey: 'local/still.png',
          source: 'upload' as const,
          probe: {},
        },
      ],
    }
    const plan = buildBrollPlan({
      project,
      modelProfileId: 'founder-edit',
      momentsByScene: {},
    })
    const stills = plan.rows.filter((row) => row.kind === 'still')
    expect(stills.length).toBeGreaterThan(0)
    expect(stills.every((row) => row.kind === 'still' && row.sourceImageAssetId === stillId)).toBe(
      true,
    )
    expect(stills.every((row) => row.kind === 'still' && !row.blockedReason)).toBe(true)
    expect(stills.every((row) => row.kind === 'still' && row.estimatedGbp === 0)).toBe(true)
  })

  it('skips music on VO-only talking-head without a 30s+ intent', () => {
    const project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    const plan = buildBrollPlan({
      project,
      modelProfileId: 'ci-stub',
      momentsByScene: {},
    })
    expect(plan.rows.some((row) => row.kind === 'music')).toBe(false)
  })

  it('library hit on proof suppresses generate for that beat; miss is ≤4s', () => {
    const project = {
      ...projectWithScenes(),
      brand: { productId: 'demo', stillAssetId: '11111111-1111-4111-8111-111111111111' },
      scenes: [scene('sc_hook', 'hook', 600), scene('sc_proof', 'proof', 600)],
    }
    const plan = buildBrollPlan({
      project,
      modelProfileId: 'ci-stub',
      momentsByScene: {
        sc_proof: [momentHit('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')],
      },
    })
    const generate = plan.rows.filter((row) => row.kind === 'generate')
    const moments = plan.rows.filter((row) => row.kind === 'moment')
    expect(moments.some((row) => row.kind === 'moment' && row.sceneId === 'sc_proof')).toBe(true)
    expect(generate.some((row) => row.kind === 'generate' && row.sceneId === 'sc_proof')).toBe(
      false,
    )
    expect(generate.some((row) => row.kind === 'generate' && row.sceneId === 'sc_hook')).toBe(true)
    expect(
      generate.every((row) => row.kind !== 'generate' || (row.durationSeconds ?? 0) <= 4),
    ).toBe(true)
    expect(
      generate.every(
        (row) =>
          row.kind !== 'generate' ||
          row.sourceImageAssetId === '11111111-1111-4111-8111-111111111111',
      ),
    ).toBe(true)
  })
})
