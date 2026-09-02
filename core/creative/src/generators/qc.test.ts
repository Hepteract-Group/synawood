import { describe, expect, it } from 'vitest'
import { assertGeneratedAssetQc } from './qc'
import type { AssetRef } from './types'

const base = (over: Partial<AssetRef>): AssetRef => ({
  kind: 'image',
  bytes: new Uint8Array([1, 2, 3]),
  contentType: 'image/png',
  probe: {},
  ...over,
})

describe('assertGeneratedAssetQc', () => {
  it('accepts a non-empty image', () => {
    expect(() => assertGeneratedAssetQc(base({}))).not.toThrow()
  })

  it('rejects empty bytes', () => {
    expect(() => assertGeneratedAssetQc(base({ bytes: new Uint8Array() }))).toThrow(/empty/i)
  })

  it('rejects wrong content type for kind', () => {
    expect(() =>
      assertGeneratedAssetQc(base({ kind: 'image', contentType: 'application/octet-stream' })),
    ).toThrow(/non-image/i)
  })

  it('rejects video without duration', () => {
    expect(() =>
      assertGeneratedAssetQc(
        base({
          kind: 'video',
          contentType: 'video/mp4',
          bytes: new Uint8Array([1]),
          probe: {},
        }),
      ),
    ).toThrow(/duration/i)
  })
})
