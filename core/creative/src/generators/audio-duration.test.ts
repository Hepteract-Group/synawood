import { describe, expect, it } from 'vitest'
import { durationFramesFromSeconds, probeAudioDurationSeconds } from './audio-duration'

describe('audio-duration', () => {
  it('converts seconds to frames at 30fps', () => {
    expect(durationFramesFromSeconds(2.568)).toBe(77)
    expect(durationFramesFromSeconds(0)).toBe(1)
  })

  it('returns null for non-audio stub bytes', async () => {
    const junk = new TextEncoder().encode('not an mp3')
    expect(await probeAudioDurationSeconds(junk)).toBeNull()
  })
})
