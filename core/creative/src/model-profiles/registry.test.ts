import { describe, expect, it } from 'vitest'
import { estimateGbp } from '../pricing'
import { GATEWAY_IMAGE_MODELS } from './image-models'
import {
  DEFAULT_MODEL_PROFILE_ID,
  getModelProfile,
  isToolEnabled,
  KILL_SWITCH_MODEL_PROFILE_ID,
  listCampaignImageProfiles,
  MODEL_PROFILE_IDS,
  resolveModelRef,
} from './registry'
import { STARTER_LIVE_VIDEO_MODEL_ID } from './video-models'

describe('model profiles', () => {
  it('disables generate_video_clip on founder-edit', () => {
    expect(isToolEnabled('founder-edit', 'generate_video_clip')).toBe(false)
    expect(isToolEnabled('founder-edit', 'generate_voiceover')).toBe(true)
    expect(isToolEnabled('founder-edit', 'generate_music')).toBe(true)
    expect(isToolEnabled('founder-edit', 'set_pip_layout')).toBe(true)
    expect(isToolEnabled('founder-edit', 'set_pip_layout')).toBe(true)
    expect(isToolEnabled('founder-edit', 'find_moments')).toBe(true)
    expect(isToolEnabled('founder-edit', 'analyze_asset')).toBe(true)
    expect(isToolEnabled('founder-edit', 'place_shot')).toBe(true)
    expect(isToolEnabled('founder-edit', 'assemble_broll')).toBe(true)
    expect(isToolEnabled('founder-edit', 'commit_broll_plan')).toBe(true)
    expect(isToolEnabled('founder-edit', 'reject_broll_plan')).toBe(true)
    expect(isToolEnabled('founder-edit', 'inspect_preview')).toBe(true)
    expect(isToolEnabled('founder-edit', 'write_composition')).toBe(true)
    expect(isToolEnabled('ci-stub', 'list_motion_kit')).toBe(true)
    expect(isToolEnabled('founder-edit', 'list_library')).toBe(true)
    expect(getModelProfile('mock').id).toBe('founder-edit')
    expect(getModelProfile('founder-edit').speech.modelId).toBe('openai/tts-1')
    expect(resolveModelRef('founder-edit', 'music').modelId).toBe('elevenlabs/music_v1')
    expect(resolveModelRef('ci-stub', 'music').modelId).toBe('mock-music')
    expect(resolveModelRef('ci-stub', 'voiceSynth').modelId).toBe('mock-speech')
    expect(resolveModelRef('founder-edit', 'voiceSynth').modelId).toBe('openai/tts-1')
    expect(resolveModelRef('founder-edit', 'voiceClone').modelId).toBe(
      'elevenlabs/eleven_multilingual_v2',
    )
    expect(resolveModelRef('ci-stub', 'voiceClone').modelId).toBe('mock-voice-clone')
    expect(resolveModelRef('ci-stub', 'voiceLipsync').modelId).toBe('mock-lipsync')
    expect(isToolEnabled('ci-stub', 'synthesize_voice')).toBe(true)
  })

  it('enables live generate_video_clip on broll-live, balanced, and high-fidelity', () => {
    expect(isToolEnabled('broll-live', 'generate_video_clip')).toBe(true)
    expect(isToolEnabled('balanced', 'generate_video_clip')).toBe(true)
    expect(isToolEnabled('high-fidelity', 'generate_video_clip')).toBe(true)
    expect(resolveModelRef('broll-live', 'video').modelId).toBe(STARTER_LIVE_VIDEO_MODEL_ID)
    expect(resolveModelRef('balanced', 'video').modelId).toBe(STARTER_LIVE_VIDEO_MODEL_ID)
    expect(resolveModelRef('high-fidelity', 'video').modelId).toBe(STARTER_LIVE_VIDEO_MODEL_ID)
    expect(getModelProfile('broll-live').limits.maxVideoSeconds).toBe(8)
    expect(getModelProfile('balanced').limits.maxVideoSeconds).toBeLessThanOrEqual(8)
    expect(estimateGbp(STARTER_LIVE_VIDEO_MODEL_ID, 4)).toBe(1.6)
  })

  it('keeps Gateway image profiles video-off so Fast pictures cannot surprise-spend', () => {
    for (const row of GATEWAY_IMAGE_MODELS) {
      expect(isToolEnabled(row.profileId, 'generate_video_clip')).toBe(false)
      expect(isToolEnabled(row.profileId, 'generate_image')).toBe(true)
      expect(getModelProfile(row.profileId).video.modelId).toBe('disabled')
      expect(getModelProfile(row.profileId).limits.maxVideoSeconds).toBe(0)
    }
  })

  it('registers all Gateway image profiles with priced model ids', () => {
    expect(GATEWAY_IMAGE_MODELS).toHaveLength(5)
    for (const row of GATEWAY_IMAGE_MODELS) {
      expect(MODEL_PROFILE_IDS).toContain(row.profileId)
      expect(resolveModelRef(row.profileId, 'image').modelId).toBe(row.gatewayModelId)
      expect(estimateGbp(row.gatewayModelId, 1)).toBe(row.estimateGbp)
      expect(isToolEnabled(row.profileId, 'generate_image')).toBe(true)
    }
  })

  it('remaps legacy cost tiers onto Gateway image models', () => {
    expect(resolveModelRef('cheap-draft', 'image').modelId).toBe('bytedance/seedream-5.0-lite')
    expect(resolveModelRef('balanced', 'image').modelId).toBe('google/gemini-3-pro-image')
    expect(resolveModelRef('high-fidelity', 'image').modelId).toBe('bytedance/seedream-5.0-pro')
  })

  it('resolves a caption VLM distinct from transcribe STT on every profile', () => {
    expect(resolveModelRef('founder-edit', 'caption').modelId).toBe('openai/gpt-4.1-mini')
    expect(resolveModelRef('ci-stub', 'caption').modelId).toBe('mock-caption')
    expect(resolveModelRef('high-fidelity', 'caption').modelId).toBe('openai/gpt-4.1')
    expect(resolveModelRef('gemini-flash-image', 'caption').modelId).toBe('openai/gpt-4.1-mini')
    for (const id of MODEL_PROFILE_IDS) {
      const caption = resolveModelRef(id, 'caption').modelId
      const transcribe = resolveModelRef(id, 'transcribe').modelId
      expect(caption).toBeTruthy()
      expect(caption).not.toBe(transcribe)
    }
  })

  it('lists campaign image tiers without tests stub or Edit only', () => {
    const rows = listCampaignImageProfiles()
    const ids = rows.map((row) => row.id)
    expect(ids).toEqual(['cheap-draft', 'balanced', 'high-fidelity'])
    expect(rows.map((row) => row.label)).toEqual(['Draft', 'Standard', 'Best quality'])
    expect(ids).not.toContain('ci-stub')
    expect(ids).not.toContain('founder-edit')
    for (const id of ids) {
      expect(getModelProfile(id).image.modelId).not.toBe('disabled')
    }
  })

  it('defaults new work to generate, with founder-edit as the kill-switch', () => {
    expect(DEFAULT_MODEL_PROFILE_ID).toBe('balanced')
    expect(KILL_SWITCH_MODEL_PROFILE_ID).toBe('founder-edit')
    expect(isToolEnabled(DEFAULT_MODEL_PROFILE_ID, 'generate_video_clip')).toBe(true)
    expect(isToolEnabled(KILL_SWITCH_MODEL_PROFILE_ID, 'generate_video_clip')).toBe(false)
  })
})
