import { describe, expect, it, vi } from 'vitest'
import {
  attachVisualEmbeddingFlags,
  indexingChipLabel,
  listUnindexedAssetIds,
  needsAppearanceIndex,
  summarizeAssetIndexStatuses,
  visitorLibraryError,
  type AssetIndexStatusItem,
} from './index-status'

const item = (
  assetId: string,
  status: AssetIndexStatusItem['status'],
  stage: AssetIndexStatusItem['stage'] = 'queued',
): AssetIndexStatusItem => ({
  assetId,
  status,
  stage,
  lastError: status === 'failed' ? 'boom' : null,
})

describe('listUnindexedAssetIds (#445)', () => {
  it('returns asset ids with no index row', () => {
    expect(
      listUnindexedAssetIds(
        ['a', 'b', 'c'],
        [item('a', 'ready', 'ready'), item('c', 'pending', 'queued')],
      ),
    ).toEqual(['b'])
  })
})

describe('asset index status summary (#173)', () => {
  it('counts ready / failed / active', () => {
    const summary = summarizeAssetIndexStatuses([
      item('a', 'ready', 'ready'),
      item('b', 'indexing', 'caption'),
      item('c', 'pending', 'queued'),
      item('d', 'failed', 'failed'),
    ])
    expect(summary).toEqual({
      total: 4,
      ready: 1,
      failed: 1,
      active: 2,
      softSkipped: 0,
      thumbsMissing: 0,
      visualFailed: 0,
      visualMissing: 0,
      segmenting: 0,
    })
  })

  it('counts soft-skipped ready rows (#458)', () => {
    const summary = summarizeAssetIndexStatuses([
      {
        assetId: 'a',
        status: 'ready',
        stage: 'ready',
        lastError: 'Paid index stages skipped — confirm spend to run caption/embed.',
      },
      item('b', 'ready', 'ready'),
    ])
    expect(summary.ready).toBe(2)
    expect(summary.softSkipped).toBe(1)
    expect(summary.failed).toBe(0)
  })

  it('labels in-flight, failed, and soft-skip chips', () => {
    const base = {
      total: 2,
      ready: 2,
      failed: 0,
      active: 0,
      softSkipped: 0,
      thumbsMissing: 0,
      visualFailed: 0,
      visualMissing: 0,
      segmenting: 0,
    }
    expect(indexingChipLabel({ ...base, total: 5, ready: 2, active: 3 })).toBe('Preparing 2 of 5…')
    expect(indexingChipLabel({ ...base, ready: 1, failed: 1 })).toBe("Couldn't prepare 1 file")
    expect(indexingChipLabel(base)).toBeNull()
    expect(indexingChipLabel({ ...base, softSkipped: 1 })).toBe('1 file skipped extra processing')
    expect(indexingChipLabel({ ...base, thumbsMissing: 1 })).toBe(
      '1 file is missing preview stills',
    )
    expect(indexingChipLabel({ ...base, visualFailed: 1 })).toBe("Couldn't learn how 1 file looks")
    expect(indexingChipLabel({ ...base, total: 5, ready: 2, active: 3, segmenting: 1 })).toBe(
      'Preparing 2 of 5… Finding shots',
    )
    expect(indexingChipLabel({ ...base, total: 4, ready: 1, active: 0, segmenting: 1 })).toBe(
      'Preparing 1 of 4… Finding shots',
    )
  })

  it('maps indexer errors to visitor-facing library copy', () => {
    expect(
      visitorLibraryError(
        'Keyframe thumbs missing: ffmpeg missing. Retry index.',
        'Preview stills didn’t save',
      ),
    ).toBe('Preview stills didn’t save. Retry to generate them.')
    expect(visitorLibraryError('visual embed failed: gateway 500', 'fallback')).toBe(
      "Couldn't match how this file looks.",
    )
    expect(visitorLibraryError('1 asset skipped paid index stages', 'fallback')).toBe(
      'Extra processing was skipped.',
    )
    expect(visitorLibraryError('index worker timeout', "Couldn't prepare this file")).toBe(
      "Couldn't prepare this file",
    )
    expect(visitorLibraryError(null, 'Missing')).toBe('Missing')
  })

  it('counts ready rows with missing keyframe thumbs (#580)', () => {
    const summary = summarizeAssetIndexStatuses([
      {
        assetId: 'a',
        status: 'ready',
        stage: 'ready',
        lastError: 'Keyframe thumbs missing: ffmpeg missing. Retry index.',
      },
      item('b', 'ready', 'ready'),
    ])
    expect(summary.thumbsMissing).toBe(1)
    expect(summary.ready).toBe(2)
  })

  it('counts failed rows with missing keyframe thumbs so the chip stays specific', () => {
    const summary = summarizeAssetIndexStatuses([
      {
        assetId: 'a',
        status: 'failed',
        stage: 'failed',
        lastError: 'Keyframe thumbs missing: ffmpeg missing. Retry index.',
      },
      item('b', 'ready', 'ready'),
    ])
    expect(summary.thumbsMissing).toBe(1)
    expect(summary.failed).toBe(1)
    expect(indexingChipLabel(summary)).toBe('1 file is missing preview stills')
  })

  it('does not count expected no-picture skips as visualFailed (#635)', () => {
    const summary = summarizeAssetIndexStatuses([
      {
        assetId: 'a',
        status: 'ready',
        stage: 'ready',
        lastError:
          'caption skipped: no keyframe image yet (video/audio wait for shot thumbs); visual embed skipped: no keyframe thumb',
      },
      item('b', 'ready', 'ready'),
    ])
    expect(summary.visualFailed).toBe(0)
    expect(summary.ready).toBe(2)
    expect(indexingChipLabel(summary)).toBeNull()
  })

  it('counts ready rows with visual embed failure (#582)', () => {
    const summary = summarizeAssetIndexStatuses([
      {
        assetId: 'a',
        status: 'ready',
        stage: 'ready',
        lastError: 'visual embed failed: gateway 500',
      },
      item('b', 'ready', 'ready'),
    ])
    expect(summary.visualFailed).toBe(1)
    expect(summary.ready).toBe(2)
  })

  it('does not shout Retry on an extract the caption model cannot read (#645)', () => {
    const summary = summarizeAssetIndexStatuses([
      {
        assetId: 'a',
        status: 'ready',
        stage: 'ready',
        lastError:
          'caption failed: The image data you provided does not represent a valid image.; visual embed failed: Provided image is not valid.',
      },
    ])
    expect(summary.visualFailed).toBe(0)
    expect(summary.ready).toBe(1)
    expect(indexingChipLabel(summary)).toBeNull()
  })

  it('counts cap-skip visual as soft-skip, not visualFailed (#587)', () => {
    const summary = summarizeAssetIndexStatuses([
      {
        assetId: 'a',
        status: 'ready',
        stage: 'ready',
        lastError:
          'Paid index stages skipped — confirm spend to run caption and visual embed. visual embed skipped: near spend cap. Retry with confirm spend.',
      },
    ])
    expect(summary.softSkipped).toBe(1)
    expect(summary.visualFailed).toBe(0)
  })

  it('counts ready rows with no visual embedding (#662)', () => {
    const summary = summarizeAssetIndexStatuses([
      { ...item('a', 'ready', 'ready'), hasVisualEmbedding: false },
      { ...item('b', 'ready', 'ready'), hasVisualEmbedding: true },
    ])
    expect(summary.visualMissing).toBe(1)
  })
})

describe('needsAppearanceIndex (#662)', () => {
  it('flags ready index with no visual rows even when lastError is empty', () => {
    expect(
      needsAppearanceIndex({ status: 'ready', lastError: null, hasVisualEmbedding: false }),
    ).toBe(true)
    expect(
      needsAppearanceIndex({ status: 'ready', lastError: null, hasVisualEmbedding: true }),
    ).toBe(false)
  })

  it('flags failed index when keyframe thumbs are missing so Story Retry still shows', () => {
    expect(
      needsAppearanceIndex({
        status: 'failed',
        lastError: 'Keyframe thumbs missing: ffmpeg missing. Retry index.',
      }),
    ).toBe(true)
  })
})

describe('attachVisualEmbeddingFlags (#662)', () => {
  it('marks ready assets without a visual embedding row', async () => {
    const builder: Record<string, unknown> = {}
    builder.select = vi.fn(() => builder)
    builder.eq = vi.fn(() => builder)
    builder.in = vi.fn(() => Promise.resolve({ data: [{ asset_id: 'b' }], error: null }))
    const out = await attachVisualEmbeddingFlags({
      supabase: { from: vi.fn(() => builder) } as never,
      productId: 'demo',
      items: [
        item('a', 'ready', 'ready'),
        item('b', 'ready', 'ready'),
        item('c', 'indexing', 'caption'),
      ],
    })
    expect(out[0]?.hasVisualEmbedding).toBe(false)
    expect(out[1]?.hasVisualEmbedding).toBe(true)
    expect(out[2]?.hasVisualEmbedding).toBeUndefined()
  })
})
