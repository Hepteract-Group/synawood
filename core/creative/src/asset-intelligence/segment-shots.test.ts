import { describe, expect, it, vi } from 'vitest'
import { attachAsset } from '../project/operations'
import { createEmptyProject } from '../project/schema'
import { MAIN_VIDEO_TRACK_ID } from '../project/tracks'
import { KEYFRAME_THUMBS_MISSING_PREFIX } from './thumbs-missing'
import { placeShotOnProject } from './place-shot'
import { commitSegmentShots, shotsFromSegmentResult } from './segment-shots'

const ASSET_ID = '11111111-1111-4111-8111-111111111111'

describe('segment shots (#588)', () => {
  it('maps event-like Analyze JSON, not uniform 4s tiles', () => {
    const shots = shotsFromSegmentResult({
      shots: [
        { startMs: 0, endMs: 2100, label: 'hook' },
        { startMs: 2100, endMs: 9800, label: 'demo' },
        { startMs: 9800, endMs: 12_000, label: 'cta' },
      ],
    })
    expect(shots.map((shot) => shot.endMs! - shot.startMs)).toEqual([2100, 7700, 2200])
    expect(shots.every((shot) => shot.endMs! - shot.startMs !== 4000)).toBe(true)
  })

  it('skips empty or invalid rows so heuristic shots stay', () => {
    expect(shotsFromSegmentResult({})).toEqual([])
    expect(shotsFromSegmentResult({ shots: [{ startMs: 8, endMs: 2, label: 'bad' }] })).toEqual([])
  })

  it('leaves a placed 2000–4000ms clip trim after new shot bounds exist', async () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
    })
    project = attachAsset(project, {
      id: ASSET_ID,
      kind: 'video',
      blobKey: 'local/talk.mp4',
      source: 'upload',
      probe: { durationFrames: 900 },
    })
    project = placeShotOnProject(project, {
      assetId: ASSET_ID,
      startMs: 2000,
      endMs: 4000,
      trackId: MAIN_VIDEO_TRACK_ID,
    })
    const clip = project.clips[0]!
    const next = shotsFromSegmentResult({
      shots: [{ startMs: 0, endMs: 15_000, label: 'walk' }],
    })
    expect(next[0]?.startMs).toBe(0)
    expect(clip.trim.startFrames).toBe(60)
    expect(clip.durationInFrames).toBe(60)

    const projectBefore = structuredClone(project)
    await commitSegmentShots(
      {
        supabase: {} as never,
        assetId: ASSET_ID,
        productId: 'demo',
        result: { shots: [{ startMs: 0, endMs: 15_000, label: 'walk' }] },
      },
      {
        loadAsset: async () => null,
        loadIndex: async () => ({ caption: null, transcriptExcerpt: null, segments: [] }),
        replaceAssetShots: async (_sb, input) =>
          input.shots.map((shot) => ({
            id: `shot-${shot.ordinal}`,
            ordinal: shot.ordinal,
            startMs: shot.startMs,
            endMs: shot.endMs,
            thumbBlobKey: null,
          })),
        upsertAssetIndexState: async () => ({}) as never,
        replaceAssetEmbedding: async () => undefined,
        clearShotEmbeddings: async () => undefined,
        embedAssetForIndex: async () => ({ skipped: true as const, reason: 'skip' }),
        embedShotVisualForIndex: async () => ({ skipped: true as const, reason: 'skip' }),
      },
    )
    expect(project).toEqual(projectBefore)
    expect(clip.trim.startFrames).toBe(60)
    expect(clip.durationInFrames).toBe(60)
  })

  it('writes thumbs onto the new shots instead of ready+null (#658)', async () => {
    const replaceAssetShots = vi.fn(
      async (
        _sb: unknown,
        input: {
          shots: { ordinal: number; startMs: number; endMs: number | null }[]
          thumbBlobKeyByOrdinal?: Record<number, string>
        },
      ) =>
        input.shots.map((shot) => ({
          id: `shot-${shot.ordinal}`,
          ordinal: shot.ordinal,
          startMs: shot.startMs,
          endMs: shot.endMs,
          thumbBlobKey: input.thumbBlobKeyByOrdinal?.[shot.ordinal] ?? null,
        })),
    )
    const lastState: { status?: string; lastError?: string | null } = {}
    const upsertAssetIndexState = vi.fn(
      async (_sb: unknown, patch: { status?: string; lastError?: string | null }) => {
        Object.assign(lastState, patch)
        return {} as never
      },
    )
    const replaceAssetEmbedding = vi.fn(async () => undefined)
    const writeShotThumbs = vi.fn(async () => ({
      thumbBlobKeyByOrdinal: {
        0: 'local/a/shot-0.jpg',
        1: 'local/a/shot-1.jpg',
        2: 'local/a/shot-2.jpg',
      },
      thumbNote: null,
    }))

    const result = await commitSegmentShots(
      {
        supabase: {} as never,
        assetId: ASSET_ID,
        productId: 'demo',
        blobEnv: {
          connectionString: 'x',
          containerName: 'c',
          useLocalPrefix: true,
        } as never,
        modelProfileId: 'ci-stub',
        result: {
          shots: [
            { startMs: 0, endMs: 2100, label: 'hook' },
            { startMs: 2100, endMs: 9800, label: 'demo' },
            { startMs: 9800, endMs: 12_000, label: 'cta' },
          ],
        },
      },
      {
        loadAsset: async () => ({
          id: ASSET_ID,
          product_id: 'demo',
          kind: 'video',
          blob_key: 'local/talk.mp4',
          content_type: 'video/mp4',
          probe: { name: 'talk.mp4' },
        }),
        loadIndex: async () => ({ caption: 'talk', transcriptExcerpt: 'hello', segments: [] }),
        getBlobBytes: async () => Buffer.from([1, 2, 3, 4]),
        writeShotThumbs: writeShotThumbs as never,
        replaceAssetShots: replaceAssetShots as never,
        upsertAssetIndexState: upsertAssetIndexState as never,
        replaceAssetEmbedding: replaceAssetEmbedding as never,
        clearShotEmbeddings: async () => undefined,
        embedAssetForIndex: async () => ({
          skipped: false as const,
          text: { modelId: 'mock-embed', embedding: [], pgVector: '[0]' },
          visualSkippedReason: '',
        }),
        embedShotVisualForIndex: async () => ({
          skipped: false as const,
          modelId: 'mock-embed-visual',
          embedding: [],
          pgVector: '[0]',
        }),
      },
    )

    expect(result.skipped).toBe(false)
    expect(result.shots.map((shot) => shot.thumbBlobKey)).toEqual([
      'local/a/shot-0.jpg',
      'local/a/shot-1.jpg',
      'local/a/shot-2.jpg',
    ])
    expect(writeShotThumbs).toHaveBeenCalledTimes(1)
    expect(replaceAssetEmbedding).toHaveBeenCalled()
    expect(lastState.status).toBe('ready')
    expect(lastState.lastError).toBeNull()
  })

  it('does not mark ready-without-note when Blob env is missing (#658)', async () => {
    const lastState: { status?: string; lastError?: string | null } = {}
    const upsertAssetIndexState = vi.fn(
      async (_sb: unknown, patch: { status?: string; lastError?: string | null }) => {
        Object.assign(lastState, patch)
        return {} as never
      },
    )
    const replaceAssetShots = vi.fn(async (_sb: unknown, input: { shots: { ordinal: number }[] }) =>
      input.shots.map((shot) => ({
        id: `shot-${shot.ordinal}`,
        ordinal: shot.ordinal,
        startMs: 0,
        endMs: 1000,
        thumbBlobKey: null,
      })),
    )
    await commitSegmentShots(
      {
        supabase: {} as never,
        assetId: ASSET_ID,
        productId: 'demo',
        result: { shots: [{ startMs: 0, endMs: 1000, label: 'hook' }] },
      },
      {
        loadAsset: async () => ({
          id: ASSET_ID,
          product_id: 'demo',
          kind: 'video',
          blob_key: 'local/talk.mp4',
          content_type: 'video/mp4',
          probe: {},
        }),
        loadIndex: async () => ({ caption: null, transcriptExcerpt: null, segments: [] }),
        replaceAssetShots: replaceAssetShots as never,
        upsertAssetIndexState: upsertAssetIndexState as never,
        replaceAssetEmbedding: async () => undefined,
        clearShotEmbeddings: async () => undefined,
        embedAssetForIndex: async () => ({ skipped: true as const, reason: 'skip' }),
        embedShotVisualForIndex: async () => ({ skipped: true as const, reason: 'skip' }),
      },
    )
    expect(lastState.lastError).toContain(KEYFRAME_THUMBS_MISSING_PREFIX)
    expect(lastState.status).toBe('failed')
  })
})
