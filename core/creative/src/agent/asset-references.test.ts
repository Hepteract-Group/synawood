import { describe, expect, it } from 'vitest'
import { assetReferenceBlock } from './asset-references'
import { assetTokenFor, resolveAssetReferences } from '../project/asset-token'
import type { ProjectAsset } from '../project/schema'

const asset = (over: Partial<ProjectAsset> = {}): ProjectAsset => ({
  id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  kind: 'video',
  blobKey: 'local/x.mp4',
  source: 'upload',
  probe: {},
  ...over,
})

describe('resolveAssetReferences', () => {
  it('resolves a token by generated slug', () => {
    const a = asset({ probe: { prompt: 'calm workspace' } })
    const token = assetTokenFor(a)
    const refs = resolveAssetReferences(`replace the clip with ${token}`, [a])
    expect(refs).toHaveLength(1)
    expect(refs[0]?.assetId).toBe(a.id)
    expect(refs[0]?.kind).toBe('video')
  })

  it('resolves by id prefix', () => {
    const a = asset()
    const refs = resolveAssetReferences(`use @asset:aaaaaaaa in the cut`, [a])
    expect(refs[0]?.assetId).toBe(a.id)
  })

  it('resolves @name without the asset: prefix when the label matches', () => {
    const a = asset({ kind: 'image', probe: { name: 'still-image' } })
    const refs = resolveAssetReferences('Add @still-image at 5 seconds', [a])
    expect(refs).toHaveLength(1)
    expect(refs[0]?.assetId).toBe(a.id)
  })

  it('prefers the 8-char id suffix when two assets share a truncated slug', () => {
    const longPrompt =
      'a golfer in mid-swing on a golf course bright and sunny afternoon with trees'
    const first = asset({
      id: 'a4047e1b-1111-4111-8111-111111111111',
      kind: 'image',
      probe: { prompt: longPrompt },
    })
    const second = asset({
      id: 'b5057e2c-2222-4222-8222-222222222222',
      kind: 'image',
      probe: { prompt: longPrompt },
    })
    const token = assetTokenFor(second)
    const refs = resolveAssetReferences(`Add ${token} at 5 seconds`, [first, second])
    expect(refs).toHaveLength(1)
    expect(refs[0]?.assetId).toBe(second.id)
  })

  it('dedupes repeated references to the same asset', () => {
    const a = asset({ probe: { prompt: 'b roll' } })
    const token = assetTokenFor(a)
    const refs = resolveAssetReferences(`${token} then again ${token}`, [a])
    expect(refs).toHaveLength(1)
  })

  it('ignores tokens that match no asset', () => {
    const refs = resolveAssetReferences('use @asset:nonexistent-thing', [asset()])
    expect(refs).toHaveLength(0)
  })
})

describe('assetReferenceBlock', () => {
  it('is empty when no refs', () => {
    expect(assetReferenceBlock([])).toBe('')
  })

  it('grounds assetIds for the agent', () => {
    const a = asset({ probe: { prompt: 'b roll' } })
    const refs = resolveAssetReferences(assetTokenFor(a), [a])
    const block = assetReferenceBlock(refs)
    expect(block).toContain('Referenced assets')
    expect(block).toContain(`assetId=${a.id}`)
    expect(block).toMatch(/sourceImageAssetIds/)
    expect(block).toMatch(/mentioned video clip/)
    expect(block).toMatch(/silently drop/)
  })
})
