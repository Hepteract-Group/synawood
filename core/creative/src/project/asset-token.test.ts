import { describe, expect, it } from 'vitest'
import { assetLabel } from './asset-token'

describe('assetLabel', () => {
  it('prefers probe.name', () => {
    expect(
      assetLabel({
        id: 'a',
        kind: 'image',
        source: 'upload',
        probe: { name: 'logo-pink.png' },
      }),
    ).toBe('logo-pink.png')
  })

  it('falls back to blobKey basename when probe is empty', () => {
    expect(
      assetLabel({
        id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        kind: 'image',
        source: 'upload',
        blobKey: 'local/demo/uploads/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee-Okiki.png',
        probe: {},
      }),
    ).toBe('Okiki.png')
  })
})
