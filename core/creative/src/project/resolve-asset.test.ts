import { describe, expect, it, vi } from 'vitest'
import { createEmptyProject } from './schema'
import { attachAsset } from './operations'
import {
  attachMissingExtractAssets,
  ensureAssetOnProject,
  projectAssetFromRow,
  resolveProjectAsset,
} from './resolve-asset'
import type { ProjectAsset } from './schema'

const LOGO_ID = 'c50a50e0-2dd2-4b1e-8d67-87f893b48301'
const OTHER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const extractLogo = (): ProjectAsset => ({
  id: LOGO_ID,
  kind: 'image',
  blobKey: 'local/marketing-os/okiki-alaso/brand-kit/p/extract/c50a50e0-logo.jpg',
  contentType: 'image/jpeg',
  source: 'upload',
  probe: {
    extract: true,
    role: 'logo',
    sourceUrl: 'https://okikialaso.com/opengraph-image.jpg',
    candidateRole: 'og',
  },
})

const emptyProject = () =>
  createEmptyProject({
    id: 'f200c625-f841-4c79-ae7d-b62e4263ea9a',
    productId: 'okiki-alaso',
  })

describe('projectAssetFromRow', () => {
  it('maps an assets-table extract logo onto ProjectAsset', () => {
    expect(
      projectAssetFromRow({
        id: LOGO_ID,
        kind: 'image',
        blob_key: 'local/marketing-os/okiki-alaso/brand-kit/p/extract/c50a50e0-logo.jpg',
        content_type: 'image/jpeg',
        source: 'upload',
        probe: { extract: true, role: 'logo' },
      }),
    ).toEqual({
      id: LOGO_ID,
      kind: 'image',
      blobKey: 'local/marketing-os/okiki-alaso/brand-kit/p/extract/c50a50e0-logo.jpg',
      contentType: 'image/jpeg',
      source: 'upload',
      probe: { extract: true, role: 'logo' },
    })
  })
})

describe('resolveProjectAsset', () => {
  it('returns the extract logo from project JSON without hitting the table', async () => {
    const project = attachAsset(emptyProject(), extractLogo())
    const from = vi.fn()
    const asset = await resolveProjectAsset({
      supabase: { from } as never,
      project,
      assetId: LOGO_ID,
    })
    expect(asset?.blobKey).toBe(extractLogo().blobKey)
    expect(from).not.toHaveBeenCalled()
  })

  it('falls back to the assets table when extract logo is not on project JSON', async () => {
    const row = {
      id: LOGO_ID,
      kind: 'image',
      blob_key: extractLogo().blobKey,
      content_type: 'image/jpeg',
      source: 'upload',
      probe: extractLogo().probe,
    }
    const maybeSingle = vi.fn(async () => ({ data: row, error: null }))
    const supabase = {
      from: vi.fn(() => ({
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle }),
          }),
        }),
      })),
    }

    const asset = await resolveProjectAsset({
      supabase: supabase as never,
      project: emptyProject(),
      assetId: LOGO_ID,
    })

    expect(asset?.id).toBe(LOGO_ID)
    expect(asset?.contentType).toBe('image/jpeg')
    expect(asset?.probe).toMatchObject({ extract: true, role: 'logo' })
    expect(supabase.from).toHaveBeenCalledWith('assets')
  })

  it('returns null when the asset is on neither the project nor the table', async () => {
    const maybeSingle = vi.fn(async () => ({ data: null, error: null }))
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle }),
          }),
        }),
      }),
    }
    const asset = await resolveProjectAsset({
      supabase: supabase as never,
      project: emptyProject(),
      assetId: OTHER_ID,
    })
    expect(asset).toBeNull()
  })
})

describe('attachMissingExtractAssets', () => {
  it('attaches extract logo and still that are missing from the project', () => {
    const logo = extractLogo()
    const still: ProjectAsset = { ...logo, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }
    const next = attachMissingExtractAssets(emptyProject(), [logo, still, logo])
    expect(next.assets.map((asset) => asset.id)).toEqual([logo.id, still.id])
  })

  it('leaves an already-attached extract logo in place', () => {
    const logo = extractLogo()
    const project = attachAsset(emptyProject(), logo)
    const next = attachMissingExtractAssets(project, [logo])
    expect(next.assets).toHaveLength(1)
    expect(next.assets[0]?.id).toBe(logo.id)
  })
})

describe('ensureAssetOnProject (#441)', () => {
  it('no-ops when the asset is already on project JSON', async () => {
    const project = attachAsset(emptyProject(), extractLogo())
    const from = vi.fn()
    const result = await ensureAssetOnProject({
      supabase: { from } as never,
      project,
      assetId: LOGO_ID,
    })
    expect(result.attached).toBe(false)
    expect(result.project).toBe(project)
    expect(from).not.toHaveBeenCalled()
  })

  it('attaches a product-library row missing from project JSON', async () => {
    const row = {
      id: LOGO_ID,
      kind: 'image',
      blob_key: extractLogo().blobKey,
      content_type: 'image/jpeg',
      source: 'upload',
      probe: extractLogo().probe,
      product_id: 'okiki-alaso',
    }
    const maybeSingle = vi.fn(async () => ({ data: row, error: null }))
    const eqProduct = vi.fn(() => ({ maybeSingle }))
    const eqId = vi.fn(() => ({ eq: eqProduct }))
    const select = vi.fn(() => ({ eq: eqId }))
    const supabase = { from: vi.fn(() => ({ select })) }

    const result = await ensureAssetOnProject({
      supabase: supabase as never,
      project: emptyProject(),
      assetId: LOGO_ID,
    })
    expect(result.attached).toBe(true)
    expect(result.project.assets.some((asset) => asset.id === LOGO_ID)).toBe(true)
    expect(result.asset.blobKey).toBe(extractLogo().blobKey)
  })
})
