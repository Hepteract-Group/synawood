import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { attachAsset } from './operations'
import { createEmptyProject } from './schema'
import { addThumbnailCandidate, channelNeedsThumbnail, pickThumbnail } from './approval-thumbnail'

const still = (id: string) => ({
  id,
  kind: 'image' as const,
  blobKey: `local/${id}.png`,
  source: 'upload' as const,
  probe: {},
})

const projectWithStills = (...ids: string[]) => {
  let project = createEmptyProject({ id: randomUUID(), productId: 'demo' })
  for (const id of ids) {
    project = attachAsset(project, still(id))
  }
  return project
}

describe('approval thumbnail (#896 / ADR-0077)', () => {
  it('picks one still without requiring Approve to have one', () => {
    const a = randomUUID()
    const b = randomUUID()
    const project = projectWithStills(a, b)
    const picked = pickThumbnail(project, a)
    expect(picked.thumbnailAssetId).toBe(a)
    expect(picked.thumbnailCandidateIds).toContain(a)
    expect(channelNeedsThumbnail('youtube_organic')).toBe(true)
    expect(channelNeedsThumbnail('youtube_shorts')).toBe(true)
    expect(channelNeedsThumbnail('tiktok_organic')).toBe(false)
  })

  it('keeps at most four options and can clear the pick', () => {
    const ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()]
    let project = projectWithStills(...ids)
    for (const id of ids.slice(0, 4)) {
      project = addThumbnailCandidate(project, id)
    }
    expect(project.thumbnailCandidateIds).toHaveLength(4)
    const overflow = addThumbnailCandidate(project, ids[4]!)
    expect(overflow.thumbnailCandidateIds).toHaveLength(4)
    expect(overflow.thumbnailCandidateIds).toContain(ids[4])
    const cleared = pickThumbnail(overflow, ids[4]!)
    const empty = pickThumbnail(cleared, null)
    expect(empty.thumbnailAssetId).toBeNull()
  })

  it('refuses a video file as a thumbnail still', () => {
    let project = createEmptyProject({ id: randomUUID(), productId: 'demo' })
    const videoId = randomUUID()
    project = attachAsset(project, {
      id: videoId,
      kind: 'video',
      blobKey: 'local/talk.mp4',
      source: 'upload',
      probe: { durationFrames: 90 },
    })
    expect(() => pickThumbnail(project, videoId)).toThrow(/still/)
  })
})
