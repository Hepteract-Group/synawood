import { describe, expect, it, vi } from 'vitest'
import { generateMusic, isStubMusicModelId } from '../generators/music'
import { mergeMusicPrompt, loadMusicStyle, DEFAULT_MUSIC_STYLE } from './style'
import { isMusicLicensePublishable } from './schema'
import { estimateGbp } from '../pricing/estimate'
import { estimateMusicGbp, placedMusicClipDurationFrames } from './generate'

describe('music adapter (#193 / #200)', () => {
  it('treats mock-music as stub', () => {
    expect(isStubMusicModelId('mock-music')).toBe(true)
    expect(isStubMusicModelId('elevenlabs/music_v1')).toBe(false)
  })

  it('returns mock license for stub model without calling ElevenLabs', async () => {
    const result = await generateMusic({
      prompt: 'lo-fi bed',
      modelId: 'mock-music',
      durationMs: 10_000,
      forceInstrumental: true,
    })
    expect(result.license.licenseStatus).toBe('mock')
    expect(result.license.commercialUseAllowed).toBe(false)
    expect(isMusicLicensePublishable(result.license)).toBe(false)
    expect(result.asset.bytes.byteLength).toBeGreaterThan(0)
  })

  it('fails loud when live model has no ELEVENLABS_API_KEY (no silent mock)', async () => {
    const prev = process.env.ELEVENLABS_API_KEY
    delete process.env.ELEVENLABS_API_KEY
    try {
      await expect(
        generateMusic({
          prompt: 'bed',
          modelId: 'elevenlabs/music_v1',
          durationMs: 10_000,
        }),
      ).rejects.toThrow(/ELEVENLABS_API_KEY/)
    } finally {
      if (prev === undefined) delete process.env.ELEVENLABS_API_KEY
      else process.env.ELEVENLABS_API_KEY = prev
    }
  })

  it('uses injected ElevenLabs client for live path', async () => {
    const prev = process.env.ELEVENLABS_API_KEY
    process.env.ELEVENLABS_API_KEY = 'test-key'
    try {
      const result = await generateMusic(
        {
          prompt: 'soft pad',
          modelId: 'elevenlabs/music_v1',
          durationMs: 8_000,
          musicStyle: { mood: 'calm', avoidVocals: true },
        },
        {
          elevenLabs: vi.fn(async () => ({
            bytes: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
            contentType: 'audio/mpeg',
            songId: 'song_test',
          })),
        },
      )
      expect(result.license.provider).toBe('elevenlabs')
      expect(result.license.licenseStatus).toBe('cleared')
      expect(result.license.commercialUseAllowed).toBe(true)
      expect(result.license.providerSongId).toBe('song_test')
      expect(result.promptUsed).toMatch(/calm/i)
    } finally {
      if (prev === undefined) delete process.env.ELEVENLABS_API_KEY
      else process.env.ELEVENLABS_API_KEY = prev
    }
  })
})

describe('music.style.json merge (#194 / #200)', () => {
  it('merges brand style into prompt', () => {
    const merged = mergeMusicPrompt({
      userPrompt: 'for a PDF tip',
      style: { ...DEFAULT_MUSIC_STYLE, mood: 'founder calm' },
    })
    expect(merged).toMatch(/founder calm/i)
    expect(merged).toMatch(/PDF tip/)
  })

  it('loads demo music.style.json', async () => {
    const loaded = await loadMusicStyle('demo')
    expect(loaded.source).toBe('file')
    expect(loaded.style.avoidVocals).toBe(true)
  })

  it('defaults when product has no music.style.json', async () => {
    const loaded = await loadMusicStyle('does-not-exist-product')
    expect(loaded.source).toBe('default')
    expect(loaded.style.mood).toBe(DEFAULT_MUSIC_STYLE.mood)
  })
})

describe('music cost (#197)', () => {
  it('prices elevenlabs music models above zero', () => {
    expect(estimateGbp('elevenlabs/music_v1', 30)).toBeGreaterThan(0)
    expect(estimateGbp('mock-music', 30)).toBe(0)
  })

  it('marks ci-stub estimates as stub and live profiles as not (#688)', () => {
    expect(estimateMusicGbp({ modelProfileId: 'ci-stub', durationMs: 30_000 }).stub).toBe(true)
    expect(estimateMusicGbp({ modelProfileId: 'founder-edit', durationMs: 30_000 }).stub).toBe(
      false,
    )
    expect(
      estimateMusicGbp({ modelProfileId: 'founder-edit', durationMs: 30_000 }).estimatedGbp,
    ).toBeGreaterThan(0)
  })
})

describe('placedMusicClipDurationFrames (#1372)', () => {
  it('does not let a 30s bed stick past a shorter ad', () => {
    expect(
      placedMusicClipDurationFrames({
        audioFrames: 900,
        projectDurationFrames: 480,
        from: 0,
      }),
    ).toBe(480)
  })
})
