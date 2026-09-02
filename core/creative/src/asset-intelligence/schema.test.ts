import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  ASSET_EMBEDDING_DIMS,
  assetIndexStateFromRow,
  parseAssetEmbeddingMeta,
  parseAssetIndexState,
  parseAssetShot,
  parseAssetTag,
} from './schema'

const migrationSql = readFileSync(
  path.join(process.cwd(), '../../supabase/migrations/0020_asset_intelligence.sql'),
  'utf8',
)

describe('asset intelligence schema (#163)', () => {
  it('pins embedding dims at 1536', () => {
    expect(ASSET_EMBEDDING_DIMS).toBe(1536)
    expect(migrationSql).toContain('vector(1536)')
  })

  it('migration enables vector + four tables with service_role RLS', () => {
    expect(migrationSql).toMatch(/create extension if not exists vector/i)
    expect(migrationSql).toContain('create table public.asset_index_state')
    expect(migrationSql).toContain('create table public.asset_shots')
    expect(migrationSql).toContain('create table public.asset_tags')
    expect(migrationSql).toContain('create table public.asset_embeddings')
    expect(migrationSql).toMatch(/alter table public\.asset_index_state enable row level security/i)
    expect(migrationSql).toMatch(
      /grant select, insert, update, delete on public\.asset_embeddings to service_role/i,
    )
    expect(migrationSql).not.toMatch(
      /grant\s+[^;]*on public\.asset_index_state to (authenticated|anon)/i,
    )
    expect(migrationSql).not.toMatch(/create policy[\s\S]*asset_index_state/i)
  })

  it('parses index state and maps DB rows', () => {
    const state = parseAssetIndexState({
      assetId: '11111111-1111-4111-8111-111111111111',
      productId: 'demo',
      status: 'ready',
      stage: 'ready',
      caption: 'Product close-up',
      transcriptExcerpt: null,
      lastError: null,
      faceDetectRan: false,
      indexedAt: '2026-08-08T12:00:00.000Z',
      createdAt: '2026-08-08T11:00:00.000Z',
      updatedAt: '2026-08-08T12:00:00.000Z',
    })
    expect(state.caption).toBe('Product close-up')

    const fromRow = assetIndexStateFromRow({
      asset_id: '11111111-1111-4111-8111-111111111111',
      product_id: 'demo',
      status: 'pending',
      stage: 'queued',
      caption: null,
      transcript_excerpt: null,
      last_error: null,
      face_detect_ran: false,
      indexed_at: null,
      created_at: '2026-08-08T11:00:00.000Z',
      updated_at: '2026-08-08T11:00:00.000Z',
    })
    expect(fromRow.status).toBe('pending')
    expect(fromRow.indexedAt).toBeNull()
    expect(fromRow.transcriptSegments).toEqual([])
  })

  it('maps Supabase +00:00 timestamps (upload 500 regression #438)', () => {
    const fromRow = assetIndexStateFromRow({
      asset_id: '11111111-1111-4111-8111-111111111111',
      product_id: 'okiki-alaso',
      status: 'pending',
      stage: 'queued',
      caption: null,
      transcript_excerpt: null,
      last_error: null,
      face_detect_ran: false,
      indexed_at: null,
      created_at: '2026-08-16T12:48:56.482+00:00',
      updated_at: '2026-08-16T12:48:56.482+00:00',
    })
    expect(fromRow.createdAt).toBe('2026-08-16T12:48:56.482Z')
    expect(fromRow.updatedAt).toBe('2026-08-16T12:48:56.482Z')
  })

  it('rejects shots with end before start', () => {
    expect(() =>
      parseAssetShot({
        id: '22222222-2222-4222-8222-222222222222',
        assetId: '11111111-1111-4111-8111-111111111111',
        productId: 'demo',
        ordinal: 0,
        startMs: 1000,
        endMs: 500,
        thumbBlobKey: null,
        createdAt: '2026-08-08T11:00:00.000Z',
      }),
    ).toThrow(/endMs/)
  })

  it('parses tags and embedding metadata', () => {
    expect(
      parseAssetTag({
        assetId: '11111111-1111-4111-8111-111111111111',
        productId: 'demo',
        tag: 'product',
        source: 'caption',
        createdAt: '2026-08-08T11:00:00.000Z',
      }).tag,
    ).toBe('product')

    expect(
      parseAssetEmbeddingMeta({
        id: '33333333-3333-4333-8333-333333333333',
        assetId: '11111111-1111-4111-8111-111111111111',
        productId: 'demo',
        shotId: null,
        kind: 'text',
        modelId: 'text-embedding-3-small',
        dims: ASSET_EMBEDDING_DIMS,
        createdAt: '2026-08-08T11:00:00.000Z',
      }).dims,
    ).toBe(1536)
  })
})
