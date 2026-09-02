import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { listFirstPartyLibraryItems } from './first-party'
import { listLibrary, listProductLibraryItems } from './list'
import { libraryItemFromRow } from './schema'

const migrationSql = readFileSync(
  path.join(process.cwd(), '../../supabase/migrations/0043_studio_library_items.sql'),
  'utf8',
)

describe('studio_library_items migration (#715)', () => {
  it('creates a product-scoped table with service_role only', () => {
    expect(migrationSql).toContain('create table public.studio_library_items')
    expect(migrationSql).toMatch(/'sticker'/)
    expect(migrationSql).toMatch(/'filter'/)
    expect(migrationSql).toMatch(/'effect'/)
    expect(migrationSql).toMatch(/'text_preset'/)
    expect(migrationSql).toMatch(/'caption_preset'/)
    expect(migrationSql).toMatch(/'generated'/)
    expect(migrationSql).toMatch(/'imported'/)
    expect(migrationSql).toMatch(/license_status/)
    expect(migrationSql).toMatch(/commercial_use_allowed/)
    expect(migrationSql).toMatch(/created_by/)
    expect(migrationSql).toMatch(
      /alter table public\.studio_library_items enable row level security/i,
    )
    expect(migrationSql).toMatch(
      /grant select, insert, update, delete on public\.studio_library_items to service_role/i,
    )
    expect(migrationSql).not.toMatch(
      /grant\s+[^;]*on public\.studio_library_items to (authenticated|anon)/i,
    )
    expect(migrationSql).not.toMatch(/demoreader/i)
  })
})

describe('listFirstPartyLibraryItems', () => {
  it('lists in-repo packs without a DB row', () => {
    const items = listFirstPartyLibraryItems()
    expect(items.every((item) => item.source === 'first-party')).toBe(true)
    expect(items.every((item) => item.productId === null)).toBe(true)
    expect(items.map((item) => item.id)).toEqual(
      expect.arrayContaining(['arrow-right', 'vhs', 'shake', 'hook', 'band', 'karaoke']),
    )
  })

  it('filters by kind', () => {
    expect(listFirstPartyLibraryItems('effect').map((item) => item.id)).toEqual([
      'shake',
      'glow',
      'flash',
      'zoom_punch',
    ])
  })
})

describe('libraryItemFromRow', () => {
  it('maps snake_case product rows', () => {
    const item = libraryItemFromRow({
      id: '11111111-1111-4111-8111-111111111111',
      product_id: 'demo',
      kind: 'sticker',
      label: 'the private example badge',
      source: 'imported',
      license_status: 'unknown',
      commercial_use_allowed: false,
      recipe: { stickerId: 'custom' },
      blob_key: 'library/demo/sticker/badge.png',
      created_by: 'import',
      created_at: '2026-08-22T05:00:00.000Z',
    })
    expect(item.productId).toBe('demo')
    expect(item.commercialUseAllowed).toBe(false)
    expect(item.licenseStatus).toBe('unknown')
  })
})

describe('listLibrary', () => {
  it('returns first-party only when supabase is omitted', async () => {
    const items = await listLibrary({ productId: 'demo', kind: 'filter' })
    expect(items.every((item) => item.source === 'first-party')).toBe(true)
    expect(items.map((item) => item.id)).toContain('vhs')
  })

  it('appends product rows after first-party packs', async () => {
    const order = vi.fn(() => ({
      eq: vi.fn(async () => ({
        data: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            product_id: 'demo',
            kind: 'filter',
            label: 'Warmer',
            source: 'generated',
            license_status: 'generated',
            commercial_use_allowed: false,
            recipe: { contrast: 1.1 },
            blob_key: null,
            created_by: 'agent',
            created_at: '2026-08-22T05:00:00.000Z',
          },
        ],
        error: null,
      })),
    }))
    const eqProduct = vi.fn(() => ({ order }))
    const select = vi.fn(() => ({ eq: eqProduct }))
    const from = vi.fn(() => ({ select }))
    const items = await listLibrary({
      supabase: { from } as never,
      productId: 'demo',
      kind: 'filter',
    })
    expect(from).toHaveBeenCalledWith('studio_library_items')
    expect(eqProduct).toHaveBeenCalledWith('product_id', 'demo')
    expect(items.at(-1)?.label).toBe('Warmer')
    expect(items.some((item) => item.id === 'vhs')).toBe(true)
  })

  it('throws when the table query fails', async () => {
    const order = vi.fn(async () => ({ data: null, error: { message: 'permission denied' } }))
    const eq = vi.fn(() => ({ order }))
    const select = vi.fn(() => ({ eq }))
    const from = vi.fn(() => ({ select }))
    await expect(
      listProductLibraryItems({ supabase: { from } as never, productId: 'demo' }),
    ).rejects.toThrow(/permission denied/)
  })
})
