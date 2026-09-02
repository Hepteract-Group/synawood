import { describe, expect, it, vi } from 'vitest'
import { createEmptyProject } from '../project/schema'
import {
  assertProjectLibraryLicensesPublishable,
  collectProjectLibraryItemIds,
  isLibraryItemPublishable,
} from './license'

const withLibraryRefs = () => {
  const project = createEmptyProject({
    id: '22222222-2222-4222-8222-222222222222',
    productId: 'demo',
  })
  return {
    ...project,
    clips: [
      {
        id: 'clip_1',
        trackId: project.tracks[0]?.id ?? 'track_video',
        assetId: '11111111-1111-4111-8111-111111111111',
        from: 0,
        durationInFrames: 30,
        trim: { startFrames: 0 },
        filterId: '11111111-1111-4111-8111-111111111111',
      },
    ],
    overlays: [
      {
        id: 'ov1',
        kind: 'sticker' as const,
        text: '',
        from: 0,
        durationInFrames: 30,
        assetId: '11111111-1111-4111-8111-111111111111',
        libraryItemId: 'sticker-lib-1',
      },
    ],
  }
}

describe('library license gate (#718)', () => {
  it('clears first-party and fail-closes unknown imported rows', () => {
    expect(
      isLibraryItemPublishable({
        source: 'first-party',
        licenseStatus: 'first-party',
        commercialUseAllowed: true,
      }),
    ).toBe(true)
    expect(
      isLibraryItemPublishable({
        source: 'imported',
        licenseStatus: 'unknown',
        commercialUseAllowed: false,
      }),
    ).toBe(false)
    expect(
      isLibraryItemPublishable({
        source: 'generated',
        licenseStatus: 'cleared',
        commercialUseAllowed: true,
      }),
    ).toBe(true)
  })

  it('collects non-first-party filter and overlay library ids', () => {
    const project = withLibraryRefs()
    expect(collectProjectLibraryItemIds(project)).toEqual(
      expect.arrayContaining(['11111111-1111-4111-8111-111111111111', 'sticker-lib-1']),
    )
    expect(collectProjectLibraryItemIds(project)).not.toContain('vhs')
  })

  it('collects authored stinger library ids for Approve (#1193)', () => {
    const project = withLibraryRefs()
    const withStinger = {
      ...project,
      compositionSource: {
        source: 'export default () => null',
        motionSeed: 'seed',
        artDirection: {
          dialect: 'editorial' as const,
          layout: 'stinger-open' as const,
          transitionFamily: 'iris' as const,
          stingerLibraryItemId: 'lottie-lib-1',
        },
      },
    }
    expect(collectProjectLibraryItemIds(withStinger)).toContain('lottie-lib-1')
  })

  it('blocks Approve when a used library row is not commercially cleared', async () => {
    const inFilter = vi.fn(async () => ({
      data: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          product_id: 'demo',
          kind: 'filter',
          label: 'Warmer',
          source: 'imported',
          license_status: 'unknown',
          commercial_use_allowed: false,
          recipe: {},
          blob_key: null,
          created_by: 'import',
          created_at: '2026-08-22T05:00:00.000Z',
        },
      ],
      error: null,
    }))
    const eq = vi.fn(() => ({ in: inFilter }))
    const select = vi.fn(() => ({ eq }))
    const from = vi.fn(() => ({ select }))
    const project = withLibraryRefs()
    await expect(
      assertProjectLibraryLicensesPublishable({ from } as never, 'demo', project),
    ).rejects.toThrow(/commercial use/)
  })
})
