import { describe, expect, it } from 'vitest'
import { attachAsset, createEmptyProject } from '../project'
import { bindMotionMediaProps, signedMotionMediaUrl } from './bind-motion-media'

const projectId = '22222222-2222-4222-8222-222222222222'
const logoId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const extractId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const momentStillId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const generatedId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const shotId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

const resolveSigned = (key: string): string =>
  `https://blobs.example/sas?blob=${encodeURIComponent(key)}&sig=1`

const baseProject = () => {
  let project = createEmptyProject({ id: projectId, productId: 'demo' })
  project = {
    ...project,
    compositionId: 'authored',
    brand: { productId: 'demo', displayName: 'Povotra', logoAssetId: logoId },
  }
  project = attachAsset(project, {
    id: logoId,
    kind: 'image',
    blobKey: 'local/marketing-os/demo/brand-kit/x/logo.png',
    source: 'upload',
    probe: {},
  })
  project = attachAsset(project, {
    id: extractId,
    kind: 'image',
    blobKey: 'local/marketing-os/demo/extract/still.png',
    source: 'upload',
    probe: { productExtractId: '11111111-1111-4111-8111-111111111111', quality: 'usable' },
  })
  project = attachAsset(project, {
    id: momentStillId,
    kind: 'image',
    blobKey: 'local/marketing-os/demo/library/ui.png',
    source: 'upload',
    probe: {},
  })
  project = attachAsset(project, {
    id: generatedId,
    kind: 'image',
    blobKey: 'local/marketing-os/demo/generated/stock.png',
    source: 'generator',
    probe: {},
  })
  return project
}

describe('signedMotionMediaUrl (#1198)', () => {
  it('returns the mapper URL, never the blob key', () => {
    expect(signedMotionMediaUrl('local/marketing-os/demo/a.png', resolveSigned)).toBe(
      'https://blobs.example/sas?blob=local%2Fmarketing-os%2Fdemo%2Fa.png&sig=1',
    )
  })

  it('drops identity maps so Chromium never sees a storage key', () => {
    expect(signedMotionMediaUrl('local/marketing-os/demo/a.png', (key) => key)).toBeUndefined()
  })

  it('rejects live-site blob keys and non-http mapper results', () => {
    expect(signedMotionMediaUrl('https://example.com/og.png', resolveSigned)).toBeUndefined()
    expect(signedMotionMediaUrl('local/marketing-os/demo/a.png', () => 'not-a-url')).toBeUndefined()
  })
})

describe('bindMotionMediaProps (#1198)', () => {
  it('uses find_moments hits as heroSrc via the signed URL mapper', () => {
    const bound = bindMotionMediaProps({
      project: baseProject(),
      resolveUrl: resolveSigned,
      momentHits: [{ assetId: momentStillId, shotId }],
    })
    expect(bound.heroSrc).toBe(resolveSigned('local/marketing-os/demo/library/ui.png'))
    expect(bound.heroSrc).not.toBe('local/marketing-os/demo/library/ui.png')
    expect(bound.heroAssetId).toBe(momentStillId)
    expect(bound.plateShotIds).toEqual([shotId])
    expect(bound.logoSrc).toBe(resolveSigned('local/marketing-os/demo/brand-kit/x/logo.png'))
  })

  it('ranks Extract stills ahead of generator stock when no moments hit', () => {
    const bound = bindMotionMediaProps({
      project: baseProject(),
      resolveUrl: resolveSigned,
    })
    expect(bound.heroAssetId).toBe(extractId)
    expect(bound.plateAssetIds).toContain(generatedId)
    expect(bound.plates.length).toBeGreaterThan(1)
  })

  it('prefers unused stills over the last Finals’ heroAssetId', () => {
    const bound = bindMotionMediaProps({
      project: baseProject(),
      resolveUrl: resolveSigned,
      recentHeroAssetIds: [extractId],
    })
    expect(bound.heroAssetId).not.toBe(extractId)
    expect(bound.plateAssetIds).toContain(extractId)
  })

  it('returns empty plates when the library has no image assets', () => {
    const project = createEmptyProject({ id: projectId, productId: 'demo' })
    const bound = bindMotionMediaProps({
      project,
      resolveUrl: resolveSigned,
      momentHits: [{ assetId: momentStillId, shotId }],
    })
    expect(bound.plates).toEqual([])
    expect(bound.heroSrc).toBeUndefined()
  })
})
