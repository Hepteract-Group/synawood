import { describe, expect, it, vi } from 'vitest'
import { ASSET_EMBEDDING_DIMS } from './schema'
import {
  ASSET_TEXT_EMBEDDING_MODEL_ID,
  buildEmbedText,
  embedAssetForIndex,
  formatPgVector,
  mockTextEmbedding,
} from './embed'

describe('buildEmbedText', () => {
  it('joins caption and transcript', () => {
    expect(buildEmbedText({ caption: 'A desk', transcriptExcerpt: 'hello world' })).toBe(
      'A desk\n\nhello world',
    )
  })

  it('returns null when both empty', () => {
    expect(buildEmbedText({ caption: null, transcriptExcerpt: '  ' })).toBeNull()
  })
})

describe('mockTextEmbedding', () => {
  it('returns a unit vector of pinned dims', () => {
    const a = mockTextEmbedding('same')
    const b = mockTextEmbedding('same')
    expect(a).toHaveLength(ASSET_EMBEDDING_DIMS)
    expect(a).toEqual(b)
    const norm = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0))
    expect(norm).toBeCloseTo(1, 5)
  })
})

describe('formatPgVector', () => {
  it('formats bracketed pgvector literal', () => {
    const values = mockTextEmbedding('x')
    expect(formatPgVector(values).startsWith('[')).toBe(true)
    expect(formatPgVector(values).endsWith(']')).toBe(true)
  })

  it('rejects wrong dims', () => {
    expect(() => formatPgVector([1, 2, 3])).toThrow(/1536/)
  })
})

describe('embedAssetForIndex', () => {
  it('skips when no caption or transcript', async () => {
    const result = await embedAssetForIndex({ caption: null, transcriptExcerpt: null })
    expect(result).toMatchObject({
      skipped: true,
      reason: expect.stringMatching(/caption|transcript/i),
    })
  })

  it('returns mock text embedding without calling the SDK', async () => {
    const embed = vi.fn()
    const result = await embedAssetForIndex(
      { caption: 'Red sneaker', transcriptExcerpt: null, useMock: true },
      { embed: embed as never },
    )
    expect(embed).not.toHaveBeenCalled()
    expect(result.skipped).toBe(false)
    if (result.skipped) throw new Error('expected embed')
    expect(result.text.embedding).toHaveLength(ASSET_EMBEDDING_DIMS)
    expect(result.visualSkippedReason).toMatch(/deferred|#581/i)
  })

  it('calls embed with the pinned model id for real path', async () => {
    const embedding = mockTextEmbedding('live')
    const embed = vi.fn(async () => ({ embedding }))
    const result = await embedAssetForIndex(
      {
        caption: 'Desk setup',
        transcriptExcerpt: 'edit pdfs',
        modelId: ASSET_TEXT_EMBEDDING_MODEL_ID,
      },
      { embed: embed as never },
    )
    expect(result.skipped).toBe(false)
    expect(embed).toHaveBeenCalledOnce()
    const calls = embed.mock.calls as unknown as Array<[unknown]>
    expect(calls[0]?.[0]).toEqual(
      expect.objectContaining({
        value: 'Desk setup\n\nedit pdfs',
      }),
    )
  })
})
