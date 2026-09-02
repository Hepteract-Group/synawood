import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EXTRACT_REASONER_ID,
  EXTRACT_REASONER_OPTIONS,
  IMAGE_OPTIONS,
  profileIdForImage,
  profileIdForRoles,
  profileIdForVideo,
  resolveExtractReasonerId,
  rolesFromProfileId,
  VIDEO_OPTIONS,
} from './role-options'
import { STARTER_LIVE_VIDEO_MODEL_ID } from './video-models'
import { isAllowlistedReasonerModelId, GATEWAY_REASONER_MODEL_IDS } from './reasoner-models'

describe('profileIdForImage', () => {
  it('maps image Off to founder-edit', () => {
    expect(profileIdForImage('disabled')).toBe('founder-edit')
  })

  it('maps Gateway image models to their profile ids', () => {
    expect(profileIdForImage('google/gemini-3.1-flash-image')).toBe('gemini-flash-image')
  })

  it('maps legacy mock image to founder-edit', () => {
    expect(profileIdForImage('mock-image')).toBe('founder-edit')
  })
})

describe('profileIdForRoles', () => {
  it('maps legacy mock reasoner or mock image to founder-edit', () => {
    expect(
      profileIdForRoles({ reasonerId: 'mock-reasoner', imageId: 'google/gemini-3.1-flash-image' }),
    ).toBe('founder-edit')
    expect(profileIdForRoles({ reasonerId: 'openai/gpt-4.1-mini', imageId: 'mock-image' })).toBe(
      'founder-edit',
    )
  })

  it('pairs GPT-4.1 + Seedream Pro with high-fidelity', () => {
    expect(
      profileIdForRoles({
        reasonerId: 'openai/gpt-4.1',
        imageId: 'bytedance/seedream-5.0-pro',
      }),
    ).toBe('high-fidelity')
  })
})

describe('rolesFromProfileId', () => {
  it('reads reasoner and image from a Gateway profile', () => {
    expect(rolesFromProfileId('gemini-flash-image')).toMatchObject({
      reasonerId: 'openai/gpt-4.1-mini',
      imageId: 'google/gemini-3.1-flash-image',
    })
  })

  it('honours an independent reasoner override', () => {
    expect(rolesFromProfileId('founder-edit', 'meta/muse-spark-1.1')).toMatchObject({
      reasonerId: 'meta/muse-spark-1.1',
      imageId: 'disabled',
    })
  })

  it('maps video Off vs Veo onto founder-edit / balanced', () => {
    expect(rolesFromProfileId('founder-edit').videoId).toBe('disabled')
    expect(rolesFromProfileId('broll-live').videoId).toBe(STARTER_LIVE_VIDEO_MODEL_ID)
    expect(rolesFromProfileId('gemini-flash-image').videoId).toBe('disabled')
    expect(profileIdForVideo('disabled')).toBe('founder-edit')
    expect(profileIdForVideo(STARTER_LIVE_VIDEO_MODEL_ID)).toBe('balanced')
    expect(profileIdForVideo(STARTER_LIVE_VIDEO_MODEL_ID, 'balanced')).toBe('balanced')
    expect(profileIdForVideo(STARTER_LIVE_VIDEO_MODEL_ID, 'founder-edit')).toBe('balanced')
    expect(profileIdForVideo(STARTER_LIVE_VIDEO_MODEL_ID, 'gemini-flash-image')).toBe('balanced')
    expect(VIDEO_OPTIONS.map((option) => option.label)).toEqual([
      'Off',
      'Veo 3.1 Fast',
      'Veo 3.1',
      'Seedance 2.0 Fast',
      'Seedance 2.5',
    ])
    expect(profileIdForVideo('bytedance/seedance-2.5')).toBe('balanced')
    expect(profileIdForVideo('bytedance/seedance-2.5', 'balanced')).toBe('balanced')
    expect(rolesFromProfileId('balanced', null, 'bytedance/seedance-2.5').videoId).toBe(
      'bytedance/seedance-2.5',
    )
    expect(rolesFromProfileId('founder-edit', null, 'bytedance/seedance-2.5').videoId).toBe(
      'disabled',
    )
    expect(IMAGE_OPTIONS[0]?.label).toBe('Off')
  })
})

describe('extract reasoner options', () => {
  it('omits No LLM and falls back from mock to the first paid model', () => {
    expect(EXTRACT_REASONER_OPTIONS.some((option) => option.id === 'mock-reasoner')).toBe(false)
    expect(resolveExtractReasonerId('mock-reasoner')).toBe(DEFAULT_EXTRACT_REASONER_ID)
    expect(resolveExtractReasonerId('openai/gpt-4.1')).toBe('openai/gpt-4.1')
  })
})

describe('frozen picker options', () => {
  it('appends a disabled row for a frozen image id', async () => {
    const { imageOptionsFor } = await import('./role-options')
    const { roleOptionDisabled, withFrozenPickerOption } = await import('./catalogue')
    const options = withFrozenPickerOption(
      [{ id: 'google/gemini-3.1-flash-image', label: 'Fast pictures' }],
      'xai/not-a-real-model',
      'pictures',
    )
    expect(options.some((option) => option.id === 'xai/not-a-real-model' && option.disabled)).toBe(
      true,
    )
    expect(roleOptionDisabled('xai/not-a-real-model', 'pictures')).toBe(true)
    expect(imageOptionsFor('xai/not-a-real-model').some((option) => option.disabled)).toBe(true)
  })
})

describe('reasoner allowlist', () => {
  it('includes curated Gateway eval models', () => {
    expect(GATEWAY_REASONER_MODEL_IDS).toContain('minimax/minimax-m3')
    expect(GATEWAY_REASONER_MODEL_IDS).toContain('meta/muse-spark-1.1')
    expect(GATEWAY_REASONER_MODEL_IDS).toContain('alibaba/qwen3.7-plus')
    expect(isAllowlistedReasonerModelId('google/gemini-3.1-flash-lite')).toBe(true)
    expect(isAllowlistedReasonerModelId('mock-reasoner')).toBe(true)
    expect(isAllowlistedReasonerModelId('not-a-model')).toBe(false)
  })
})
