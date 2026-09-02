import { describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { addClip, attachAsset } from '../project/operations'
import { createEmptyProject } from '../project/schema'
import {
  applyCaptionsFromTranscript,
  chunkTranscriptCaptions,
  readTranscriptWords,
} from './captions-from-transcript'

describe('captions from transcript', () => {
  it('chunks word timings into caption overlays', () => {
    const chunks = chunkTranscriptCaptions(
      [
        { startMs: 0, endMs: 400, text: 'Edit' },
        { startMs: 400, endMs: 900, text: 'PDFs' },
        { startMs: 900, endMs: 1400, text: 'without' },
        { startMs: 1400, endMs: 2000, text: 'Adobe.' },
        { startMs: 2200, endMs: 2800, text: 'Try' },
        { startMs: 2800, endMs: 3400, text: 'the private example' },
      ],
      30,
    )
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    expect(chunks[0]?.from).toBe(0)
    expect(chunks[0]?.text).toMatch(/Edit/)
    expect(chunks[0]?.words?.length).toBeGreaterThan(0)
  })

  it('applies caption overlays onto the project', () => {
    let project = createEmptyProject({ id: randomUUID(), productId: 'demo' })
    project = applyCaptionsFromTranscript(project, [
      { startMs: 0, endMs: 1000, text: 'Hello' },
      { startMs: 1000, endMs: 2000, text: 'world.' },
    ])
    expect(project.overlays.filter((overlay) => overlay.kind === 'caption').length).toBeGreaterThan(
      0,
    )
    const caption = project.overlays.find((overlay) => overlay.kind === 'caption')
    expect(caption?.style?.presetId).toBe('karaoke')
    expect(caption?.words?.length).toBeGreaterThan(0)
  })

  it('colors campaign keywords on first pass (#891)', () => {
    let project = createEmptyProject({ id: randomUUID(), productId: 'demo' })
    project = { ...project, intent: { ...project.intent, keywords: ['focus'] } }
    project = applyCaptionsFromTranscript(project, [
      { startMs: 0, endMs: 300, text: 'Stay' },
      { startMs: 300, endMs: 500, text: 'in' },
      { startMs: 500, endMs: 1100, text: 'focus' },
    ])
    const caption = project.overlays.find((overlay) => overlay.kind === 'caption')
    expect(caption?.style?.emphasis?.some((item) => item.wordIndex === 2)).toBe(true)
  })

  it('reads transcriptSegments from the clip asset', () => {
    let project = createEmptyProject({ id: randomUUID(), productId: 'demo' })
    const assetId = randomUUID()
    project = attachAsset(project, {
      id: assetId,
      kind: 'video',
      blobKey: 'local/a.mp4',
      source: 'upload',
      probe: {
        durationFrames: 90,
        transcriptSegments: [
          { startMs: 0, endMs: 500, text: 'Hello' },
          { startMs: 500, endMs: 1200, text: 'there' },
        ],
      },
    })
    project = addClip(project, { assetId })
    const words = readTranscriptWords(project, project.clips[0]!.id)
    expect(words).toHaveLength(2)
    expect(words[0]?.text).toBe('Hello')
  })
})
