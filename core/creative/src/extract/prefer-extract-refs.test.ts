import { describe, expect, it } from 'vitest'
import { attachAsset } from '../project/operations'
import { createEmptyProject } from '../project/schema'
import { extractStillAssetIds, nextUnusedExtractSlideBackground } from './prefer-extract-refs'

const PROJECT_ID = 'f200c625-f841-4c79-ae7d-b62e4263ea9a'
const USABLE_ID = '11111111-1111-4111-8111-111111111111'
const WEAK_ID = '22222222-2222-4222-8222-222222222222'
const REJECT_ID = '33333333-3333-4333-8333-333333333333'
const STOCK_ID = '44444444-4444-4444-8444-444444444444'

const projectWithExtracts = () => {
  let project = createEmptyProject({ id: PROJECT_ID, productId: 'acme' })
  project = attachAsset(project, {
    id: USABLE_ID,
    kind: 'image',
    blobKey: 'local/marketing-os/acme/extract/a/still.png',
    source: 'upload',
    probe: { productExtractId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', quality: 'usable' },
  })
  project = attachAsset(project, {
    id: WEAK_ID,
    kind: 'image',
    blobKey: 'local/marketing-os/acme/extract/b/still.png',
    source: 'upload',
    probe: { productExtractId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', quality: 'weak' },
  })
  project = attachAsset(project, {
    id: REJECT_ID,
    kind: 'image',
    blobKey: 'local/marketing-os/acme/extract/c/still.png',
    source: 'upload',
    probe: { productExtractId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', quality: 'reject' },
  })
  project = attachAsset(project, {
    id: STOCK_ID,
    kind: 'image',
    blobKey: 'local/marketing-os/acme/uploads/stock.png',
    source: 'generator',
    probe: {},
  })
  return project
}

describe('prefer extract refs (#1098)', () => {
  it('lists usable and weak extract assets, not rejected or generated stock', () => {
    expect(extractStillAssetIds(projectWithExtracts())).toEqual([USABLE_ID, WEAK_ID])
  })

  it('picks the next unused extract still as a slide background', () => {
    const project = projectWithExtracts()
    expect(nextUnusedExtractSlideBackground(project, [])).toBe(USABLE_ID)
    expect(nextUnusedExtractSlideBackground(project, [USABLE_ID])).toBe(WEAK_ID)
    expect(nextUnusedExtractSlideBackground(project, [USABLE_ID, WEAK_ID])).toBeUndefined()
  })
})
