import { describe, expect, it } from 'vitest'
import { clipTimelineLabel } from './timeline-clip-label'

const moodDump = [
  'Mood: clean modern underscore',
  'Tempo ~95 BPM',
  'Energy: medium',
  'Genres: lo-fi, ambient',
  'Instrumental only — no vocals or lyrics.',
  'Avoid: vocals, lyrics, choir',
  'User request: placeholder',
].join('\n')

describe('clipTimelineLabel (#1373)', () => {
  it('does not dump the music style prompt as the clip title', () => {
    expect(
      clipTimelineLabel({
        kind: 'audio',
        probe: { role: 'music_bed', prompt: moodDump },
      }),
    ).toBe('Music bed')
    expect(clipTimelineLabel({ kind: 'audio', probe: { prompt: moodDump } })).toBe('Music bed')
  })

  it('uses the operator request when it is real copy', () => {
    expect(
      clipTimelineLabel({
        kind: 'audio',
        probe: {
          role: 'music_bed',
          prompt: 'Mood: x\n\nUser request: calm lo-fi under voiceover',
        },
      }),
    ).toBe('calm lo-fi under voiceover')
  })

  it('labels other kinds without the prompt dump', () => {
    expect(clipTimelineLabel({ kind: 'video', probe: { filename: 'take-01.mp4' } })).toBe(
      'take-01.mp4',
    )
    expect(clipTimelineLabel({ kind: 'audio' })).toBe('Audio')
  })
})
