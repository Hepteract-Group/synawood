import { describe, expect, it } from 'vitest'
import { addClip, attachAsset, setEndCard } from './operations'
import { createEmptyProject, parseStudioProject } from './schema'
import { summarizeProject } from './summary'
import { MAIN_VIDEO_TRACK_ID } from './tracks'

const VIDEO_ID = '11111111-1111-4111-8111-111111111111'

describe('summarizeProject overlays (#597)', () => {
  it('includes overlay kind, start, duration, and end so the agent can see FX', () => {
    let project = createEmptyProject({
      id: '22222222-2222-4222-8222-222222222222',
      productId: 'demo',
      durationFrames: 900,
    })
    project = attachAsset(project, {
      id: VIDEO_ID,
      kind: 'video',
      blobKey: 'local/a.mp4',
      source: 'upload',
      probe: { durationFrames: 900 },
    })
    project = addClip(project, {
      assetId: VIDEO_ID,
      trackId: MAIN_VIDEO_TRACK_ID,
      from: 0,
      durationInFrames: 900,
    })
    project = setEndCard(project, 'example.com')
    const summary = summarizeProject(project)
    const card = summary.overlays?.find((overlay) => overlay.kind === 'end_card')
    expect(card).toMatchObject({
      kind: 'end_card',
      from: 915,
      durationInFrames: 90,
      end: 1005,
    })
    expect(card?.text).toBe('example.com')
  })

  it('includes authored compileError so the agent can patch (#1263)', () => {
    const project = parseStudioProject({
      ...createEmptyProject({
        id: '22222222-2222-4222-8222-222222222222',
        productId: 'demo',
        compositionId: 'authored',
      }),
      compositionSource: {
        source: 'export default () => null',
        motionSeed: 'seed-summary-1',
        compileError: 'Line 69: CSS transitions flicker on encode.',
      },
    })
    expect(summarizeProject(project).compileError).toMatch(/CSS transitions/)
  })
})
