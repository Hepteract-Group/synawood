import { describe, expect, it } from 'vitest'
import type { PublishRecord } from '@synawood/channels'
import {
  failedPublishCause,
  failedPublishHeadline,
  failedPublishPageBanner,
} from './publish-failed-copy'

const base: PublishRecord = {
  id: 'pr_1',
  productId: 'demo',
  finalAssetId: 'fa_1',
  contentSlotId: null,
  channel: 'x_founder',
  status: 'failed',
  caption: null,
  scheduledAt: null,
  postedAt: null,
  externalUrl: null,
  postizId: 'pz_1',
  statusHistory: [
    { status: 'scheduled', at: '2026-08-26T12:00:00.000Z' },
    { status: 'failed', at: '2026-08-26T13:00:00.000Z', note: 'Postiz state ERROR.' },
  ],
  createdAt: '2026-08-26T12:00:00.000Z',
  updatedAt: '2026-08-26T13:00:00.000Z',
}

describe('failed publish copy (#807)', () => {
  it('names the channel and uses the failed history note', () => {
    expect(failedPublishHeadline(base)).toBe('Post to X failed.')
    expect(failedPublishCause(base)).toBe('Postiz state ERROR.')
  })

  it('has a fallback cause when history has no note', () => {
    expect(failedPublishCause({ ...base, statusHistory: [] })).toBe(
      'Postiz could not publish this X post.',
    )
  })

  it('names every channel on the page banner when several posts failed', () => {
    expect(
      failedPublishPageBanner([
        base,
        { ...base, id: 'pr_2', channel: 'linkedin_founder' },
        { ...base, id: 'pr_3', channel: 'x_founder' },
      ]),
    ).toBe('3 posts failed on X, LinkedIn. Fix them on the cards below.')
  })
})
