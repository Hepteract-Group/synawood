import { describe, expect, it } from 'vitest'
import { addClip, attachAsset } from '../project/operations'
import { createEmptyProject } from '../project/schema'
import {
  applyDuckMusic,
  envelopeForMusicClip,
  gainAtEnvelope,
  MUSIC_REST_GAIN,
  planDuckMusic,
  SPEECH_DUCK_GAIN,
  speechWindowsFromProject,
} from './duck-music'

const VIDEO_ID = '11111111-1111-4111-8111-111111111111'
const MUSIC_ID = '22222222-2222-4222-8222-222222222222'

const projectWithSpeechAndMusic = () => {
  const empty = createEmptyProject({
    id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    productId: 'demo',
  })
  const withVideo = attachAsset(empty, {
    id: VIDEO_ID,
    kind: 'video',
    blobKey: 'local/take.mp4',
    source: 'upload',
    probe: {
      durationFrames: 90,
      transcriptSegments: [{ startMs: 0, endMs: 1000, text: 'hello' }],
    },
  })
  const withMusic = attachAsset(withVideo, {
    id: MUSIC_ID,
    kind: 'audio',
    blobKey: 'local/bed.mp3',
    source: 'generator',
    probe: { durationFrames: 90, role: 'music_bed' },
  })
  const withTalk = addClip(withMusic, { assetId: VIDEO_ID, from: 0, durationInFrames: 90 })
  return addClip(withTalk, { assetId: MUSIC_ID, from: 0, durationInFrames: 90 })
}

describe('speechWindowsFromProject', () => {
  it('reads transcript segments onto the timeline', () => {
    const project = projectWithSpeechAndMusic()
    const windows = speechWindowsFromProject(project)
    expect(windows).toEqual([{ startFrame: 0, endFrame: 30 }])
  })
})

describe('envelopeForMusicClip', () => {
  it('ducks gain during speech and returns to full after release', () => {
    const project = projectWithSpeechAndMusic()
    const music = project.clips.find((clip) => clip.assetId === MUSIC_ID)!
    const envelope = envelopeForMusicClip(music, [{ startFrame: 0, endFrame: 30 }])
    expect(gainAtEnvelope(envelope, 10)).toBeCloseTo(SPEECH_DUCK_GAIN)
    expect(gainAtEnvelope(envelope, 80)).toBeCloseTo(MUSIC_REST_GAIN)
  })
})

describe('planDuckMusic', () => {
  it('fails without a music bed', () => {
    const empty = createEmptyProject({
      id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      productId: 'demo',
    })
    expect(planDuckMusic(empty).ok).toBe(false)
  })

  it('plans envelopes for music beds', () => {
    const project = projectWithSpeechAndMusic()
    const plan = planDuckMusic(project)
    expect(plan.ok).toBe(true)
    if (!plan.ok || plan.skip) throw new Error('expected a plan')
    expect(plan.clipIds).toHaveLength(1)
  })

  it('skips when the envelope is already applied', () => {
    const project = applyDuckMusic(projectWithSpeechAndMusic())
    const plan = planDuckMusic(project)
    expect(plan.ok && 'skip' in plan && plan.skip).toBe(true)
  })
})

describe('applyDuckMusic', () => {
  it('writes volumeEnvelope onto the music clip', () => {
    const project = applyDuckMusic(projectWithSpeechAndMusic())
    const music = project.clips.find((clip) => clip.assetId === MUSIC_ID)
    expect(music?.volumeEnvelope?.length).toBeGreaterThan(1)
    expect(gainAtEnvelope(music?.volumeEnvelope, 8)).toBeCloseTo(SPEECH_DUCK_GAIN)
    expect(project.whyLog).toHaveLength(1)
    expect(project.whyLog[0]?.action).toBe('duck')
    expect(project.whyLog[0]?.reason).toMatch(/Ducked music/i)
  })
})
