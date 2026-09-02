import { describe, expect, it } from 'vitest'
import { buildBlobKey } from './blob-key'

describe('buildBlobKey', () => {
  it('builds a local-prefixed marketing-os key', () => {
    expect(
      buildBlobKey({
        productId: 'demo',
        kind: 'uploads',
        parts: ['proj_1', 'take.mp4'],
      }),
    ).toBe('local/marketing-os/demo/uploads/proj_1/take.mp4')
  })

  it('can omit the local prefix for production-shaped keys', () => {
    expect(
      buildBlobKey({
        productId: 'demo',
        kind: 'renders',
        parts: ['proj_1', 'r1', 'final.mp4'],
        localPrefix: false,
      }),
    ).toBe('marketing-os/demo/renders/proj_1/r1/final.mp4')
  })

  it('builds library keys under the product, not a the private example prefix', () => {
    expect(
      buildBlobKey({
        productId: 'demo',
        kind: 'library',
        parts: ['sticker', 'badge.png'],
      }),
    ).toBe('local/marketing-os/demo/library/sticker/badge.png')
  })

  it('builds finals keys for immutable Approve copies', () => {
    expect(
      buildBlobKey({
        productId: 'demo',
        kind: 'finals',
        parts: ['proj_1', 'fa_1', 'final.mp4'],
        localPrefix: false,
      }),
    ).toBe('marketing-os/demo/finals/proj_1/fa_1/final.mp4')
  })
})
