import { describe, expect, it } from 'vitest'
import { addClip, attachAsset } from '../project/operations'
import { createEmptyProject } from '../project/schema'
import { SFX_TRACK_ID } from '../project/tracks'
import { encodeSfxWav, SFX_SAMPLE_RATE } from './sfx-wav'
import { placeSfx } from './place-sfx'
import { applyDuckMusic, planDuckMusic } from './duck-music'

const talkingHead = () => {
  let project = createEmptyProject({
    id: '22222222-2222-4222-8222-222222222222',
    productId: 'demo',
  })
  project = attachAsset(project, {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    kind: 'video',
    blobKey: 'local/take.mp4',
    source: 'upload',
    probe: { durationFrames: 90, transcriptSegments: [{ startMs: 0, endMs: 1000, text: 'hello' }] },
  })
  return addClip(project, {
    assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    from: 0,
    durationInFrames: 90,
  })
}

describe('encodeSfxWav', () => {
  it('writes a PCM WAV with the catalog duration', () => {
    const wav = encodeSfxWav('whoosh')
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF')
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE')
    const dataBytes = wav.readUInt32LE(40)
    expect(dataBytes).toBe(Math.round(0.4 * SFX_SAMPLE_RATE) * 2)
  })
})

describe('placeSfx (#885)', () => {
  it('puts a whoosh on the Sounds lane and logs why', () => {
    const next = placeSfx(talkingHead(), { packId: 'whoosh', from: 0 })
    const clip = next.clips.find((item) => item.trackId === SFX_TRACK_ID)
    const asset = next.assets.find((item) => item.id === clip?.assetId)
    expect(clip?.from).toBe(0)
    expect(asset?.probe?.role).toBe('sfx')
    expect(asset?.probe?.packId).toBe('whoosh')
    expect(next.whyLog.at(-1)?.reason).toBe('Added a whoosh.')
  })

  it('does not treat a hit as speech for music ducking', () => {
    let project = talkingHead()
    project = attachAsset(project, {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      kind: 'audio',
      blobKey: 'local/bed.mp3',
      source: 'generator',
      probe: { durationFrames: 90, role: 'music_bed' },
    })
    project = addClip(project, {
      assetId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      from: 0,
      durationInFrames: 90,
    })
    project = placeSfx(project, { packId: 'hit', from: 12 })
    const plan = planDuckMusic(project)
    expect(plan.ok).toBe(true)
    if (!plan.ok || plan.skip) throw new Error('expected a duck plan')
    expect(plan.clipIds).toHaveLength(1)
    const ducked = applyDuckMusic(project)
    const sfx = ducked.clips.find((clip) => clip.trackId === SFX_TRACK_ID)
    expect(sfx?.volumeEnvelope).toBeUndefined()
  })
})
