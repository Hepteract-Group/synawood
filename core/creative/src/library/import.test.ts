import { describe, expect, it } from 'vitest'
import { isLottieJson, rejectLibraryImportFile } from './import-guards'
import { importLibraryItem } from './import'
import { createEmptyProject } from '../project/schema'

describe('rejectLibraryImportFile (#717)', () => {
  it('rejects CapCut, Premiere, AE, GIF, and fonts with bin-visible copy', () => {
    expect(rejectLibraryImportFile('draft.capcut')?.error).toMatch(/CapCut/)
    expect(rejectLibraryImportFile('cut.prproj')?.error).toMatch(/NLE/)
    expect(rejectLibraryImportFile('comp.aep')?.error).toMatch(/NLE/)
    expect(rejectLibraryImportFile('sticker.gif')?.error).toMatch(/GIF/)
    expect(rejectLibraryImportFile('Brand.ttf')?.error).toMatch(/Font/)
    expect(rejectLibraryImportFile('badge.png')).toBeNull()
    expect(rejectLibraryImportFile('look.cube')).toBeNull()
  })

  it('detects Lottie JSON', () => {
    expect(isLottieJson({ v: '5.7', fr: 30, layers: [] })).toBe(true)
    expect(isLottieJson({ contrast: 1.1, saturate: 1, hueRotate: 0, sepia: 0, vignette: 0 })).toBe(
      false,
    )
  })
})

describe('importLibraryItem (in-memory)', () => {
  const ctx = {
    productId: 'demo',
    project: createEmptyProject({ id: '22222222-2222-4222-8222-222222222222', productId: 'demo' }),
    blobEnv: {
      connectionString: 'x',
      containerName: 'marketing-os',
      useLocalPrefix: true,
      accountName: 'a',
      accountKey: 'k',
    },
    persist: false as const,
  }

  it('imports a JSON grade as an unknown-license filter', async () => {
    const item = await importLibraryItem(ctx, {
      fileName: 'warmer.json',
      contentType: 'application/json',
      bytes: Buffer.from(
        JSON.stringify({ contrast: 1.1, saturate: 1.05, hueRotate: 4, sepia: 0.05, vignette: 0.1 }),
      ),
    })
    expect(item.kind).toBe('filter')
    expect(item.source).toBe('imported')
    expect(item.licenseStatus).toBe('unknown')
    expect(item.commercialUseAllowed).toBe(false)
  })

  it('imports a treatment recipe', async () => {
    const item = await importLibraryItem(ctx, {
      fileName: 'punch.json',
      contentType: 'application/json',
      bytes: Buffer.from(JSON.stringify({ steps: [{ id: 'zoom_punch', intensity: 0.7 }] })),
    })
    expect(item.kind).toBe('effect')
  })

  it('imports licensed Lottie JSON as an uncleared sticker', async () => {
    const item = await importLibraryItem(ctx, {
      fileName: 'badge.json',
      contentType: 'application/json',
      bytes: Buffer.from(JSON.stringify({ v: '5.7.0', fr: 30, layers: [{ nm: 'x' }] })),
    })
    expect(item.kind).toBe('sticker')
    expect(item.recipe.format).toBe('lottie')
    expect(item.licenseStatus).toBe('unknown')
    expect(item.commercialUseAllowed).toBe(false)
  })

  it('imports a .cube LUT as an unknown-license filter (#720)', async () => {
    const cube = `LUT_3D_SIZE 2
0 0 0
1 0 0
0 1 0
1 1 0
0 0 1
1 0 1
0 1 1
1 1 1
`
    const item = await importLibraryItem(ctx, {
      fileName: 'look.cube',
      contentType: 'text/plain',
      bytes: Buffer.from(cube),
    })
    expect(item.kind).toBe('filter')
    expect(item.recipe.type).toBe('cube_lut')
    expect(item.licenseStatus).toBe('unknown')
  })

  it('rejects NLE filenames before parsing', async () => {
    await expect(
      importLibraryItem(ctx, {
        fileName: 'ad.prproj',
        contentType: 'application/octet-stream',
        bytes: Buffer.from('nope'),
      }),
    ).rejects.toThrow(/NLE/)
  })
})
