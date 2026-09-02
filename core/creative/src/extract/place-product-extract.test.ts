import { describe, expect, it, vi } from 'vitest'
import { createEmptyProject } from '../project/schema'
import { BROLL_TRACK_ID, MAIN_VIDEO_TRACK_ID } from '../project/tracks'
import type { ProductExtract } from './product-extract-schema'
import { isPlaceExtractError, placeProductExtractOnProject } from './place-product-extract'

const EXTRACT_ID = '11111111-1111-4111-8111-111111111111'
const PROJECT_ID = 'f200c625-f841-4c79-ae7d-b62e4263ea9a'
const OWNED_KEY = `local/marketing-os/acme/extract/${EXTRACT_ID}/still.png`

const still = (overrides: Partial<ProductExtract> = {}): ProductExtract => ({
  id: EXTRACT_ID,
  productId: 'acme',
  kind: 'still',
  sourceUrl: 'https://example.com/pricing',
  blobKey: OWNED_KEY,
  quality: 'usable',
  createdAt: '2026-08-31T00:00:00.000Z',
  updatedAt: '2026-08-31T00:00:00.000Z',
  ...overrides,
})

const projectOf = (compositionId?: 'talking-head-60' | 'authored') =>
  createEmptyProject({
    id: PROJECT_ID,
    productId: 'acme',
    compositionId,
  })

const mockInsertOk = () => {
  const insert = vi.fn(async () => ({ error: null }))
  const from = vi.fn(() => ({ insert }))
  return { supabase: { from } as never, insert, from }
}

describe('placeProductExtractOnProject (#1096)', () => {
  it('places a clip that uses the extract Blob key, never the source URL', async () => {
    const { supabase, insert } = mockInsertOk()
    const { project, asset, clipId } = await placeProductExtractOnProject({
      supabase,
      project: projectOf(),
      extractId: EXTRACT_ID,
      deps: { getExtract: async () => still() },
    })
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ blob_key: OWNED_KEY, kind: 'image' }),
    )
    expect(asset.blobKey).toBe(OWNED_KEY)
    expect(asset.blobKey).not.toMatch(/^https?:/i)
    expect(asset.blobKey).not.toBe('https://example.com/pricing')
    expect(asset.probe.productExtractId).toBe(EXTRACT_ID)
    const clip = project.clips.find((item) => item.id === clipId)
    expect(clip?.assetId).toBe(asset.id)
    expect(clip?.trackId).toBe(MAIN_VIDEO_TRACK_ID)
  })

  it('places a rejected still (operator override)', async () => {
    const { supabase } = mockInsertOk()
    const { asset } = await placeProductExtractOnProject({
      supabase,
      project: projectOf(),
      extractId: EXTRACT_ID,
      deps: { getExtract: async () => still({ quality: 'reject' }) },
    })
    expect(asset.probe.quality).toBe('reject')
    expect(asset.blobKey).toBe(OWNED_KEY)
  })

  it('puts the still on overlay, not MAIN, for authored motion', async () => {
    const { supabase } = mockInsertOk()
    const { project, clipId } = await placeProductExtractOnProject({
      supabase,
      project: projectOf('authored'),
      extractId: EXTRACT_ID,
      deps: { getExtract: async () => still() },
    })
    expect(project.clips.find((item) => item.id === clipId)?.trackId).toBe(BROLL_TRACK_ID)
    expect(project.clips.some((item) => item.trackId === MAIN_VIDEO_TRACK_ID)).toBe(false)
  })

  it('refuses text extracts and hotlink blob keys', async () => {
    await expect(
      placeProductExtractOnProject({
        supabase: { from: vi.fn() } as never,
        project: projectOf(),
        extractId: EXTRACT_ID,
        deps: {
          getExtract: async () => still({ kind: 'text', blobKey: undefined, text: 'About' }),
        },
      }),
    ).rejects.toThrow(/Text extracts/)

    await expect(
      placeProductExtractOnProject({
        supabase: { from: vi.fn() } as never,
        project: projectOf(),
        extractId: EXTRACT_ID,
        deps: {
          getExtract: async () => still({ blobKey: 'https://cdn.example.com/still.png' }),
        },
      }),
    ).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/hotlink/i) })
  })

  it('returns 404-shaped errors when the extract is missing', async () => {
    try {
      await placeProductExtractOnProject({
        supabase: { from: vi.fn() } as never,
        project: projectOf(),
        extractId: EXTRACT_ID,
        deps: { getExtract: async () => null },
      })
      throw new Error('expected throw')
    } catch (error) {
      expect(isPlaceExtractError(error)).toBe(true)
      expect((error as { status: number }).status).toBe(404)
    }
  })

  it('reuses a project asset already bound to this extract', async () => {
    const first = await placeProductExtractOnProject({
      supabase: mockInsertOk().supabase,
      project: projectOf(),
      extractId: EXTRACT_ID,
      deps: { getExtract: async () => still() },
    })
    const insert = vi.fn()
    const second = await placeProductExtractOnProject({
      supabase: { from: vi.fn(() => ({ insert })) } as never,
      project: first.project,
      extractId: EXTRACT_ID,
      deps: { getExtract: async () => still() },
    })
    expect(insert).not.toHaveBeenCalled()
    expect(second.asset.id).toBe(first.asset.id)
    expect(second.project.clips).toHaveLength(2)
  })
})
