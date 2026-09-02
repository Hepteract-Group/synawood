import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runAssetIndexJob } from './run-index'

vi.mock('../persistence/blob', () => ({
  getBlobBytes: vi.fn(async () => Buffer.from('fake-bytes-for-probe!!!!')),
}))

vi.mock('./probe', () => ({
  probeAssetBytes: vi.fn(async () => ({
    durationSeconds: 8,
    width: 1080,
    height: 1920,
    fps: 30,
    videoCodec: 'h264',
    audioCodec: 'aac',
    container: 'mp4',
  })),
}))

vi.mock('../generation-jobs/enqueue', () => ({
  markGenerationJob: vi.fn(async () => ({ id: 'job-1' })),
}))

vi.mock('../pricing/ledger', () => ({
  recordCostEvent: vi.fn(async () => ({ id: 'cost-1' })),
}))

vi.mock('./caption', () => ({
  captionAssetWithVlm: vi.fn(),
}))

vi.mock('./transcript', async () => {
  const actual = await vi.importActual<typeof import('./transcript')>('./transcript')
  return {
    ...actual,
    transcribeAssetForIndex: vi.fn(),
  }
})

vi.mock('./embed', async () => {
  const actual = await vi.importActual<typeof import('./embed')>('./embed')
  return {
    ...actual,
    embedAssetForIndex: vi.fn(),
  }
})

vi.mock('./embed-shot-visual', async () => {
  const actual = await vi.importActual<typeof import('./embed-shot-visual')>('./embed-shot-visual')
  return {
    ...actual,
    embedShotVisualForIndex: vi.fn((...args: Parameters<typeof actual.embedShotVisualForIndex>) =>
      actual.embedShotVisualForIndex(...args),
    ),
  }
})

vi.mock('./write-shot-thumbs', () => ({
  writeShotThumbs: vi.fn(async (input: { shots: Array<{ ordinal: number }> }) => ({
    thumbBlobKeyByOrdinal: Object.fromEntries(
      input.shots.map((shot) => [shot.ordinal, `thumb-${shot.ordinal}`]),
    ),
    thumbNote: null,
  })),
}))

import { captionAssetWithVlm } from './caption'
import { embedAssetForIndex, formatPgVector, mockTextEmbedding } from './embed'
import { embedShotVisualForIndex } from './embed-shot-visual'
import { transcribeAssetForIndex } from './transcript'
import { writeShotThumbs } from './write-shot-thumbs'
import { recordCostEvent } from '../pricing/ledger'
import { mockVisualEmbedding } from '../model-profiles/embed-visual'

const assetId = '11111111-1111-4111-8111-111111111111'
const productId = 'demo'

const readyStateRow = {
  asset_id: assetId,
  product_id: productId,
  status: 'ready',
  stage: 'ready',
  caption: 'A product close-up',
  transcript_excerpt: null,
  last_error: null,
  face_detect_ran: false,
  indexed_at: '2026-08-08T12:00:00.000Z',
  created_at: '2026-08-08T12:00:00.000Z',
  updated_at: '2026-08-08T12:00:00.000Z',
}

const assetRow = {
  id: assetId,
  product_id: productId,
  project_id: '22222222-2222-4222-8222-222222222222',
  kind: 'image' as 'video' | 'image' | 'audio' | 'other',
  blob_key: 'local/demo/uploads/a.jpg',
  content_type: 'image/jpeg',
  probe: { name: 'a.jpg' } as Record<string, unknown>,
}

const queueClient = () => {
  const calls: Array<{ table: string; op: string }> = []
  let indexExists = false
  const shotInserts: unknown[] = []
  const tagInserts: unknown[] = []
  const embeddingInserts: unknown[] = []

  const thenable = (data: unknown = null, error: unknown = null) => ({
    then: (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
      Promise.resolve({ data, error }).then(resolve),
  })

  const from = vi.fn((table: string) => {
    const builder: Record<string, unknown> = {}

    builder.select = vi.fn((cols?: string) => {
      calls.push({ table, op: `select:${cols ?? '*'}` })
      return builder
    })
    builder.insert = vi.fn((rows: unknown) => {
      calls.push({ table, op: 'insert' })
      if (table === 'asset_shots') shotInserts.push(rows)
      if (table === 'asset_tags') tagInserts.push(rows)
      if (table === 'asset_embeddings') embeddingInserts.push(rows)
      if (table === 'asset_shots') {
        const list = (Array.isArray(rows) ? rows : [rows]) as Array<{
          ordinal: number
          start_ms: number
          end_ms: number | null
        }>
        const inserted = list.map((row, i) => ({
          id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, '0')}`,
          ordinal: row.ordinal,
          start_ms: row.start_ms,
          end_ms: row.end_ms,
        }))
        builder.select = vi.fn(() => {
          Object.assign(builder, thenable(inserted, null))
          return builder
        })
        Object.assign(builder, thenable(inserted, null))
        return builder
      }
      Object.assign(builder, thenable(null, null))
      return builder
    })
    builder.update = vi.fn(() => {
      calls.push({ table, op: 'update' })
      return builder
    })
    builder.delete = vi.fn(() => {
      calls.push({ table, op: 'delete' })
      return builder
    })
    builder.eq = vi.fn(() => {
      if (
        table === 'assets' ||
        table === 'asset_shots' ||
        table === 'asset_tags' ||
        table === 'asset_embeddings'
      ) {
        Object.assign(builder, thenable(null, null))
      }
      return builder
    })
    builder.is = vi.fn(() => {
      if (table === 'asset_embeddings') {
        Object.assign(builder, thenable(null, null))
      }
      return builder
    })
    builder.maybeSingle = vi.fn(async () => {
      if (table === 'asset_index_state') {
        return { data: indexExists ? { asset_id: assetId } : null, error: null }
      }
      return { data: null, error: null }
    })
    builder.single = vi.fn(async () => {
      if (table === 'assets') {
        return { data: assetRow, error: null }
      }
      if (table === 'asset_index_state') {
        indexExists = true
        return { data: readyStateRow, error: null }
      }
      return { data: null, error: null }
    })

    return builder
  })

  return { from, calls, shotInserts, tagInserts, embeddingInserts }
}

describe('runAssetIndexJob (#164–#166)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(captionAssetWithVlm).mockResolvedValue({
      skipped: false,
      caption: 'A product close-up',
      tags: ['product', 'close-up'],
    })
    vi.mocked(transcribeAssetForIndex).mockResolvedValue({
      skipped: true,
      reason: 'transcribe skipped: no speech track on image/other assets',
    })
    const embedding = mockTextEmbedding('A product close-up')
    vi.mocked(embedAssetForIndex).mockResolvedValue({
      skipped: false,
      text: {
        modelId: 'mock-embed',
        embedding,
        pgVector: formatPgVector(embedding),
      },
      visualSkippedReason: 'visual embed skipped: no keyframe thumbs yet',
    })
    vi.mocked(writeShotThumbs).mockImplementation(async (input) => ({
      thumbBlobKeyByOrdinal: Object.fromEntries(
        input.shots.map((shot) => [shot.ordinal, `thumb-${shot.ordinal}`]),
      ),
      thumbNote: null,
    }))
  })

  it('probes, writes shots + caption tags + text embed, and marks ready', async () => {
    const supabase = queueClient()
    const result = await runAssetIndexJob({
      supabase: supabase as never,
      blobEnv: {} as never,
      jobId: 'job-1',
      assetId,
      modelProfileId: 'ci-stub',
    })
    expect(result.state.status).toBe('ready')
    expect(result.state.faceDetectRan).toBe(false)
    expect(result.shotCount).toBe(1)
    expect(result.tagCount).toBe(2)
    expect(result.hasTranscript).toBe(false)
    expect(result.hasTextEmbedding).toBe(true)
    expect(result.hasVisualEmbedding).toBe(true)
    expect(supabase.shotInserts[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ordinal: 0,
          thumb_blob_key: 'thumb-0',
        }),
      ]),
    )
    expect(embedAssetForIndex).toHaveBeenCalledTimes(2)
    expect(supabase.embeddingInserts).toHaveLength(3)
    expect(supabase.embeddingInserts[1]).toEqual(
      expect.objectContaining({
        kind: 'text',
        model_id: 'mock-embed',
        shot_id: expect.any(String),
      }),
    )
    expect(supabase.embeddingInserts[2]).toEqual(
      expect.objectContaining({
        kind: 'visual',
        model_id: 'mock-embed-visual',
        shot_id: expect.any(String),
      }),
    )
    expect(embedAssetForIndex).toHaveBeenCalledWith(
      expect.objectContaining({ caption: 'A product close-up', useMock: true }),
    )
  })

  it('sets face_detect_ran when ASSET_FACE_DETECT=true (#176)', async () => {
    const prev = process.env.ASSET_FACE_DETECT
    process.env.ASSET_FACE_DETECT = 'true'
    try {
      const patches: Array<Record<string, unknown>> = []
      const supabase = queueClient()
      const originalFrom = supabase.from
      supabase.from = vi.fn((table: string) => {
        const builder = originalFrom(table) as Record<string, unknown>
        if (table === 'asset_index_state') {
          const originalUpdate = builder.update as (rows: unknown) => unknown
          builder.update = vi.fn((rows: Record<string, unknown>) => {
            patches.push(rows)
            return originalUpdate(rows)
          })
          const originalInsert = builder.insert as (rows: unknown) => unknown
          builder.insert = vi.fn((rows: Record<string, unknown>) => {
            patches.push(rows)
            return originalInsert(rows)
          })
        }
        return builder
      }) as typeof supabase.from

      await runAssetIndexJob({
        supabase: supabase as never,
        blobEnv: {} as never,
        jobId: 'job-1',
        assetId,
        modelProfileId: 'ci-stub',
      })

      expect(patches.some((p) => p.face_detect_ran === true)).toBe(true)
    } finally {
      if (prev === undefined) delete process.env.ASSET_FACE_DETECT
      else process.env.ASSET_FACE_DETECT = prev
    }
  })

  it('soft-fails caption and still marks ready with shots', async () => {
    vi.mocked(captionAssetWithVlm).mockRejectedValue(new Error('VLM down'))
    vi.mocked(embedAssetForIndex).mockResolvedValue({
      skipped: true,
      reason: 'embed skipped: no caption or transcript yet',
    })
    const supabase = queueClient()
    const result = await runAssetIndexJob({
      supabase: supabase as never,
      blobEnv: {} as never,
      jobId: 'job-1',
      assetId,
    })
    expect(result.state.status).toBe('ready')
    expect(result.tagCount).toBe(0)
    expect(result.hasTextEmbedding).toBe(false)
  })

  it('writes transcript excerpt for video after caption', async () => {
    const videoAsset = {
      ...assetRow,
      kind: 'video' as const,
      content_type: 'video/mp4',
      blob_key: 'local/demo/uploads/a.mp4',
      probe: { name: 'a.mp4' },
    }
    Object.assign(assetRow, videoAsset)
    vi.mocked(captionAssetWithVlm).mockResolvedValue({
      skipped: true,
      reason: 'caption skipped: no keyframe image yet',
    })
    vi.mocked(transcribeAssetForIndex).mockResolvedValue({
      skipped: false,
      transcriptExcerpt: 'Edit PDFs without Adobe',
      segments: [{ startMs: 0, endMs: 4_000, text: 'Edit PDFs without Adobe' }],
    })
    const embedding = mockTextEmbedding('Edit PDFs without Adobe')
    vi.mocked(embedAssetForIndex).mockResolvedValue({
      skipped: false,
      text: {
        modelId: 'mock-embed',
        embedding,
        pgVector: formatPgVector(embedding),
      },
      visualSkippedReason: 'visual embed skipped: no keyframe thumbs yet',
    })
    const supabase = queueClient()
    const result = await runAssetIndexJob({
      supabase: supabase as never,
      blobEnv: {} as never,
      jobId: 'job-1',
      assetId,
      modelProfileId: 'ci-stub',
    })
    expect(result.hasTranscript).toBe(true)
    expect(result.hasTextEmbedding).toBe(true)
    expect(result.shotCount).toBe(2)
    expect(result.hasVisualEmbedding).toBe(true)
    expect(
      supabase.embeddingInserts.filter((row) => (row as { kind?: string }).kind === 'visual'),
    ).toHaveLength(2)
    Object.assign(assetRow, {
      kind: 'image',
      content_type: 'image/jpeg',
      blob_key: 'local/demo/uploads/a.jpg',
      probe: { name: 'a.jpg' },
    })
  })

  it('skipPaidStages writes thumbs+text, skips visual, and records the cap reason (#587)', async () => {
    const patches: Array<Record<string, unknown>> = []
    const supabase = queueClient()
    const originalFrom = supabase.from
    supabase.from = vi.fn((table: string) => {
      const builder = originalFrom(table) as Record<string, unknown>
      if (table === 'asset_index_state') {
        const originalUpdate = builder.update as (rows: unknown) => unknown
        builder.update = vi.fn((rows: Record<string, unknown>) => {
          patches.push(rows)
          return originalUpdate(rows)
        })
        const originalInsert = builder.insert as (rows: unknown) => unknown
        builder.insert = vi.fn((rows: Record<string, unknown>) => {
          patches.push(rows)
          return originalInsert(rows)
        })
      }
      return builder
    }) as typeof supabase.from

    const result = await runAssetIndexJob({
      supabase: supabase as never,
      blobEnv: {} as never,
      jobId: 'job-1',
      assetId,
      modelProfileId: 'founder-edit',
      skipPaidStages: true,
    })

    expect(result.state.status).toBe('ready')
    expect(result.shotCount).toBe(1)
    expect(result.tagCount).toBe(0)
    expect(result.hasTextEmbedding).toBe(true)
    expect(result.hasVisualEmbedding).toBe(false)
    expect(captionAssetWithVlm).not.toHaveBeenCalled()
    expect(embedShotVisualForIndex).not.toHaveBeenCalled()
    expect(
      patches.some((p) => typeof p.last_error === 'string' && p.last_error.includes('Paid index')),
    ).toBe(true)
    expect(
      patches.some(
        (p) => typeof p.last_error === 'string' && p.last_error.includes('visual embed skipped'),
      ),
    ).toBe(true)
  })

  it('records embed_visual CostEvent when visual rows write on a paid profile (#587)', async () => {
    const embedding = mockVisualEmbedding('shot')
    vi.mocked(embedShotVisualForIndex).mockResolvedValue({
      skipped: false,
      modelId: 'google/gemini-embedding-2',
      embedding,
      pgVector: formatPgVector(embedding),
    })
    const supabase = queueClient()
    await runAssetIndexJob({
      supabase: supabase as never,
      blobEnv: {} as never,
      jobId: 'job-1',
      assetId,
      modelProfileId: 'founder-edit',
    })
    expect(recordCostEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        role: 'embed_visual',
        modelId: 'google/gemini-embedding-2',
        units: 1,
      }),
    )
  })

  it('soft-fails keyframe extract and still marks ready with shots (#580)', async () => {
    vi.mocked(writeShotThumbs).mockResolvedValue({
      thumbBlobKeyByOrdinal: {},
      thumbNote: 'Keyframe thumbs missing: ffmpeg missing. Retry index.',
    })
    const patches: Array<Record<string, unknown>> = []
    const supabase = queueClient()
    const originalFrom = supabase.from
    supabase.from = vi.fn((table: string) => {
      const builder = originalFrom(table) as Record<string, unknown>
      if (table === 'asset_index_state') {
        const originalUpdate = builder.update as (rows: unknown) => unknown
        builder.update = vi.fn((rows: Record<string, unknown>) => {
          patches.push(rows)
          return originalUpdate(rows)
        })
        const originalInsert = builder.insert as (rows: unknown) => unknown
        builder.insert = vi.fn((rows: Record<string, unknown>) => {
          patches.push(rows)
          return originalInsert(rows)
        })
      }
      return builder
    }) as typeof supabase.from

    const result = await runAssetIndexJob({
      supabase: supabase as never,
      blobEnv: {} as never,
      jobId: 'job-1',
      assetId,
      modelProfileId: 'ci-stub',
    })

    expect(result.state.status).toBe('ready')
    expect(result.shotCount).toBe(1)
    expect(result.hasTextEmbedding).toBe(true)
    expect(result.hasVisualEmbedding).toBe(false)
    expect(
      supabase.embeddingInserts.some((row) => (row as { kind?: string }).kind === 'visual'),
    ).toBe(false)
    expect(supabase.shotInserts[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ordinal: 0,
          thumb_blob_key: null,
        }),
      ]),
    )
    expect(
      patches.some(
        (p) => typeof p.last_error === 'string' && p.last_error.includes('Keyframe thumbs missing'),
      ),
    ).toBe(true)
  })

  it('soft-fails visual embed API errors and keeps text rows (#582)', async () => {
    vi.mocked(embedShotVisualForIndex).mockRejectedValueOnce(new Error('gateway 500'))
    const patches: Array<Record<string, unknown>> = []
    const supabase = queueClient()
    const originalFrom = supabase.from
    supabase.from = vi.fn((table: string) => {
      const builder = originalFrom(table) as Record<string, unknown>
      if (table === 'asset_index_state') {
        const originalUpdate = builder.update as (rows: unknown) => unknown
        builder.update = vi.fn((rows: Record<string, unknown>) => {
          patches.push(rows)
          return originalUpdate(rows)
        })
        const originalInsert = builder.insert as (rows: unknown) => unknown
        builder.insert = vi.fn((rows: Record<string, unknown>) => {
          patches.push(rows)
          return originalInsert(rows)
        })
      }
      return builder
    }) as typeof supabase.from

    const result = await runAssetIndexJob({
      supabase: supabase as never,
      blobEnv: {} as never,
      jobId: 'job-1',
      assetId,
      modelProfileId: 'ci-stub',
    })

    expect(result.state.status).toBe('ready')
    expect(result.hasTextEmbedding).toBe(true)
    expect(result.hasVisualEmbedding).toBe(false)
    expect(
      patches.some(
        (p) => typeof p.last_error === 'string' && p.last_error.includes('visual embed failed'),
      ),
    ).toBe(true)
  })
})
