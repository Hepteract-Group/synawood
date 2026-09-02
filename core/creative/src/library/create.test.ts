import { describe, expect, it } from 'vitest'
import { parseEffectRecipe, parseGradeRecipe } from './recipes'
import { assertStickerHasAlpha, pngHasAlpha } from './sticker-qc'
import { createLibraryItem } from './create'
import { createEmptyProject } from '../project/schema'

const transparentPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

describe('library recipes (#716)', () => {
  it('accepts grade tokens in first-party pack ranges', () => {
    expect(
      parseGradeRecipe({
        contrast: 1.1,
        saturate: 1.2,
        hueRotate: 8,
        sepia: 0.1,
        vignette: 0.2,
      }),
    ).toMatchObject({ contrast: 1.1 })
  })

  it('rejects tokens outside the pack ranges', () => {
    expect(() =>
      parseGradeRecipe({
        contrast: 9,
        saturate: 1,
        hueRotate: 0,
        sepia: 0,
        vignette: 0,
      }),
    ).toThrow()
  })

  it('rejects effect stacks with unknown primitives', () => {
    expect(() =>
      parseEffectRecipe({ steps: [{ id: 'after-effects-glow', intensity: 1 }] }),
    ).toThrow(/zoom_punch/)
  })

  it('accepts an allowlisted treatment stack', () => {
    expect(
      parseEffectRecipe({
        steps: [
          { id: 'shake', intensity: 0.4 },
          { id: 'glow', intensity: 1 },
        ],
      }).steps,
    ).toHaveLength(2)
  })
})

describe('sticker QC', () => {
  it('accepts a transparent PNG', () => {
    expect(pngHasAlpha(transparentPng)).toBe(true)
    expect(() =>
      assertStickerHasAlpha({ bytes: transparentPng, contentType: 'image/png' }),
    ).not.toThrow()
  })

  it('rejects SVG with script', () => {
    expect(() =>
      assertStickerHasAlpha({
        bytes: Buffer.from('<svg><script>alert(1)</script></svg>'),
        contentType: 'image/svg+xml',
      }),
    ).toThrow(/script/)
  })
})

describe('createLibraryItem (in-memory)', () => {
  const ctx = {
    productId: 'demo',
    project: createEmptyProject({ id: '22222222-2222-4222-8222-222222222222', productId: 'demo' }),
    projectId: '22222222-2222-4222-8222-222222222222',
    blobEnv: {
      connectionString: 'x',
      containerName: 'marketing-os',
      useLocalPrefix: true,
      accountName: 'a',
      accountKey: 'k',
    },
    modelProfileId: 'ci-stub',
    persist: false as const,
  }

  it('saves a filter recipe without hitting Blob', async () => {
    const item = await createLibraryItem(ctx, {
      kind: 'filter',
      label: 'Warmer',
      recipe: { contrast: 1.05, saturate: 1.1, hueRotate: 6, sepia: 0.08, vignette: 0.1 },
    })
    expect(item.source).toBe('generated')
    expect(item.licenseStatus).toBe('unknown')
    expect(item.commercialUseAllowed).toBe(false)
    expect(item.recipe).toMatchObject({ contrast: 1.05 })
  })

  it('saves an effect stack', async () => {
    const item = await createLibraryItem(ctx, {
      kind: 'effect',
      label: 'Hard punch',
      recipe: { steps: [{ id: 'zoom_punch', intensity: 0.8 }] },
    })
    expect(item.kind).toBe('effect')
  })

  it('generates a stub sticker with alpha and unknown license', async () => {
    const item = await createLibraryItem(ctx, {
      kind: 'sticker',
      label: 'the private example badge',
      prompt: 'the private example mark in a circle',
    })
    expect(item.kind).toBe('sticker')
    expect(item.blobKey).toMatch(/library\/demo\/sticker/)
    expect(item.licenseStatus).toBe('unknown')
  })

  it('refuses a sticker without a prompt', async () => {
    await expect(createLibraryItem(ctx, { kind: 'sticker', label: 'Nope' })).rejects.toThrow(
      /prompt/,
    )
  })
})
