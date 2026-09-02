import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteBlob } from '../persistence/blob'
import { deleteProductExtract, isDeleteExtractError } from './delete-product-extract'

vi.mock('../persistence/blob', () => ({
  deleteBlob: vi.fn(async () => undefined),
}))

const sampleRow = {
  id: '11111111-1111-4111-8111-111111111111',
  product_id: 'povotra',
  kind: 'screenshot' as const,
  source_url: 'https://povotra.com/',
  blob_key:
    'local/marketing-os/povotra/extract/11111111-1111-4111-8111-111111111111/screenshot.png',
  text: null,
  quality: 'usable' as const,
  quality_note: null,
  job_id: null,
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
}

const blobEnv = {
  connectionString: 'x',
  containerName: 'marketing-os',
  useLocalPrefix: true,
  accountName: 'a',
  accountKey: 'k',
}

const chainGet = (row: Record<string, unknown> | null) => {
  const maybeSingle = vi.fn(async () => ({ data: row, error: null }))
  const eqId = vi.fn(() => ({ maybeSingle }))
  const eqProduct = vi.fn(() => ({ eq: eqId }))
  const select = vi.fn(() => ({ eq: eqProduct }))
  return { select, eqProduct, eqId, maybeSingle }
}

describe('deleteProductExtract (#1367)', () => {
  beforeEach(() => {
    vi.mocked(deleteBlob).mockClear()
  })

  it('deletes the row then the blob for a screenshot', async () => {
    const get = chainGet(sampleRow)
    const delEqId = vi.fn(async () => ({ error: null }))
    const delEqProduct = vi.fn(() => ({ eq: delEqId }))
    const del = vi.fn(() => ({ eq: delEqProduct }))
    const from = vi.fn((table: string) =>
      table === 'product_extracts' ? { select: get.select, delete: del } : {},
    )

    const result = await deleteProductExtract({
      supabase: { from } as never,
      blobEnv,
      productId: 'povotra',
      extractId: sampleRow.id,
    })

    expect(result.extractId).toBe(sampleRow.id)
    expect(delEqProduct).toHaveBeenCalledWith('product_id', 'povotra')
    expect(delEqId).toHaveBeenCalledWith('id', sampleRow.id)
    expect(deleteBlob).toHaveBeenCalledWith({
      blobEnv,
      blobKey: sampleRow.blob_key,
    })
  })

  it('skips blob delete for text extracts', async () => {
    const textRow = { ...sampleRow, kind: 'text' as const, blob_key: null, text: 'copy' }
    const get = chainGet(textRow)
    const delEqId = vi.fn(async () => ({ error: null }))
    const delEqProduct = vi.fn(() => ({ eq: delEqId }))
    const del = vi.fn(() => ({ eq: delEqProduct }))
    const from = vi.fn(() => ({ select: get.select, delete: del }))

    await deleteProductExtract({
      supabase: { from } as never,
      blobEnv,
      productId: 'povotra',
      extractId: sampleRow.id,
    })

    expect(deleteBlob).not.toHaveBeenCalled()
  })

  it('returns 404 when the extract is missing', async () => {
    const get = chainGet(null)
    const from = vi.fn(() => ({ select: get.select, delete: vi.fn() }))

    try {
      await deleteProductExtract({
        supabase: { from } as never,
        blobEnv,
        productId: 'povotra',
        extractId: sampleRow.id,
      })
      expect.unreachable()
    } catch (error) {
      expect(isDeleteExtractError(error)).toBe(true)
      expect((error as { status: number }).status).toBe(404)
    }
    expect(deleteBlob).not.toHaveBeenCalled()
  })
})
