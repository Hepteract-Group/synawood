import { describe, expect, it, vi } from 'vitest'
import { assertOwnedBlobKey } from './assert-blob-key'
import { getProductExtract } from './get-product-extract'
import { insertProductExtract } from './insert-product-extract'
import { listProductExtracts } from './list-product-extracts'
import { productExtractFromRow } from './product-extract-schema'
import { buildBlobKey } from '../persistence/blob-key'

const sampleRow = {
  id: '11111111-1111-4111-8111-111111111111',
  product_id: 'acme',
  kind: 'still' as const,
  source_url: 'https://example.com/about',
  blob_key: 'local/marketing-os/acme/extract/11111111-1111-4111-8111-111111111111/still.png',
  text: null,
  quality: 'usable' as const,
  quality_note: null,
  job_id: '22222222-2222-4222-8222-222222222222',
  created_at: '2026-08-27T00:00:00.000Z',
  updated_at: '2026-08-27T00:00:00.000Z',
}

describe('productExtractFromRow (#1090)', () => {
  it('maps snake_case rows to ProductExtract', () => {
    const extract = productExtractFromRow(sampleRow)
    expect(extract.productId).toBe('acme')
    expect(extract.sourceUrl).toBe('https://example.com/about')
    expect(extract.blobKey).toContain('/extract/')
    expect(extract.jobId).toBe('22222222-2222-4222-8222-222222222222')
  })
})

describe('assertOwnedBlobKey (#1090)', () => {
  it('rejects http(s) hotlinks', () => {
    expect(() => assertOwnedBlobKey('https://cdn.example.com/logo.png')).toThrow(/hotlink/i)
  })

  it('rejects protocol-relative hotlinks', () => {
    expect(() => assertOwnedBlobKey('//cdn.example.com/logo.png')).toThrow(/hotlink/i)
  })

  it('accepts marketing-os blob paths', () => {
    expect(() => assertOwnedBlobKey('local/marketing-os/acme/extract/id/still.png')).not.toThrow()
  })

  it('rejects bare filenames', () => {
    expect(() => assertOwnedBlobKey('still.png')).toThrow(/storage path/i)
  })

  it('allows null or empty keys', () => {
    expect(() => assertOwnedBlobKey(null)).not.toThrow()
    expect(() => assertOwnedBlobKey('')).not.toThrow()
  })
})

describe('buildBlobKey extract kind (#1090)', () => {
  it('places extract bytes under product-scoped prefix', () => {
    const key = buildBlobKey({
      productId: 'acme',
      kind: 'extract',
      parts: ['extract-id', 'still.png'],
      localPrefix: true,
    })
    expect(key).toBe('local/marketing-os/acme/extract/extract-id/still.png')
  })
})

describe('listProductExtracts (#1090)', () => {
  it('lists rows for one product', async () => {
    const order = vi.fn(async () => ({ data: [sampleRow], error: null }))
    const eqProduct = vi.fn(() => ({ order }))
    const select = vi.fn(() => ({ eq: eqProduct }))
    const from = vi.fn(() => ({ select }))
    const extracts = await listProductExtracts({
      supabase: { from } as never,
      productId: 'acme',
    })
    expect(from).toHaveBeenCalledWith('product_extracts')
    expect(eqProduct).toHaveBeenCalledWith('product_id', 'acme')
    expect(extracts).toHaveLength(1)
    expect(extracts[0]?.kind).toBe('still')
  })

  it('filters by quality array, job id, and limit', async () => {
    const limit = vi.fn(async () => ({ data: [sampleRow], error: null }))
    const eqJob = vi.fn(() => ({ limit }))
    const inQuality = vi.fn(() => ({ eq: eqJob }))
    const order = vi.fn(() => ({ in: inQuality }))
    const eqProduct = vi.fn(() => ({ order }))
    const select = vi.fn(() => ({ eq: eqProduct }))
    const from = vi.fn(() => ({ select }))
    const extracts = await listProductExtracts({
      supabase: { from } as never,
      productId: 'acme',
      quality: ['usable', 'weak'],
      jobId: sampleRow.job_id!,
      limit: 5,
    })
    expect(inQuality).toHaveBeenCalledWith('quality', ['usable', 'weak'])
    expect(eqJob).toHaveBeenCalledWith('job_id', sampleRow.job_id)
    expect(limit).toHaveBeenCalledWith(5)
    expect(extracts).toHaveLength(1)
  })

  it('filters by a single quality value', async () => {
    const inQuality = vi.fn(async () => ({ data: [], error: null }))
    const order = vi.fn(() => ({ in: inQuality }))
    const eqProduct = vi.fn(() => ({ order }))
    const select = vi.fn(() => ({ eq: eqProduct }))
    const from = vi.fn(() => ({ select }))
    await listProductExtracts({
      supabase: { from } as never,
      productId: 'acme',
      quality: 'reject',
    })
    expect(inQuality).toHaveBeenCalledWith('quality', ['reject'])
  })

  it('throws when the list query fails', async () => {
    const order = vi.fn(async () => ({ data: null, error: { message: 'boom' } }))
    const eqProduct = vi.fn(() => ({ order }))
    const select = vi.fn(() => ({ eq: eqProduct }))
    const from = vi.fn(() => ({ select }))
    await expect(
      listProductExtracts({
        supabase: { from } as never,
        productId: 'acme',
      }),
    ).rejects.toThrow(/Failed to list product extracts/)
  })
})

describe('getProductExtract (#1090)', () => {
  it('returns null when the row is missing', async () => {
    const maybeSingle = vi.fn(async () => ({ data: null, error: null }))
    const eqId = vi.fn(() => ({ maybeSingle }))
    const eqProduct = vi.fn(() => ({ eq: eqId }))
    const select = vi.fn(() => ({ eq: eqProduct }))
    const from = vi.fn(() => ({ select }))
    const extract = await getProductExtract({
      supabase: { from } as never,
      productId: 'acme',
      extractId: sampleRow.id,
    })
    expect(extract).toBeNull()
  })

  it('returns a mapped row when present', async () => {
    const maybeSingle = vi.fn(async () => ({ data: sampleRow, error: null }))
    const eqId = vi.fn(() => ({ maybeSingle }))
    const eqProduct = vi.fn(() => ({ eq: eqId }))
    const select = vi.fn(() => ({ eq: eqProduct }))
    const from = vi.fn(() => ({ select }))
    const extract = await getProductExtract({
      supabase: { from } as never,
      productId: 'acme',
      extractId: sampleRow.id,
    })
    expect(extract?.id).toBe(sampleRow.id)
  })

  it('throws when the load query fails', async () => {
    const maybeSingle = vi.fn(async () => ({ data: null, error: { message: 'db down' } }))
    const eqId = vi.fn(() => ({ maybeSingle }))
    const eqProduct = vi.fn(() => ({ eq: eqId }))
    const select = vi.fn(() => ({ eq: eqProduct }))
    const from = vi.fn(() => ({ select }))
    await expect(
      getProductExtract({
        supabase: { from } as never,
        productId: 'acme',
        extractId: sampleRow.id,
      }),
    ).rejects.toThrow(/Failed to load product extract/)
  })
})

describe('insertProductExtract (#1090)', () => {
  it('inserts a still with an owned blob key', async () => {
    const single = vi.fn(async () => ({ data: sampleRow, error: null }))
    const select = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select }))
    const from = vi.fn(() => ({ insert }))
    const extract = await insertProductExtract({
      supabase: { from } as never,
      productId: 'acme',
      kind: 'still',
      sourceUrl: 'https://example.com/about',
      blobKey: sampleRow.blob_key,
    })
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: 'acme',
        kind: 'still',
        blob_key: sampleRow.blob_key,
      }),
    )
    expect(extract.id).toBe(sampleRow.id)
  })

  it('rejects hotlink blob keys', async () => {
    await expect(
      insertProductExtract({
        supabase: { from: vi.fn() } as never,
        productId: 'acme',
        kind: 'still',
        sourceUrl: 'https://example.com',
        blobKey: 'https://cdn.example.com/still.png',
      }),
    ).rejects.toThrow(/hotlink/i)
  })

  it('requires text for text extracts', async () => {
    await expect(
      insertProductExtract({
        supabase: { from: vi.fn() } as never,
        productId: 'acme',
        kind: 'text',
        sourceUrl: 'https://example.com/about',
      }),
    ).rejects.toThrow(/text/i)
  })

  it('inserts text extracts without a blob key', async () => {
    const textRow = {
      ...sampleRow,
      kind: 'text' as const,
      blob_key: null,
      text: 'About us copy',
    }
    const single = vi.fn(async () => ({ data: textRow, error: null }))
    const select = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select }))
    const from = vi.fn(() => ({ insert }))
    const extract = await insertProductExtract({
      supabase: { from } as never,
      productId: 'acme',
      kind: 'text',
      sourceUrl: 'https://example.com/about',
      text: 'About us copy',
    })
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'text', blob_key: null, text: 'About us copy' }),
    )
    expect(extract.text).toBe('About us copy')
  })
})

describe('product extract tenancy (#1090)', () => {
  it('scopes get/list queries by product_id so cross-product reads fail at RLS', async () => {
    const maybeSingle = vi.fn(async () => ({ data: null, error: null }))
    const eqId = vi.fn(() => ({ maybeSingle }))
    const eqProduct = vi.fn(() => ({ eq: eqId }))
    const select = vi.fn(() => ({ eq: eqProduct }))
    const from = vi.fn(() => ({ select }))
    await getProductExtract({
      supabase: { from } as never,
      productId: 'other-product',
      extractId: sampleRow.id,
    })
    expect(eqProduct).toHaveBeenCalledWith('product_id', 'other-product')
  })
})
