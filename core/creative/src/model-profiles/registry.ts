import { GATEWAY_IMAGE_MODELS, type GatewayImageModel } from './image-models'
import { STARTER_LIVE_VIDEO_MODEL_ID } from './video-models'
import { CI_STUB_EMBED_VISUAL_REF, PAID_EMBED_VISUAL_REF } from './embed-visual'

export type GeneratorRole =
  | 'reasoner'
  | 'image'
  | 'video'
  | 'speech'
  | 'transcribe'
  | 'caption'
  | 'embed_visual'
  | 'music'
  | 'voiceClone'
  | 'voiceSynth'
  | 'voiceDub'
  | 'voiceLipsync'

export type ModelRef = {
  modelId: string
  providerOptions?: Record<string, unknown>
}

export type ModelProfile = {
  id: string
  label: string
  reasoner: ModelRef
  image: ModelRef
  video: ModelRef
  speech: ModelRef
  transcribe: ModelRef
  /** VLM for asset-intelligence captions/tags — not STT (`transcribe`). */
  caption: ModelRef
  /** Multimodal shot keyframe + text query (ADR-0052 / #581). */
  embed_visual: ModelRef
  /** ElevenLabs Music beds (ADR-0041). */
  music: ModelRef
  /** Voice Studio (ADR-0033 / ADR-0060). Lip-sync stays mock. */
  voiceClone: ModelRef
  voiceSynth: ModelRef
  voiceDub: ModelRef
  voiceLipsync: ModelRef
  enabledTools: readonly string[]
  limits: {
    maxVideoSeconds: number
    maxImagesPerJob: number
    /** Soft per-job warn in GBP; confirmSpend required above this for video. */
    perJobSoftCapGbp: number
  }
}

const BASE_EDIT_TOOLS = [
  'create_project',
  'get_project_summary',
  'add_clip',
  'place_clip',
  'pack_clips',
  'trim_clip',
  'remove_clip',
  'add_captions',
  'captions_from_transcript',
  'set_caption_style',
  'add_text',
  'update_overlay',
  'place_sticker',
  'set_hook_title',
  'set_end_card',
  'render_export',
  'import_product_brand',
  'apply_brief',
  'plan_variants',
  'render_variants',
  'set_model_profile',
  'list_branches',
  'create_branch',
  'switch_branch',
  'promote_branch',
  'merge_branch',
  'find_assets',
  'find_moments',
  'place_shot',
  'assemble_broll',
  'commit_broll_plan',
  'reject_broll_plan',
  'inspect_preview',
  'list_motion_kit',
  'write_composition',
  'patch_composition',
  'set_motion_seed',
  'list_assets_by_tag',
  'describe_asset',
  'analyze_asset',
  'plan_slideshow',
  'set_slide',
  'reorder_slides',
  'add_slide',
  'remove_slide',
  'generate_slide_background',
  'set_slideshow_voiceover',
  'set_campaign_brief',
  'plan_campaign_creatives',
  'set_campaign_creative',
  'set_active_locale',
  'translate_all_missing',
  'dub_project_for_locale',
  'apply_locale_money',
  'list_style_packs',
  'set_style_pack',
  'apply_filter',
  'clear_filter',
  'apply_effect',
  'clear_effect',
  'regen_effect',
  'list_library',
  'create_library_item',
  'import_library_item',
  'set_pip_layout',
  'synthesize_voice',
  'translate_and_dub',
  'lipsync_clip',
  'remove_fillers',
  'build_cut_list',
  'edit_for_clarity',
  'apply_cut_list',
  'apply_jump_cut_zooms',
  'place_sfx',
  'apply_motion_preset',
  'duck_music',
] as const

const IMAGE_GEN_TOOLS = [
  'generate_image',
  'generate_voiceover',
  'transcribe_media',
  'enhance_speech',
  'reframe_clip',
  'generate_campaign_creatives',
  'generate_music',
  'synthesize_voice',
  'translate_and_dub',
] as const

const GEN_TOOLS = [...IMAGE_GEN_TOOLS, 'generate_video_clip'] as const

const BALANCED_ROLES = {
  reasoner: { modelId: 'openai/gpt-4.1-mini' },
  video: { modelId: STARTER_LIVE_VIDEO_MODEL_ID },
  speech: { modelId: 'openai/tts-1-hd' },
  transcribe: { modelId: 'openai/whisper-1' },
  caption: { modelId: 'openai/gpt-4.1-mini' },
  embed_visual: PAID_EMBED_VISUAL_REF,
  music: { modelId: 'elevenlabs/music_v1' },
} as const

const VOICE_LIVE = {
  voiceClone: { modelId: 'elevenlabs/eleven_multilingual_v2' },
  voiceSynth: { modelId: 'openai/tts-1' },
  voiceDub: { modelId: 'openai/tts-1' },
  voiceLipsync: { modelId: 'mock-lipsync' },
} as const

const VOICE_STUB = {
  voiceClone: { modelId: 'mock-voice-clone' },
  voiceSynth: { modelId: 'mock-speech' },
  voiceDub: { modelId: 'mock-speech' },
  voiceLipsync: { modelId: 'mock-lipsync' },
} as const

const profileFromGatewayImage = (row: GatewayImageModel): ModelProfile => ({
  id: row.profileId,
  label: row.label,
  reasoner: BALANCED_ROLES.reasoner,
  image: { modelId: row.gatewayModelId },
  video: { modelId: 'disabled' },
  speech: BALANCED_ROLES.speech,
  transcribe: BALANCED_ROLES.transcribe,
  caption: BALANCED_ROLES.caption,
  embed_visual: BALANCED_ROLES.embed_visual,
  music: BALANCED_ROLES.music,
  ...VOICE_LIVE,
  enabledTools: [...BASE_EDIT_TOOLS, ...IMAGE_GEN_TOOLS],
  limits: {
    maxVideoSeconds: 0,
    maxImagesPerJob: 4,
    perJobSoftCapGbp: Math.max(0.5, row.estimateGbp * 4),
  },
})

const gatewayProfiles = Object.fromEntries(
  GATEWAY_IMAGE_MODELS.map((row) => [row.profileId, profileFromGatewayImage(row)]),
) as Record<string, ModelProfile>

export const MODEL_PROFILES: Record<string, ModelProfile> = {
  'founder-edit': {
    id: 'founder-edit',
    label: 'Edit only',
    reasoner: { modelId: 'openai/gpt-4.1-mini' },
    image: { modelId: 'disabled' },
    video: { modelId: 'disabled' },
    speech: { modelId: 'openai/tts-1' },
    transcribe: { modelId: 'openai/whisper-1' },
    caption: { modelId: 'openai/gpt-4.1-mini' },
    embed_visual: PAID_EMBED_VISUAL_REF,
    music: { modelId: 'elevenlabs/music_v1' },
    ...VOICE_LIVE,
    enabledTools: [
      ...BASE_EDIT_TOOLS,
      'generate_voiceover',
      'transcribe_media',
      'enhance_speech',
      'reframe_clip',
      'generate_music',
      'synthesize_voice',
      'translate_and_dub',
      'lipsync_clip',
      'remove_fillers',
      'build_cut_list',
      'edit_for_clarity',
      'apply_cut_list',
    ],
    limits: { maxVideoSeconds: 0, maxImagesPerJob: 0, perJobSoftCapGbp: 0.5 },
  },
  /** Deterministic stub generators for unit/CI eval — not shown in Studio role pickers. */
  'ci-stub': {
    id: 'ci-stub',
    label: 'Tests (no spend)',
    reasoner: { modelId: 'mock-reasoner' },
    image: { modelId: 'mock-image' },
    video: { modelId: 'mock-video' },
    speech: { modelId: 'mock-speech' },
    transcribe: { modelId: 'mock-transcribe' },
    caption: { modelId: 'mock-caption' },
    embed_visual: CI_STUB_EMBED_VISUAL_REF,
    music: { modelId: 'mock-music' },
    ...VOICE_STUB,
    enabledTools: [...BASE_EDIT_TOOLS, ...GEN_TOOLS],
    limits: { maxVideoSeconds: 5, maxImagesPerJob: 4, perJobSoftCapGbp: 0.25 },
  },
  // Legacy cost-tier ids — remapped onto Gateway image models for existing chats/tools.
  'cheap-draft': {
    id: 'cheap-draft',
    label: 'Draft',
    reasoner: { modelId: 'openai/gpt-4.1-mini' },
    image: { modelId: 'bytedance/seedream-5.0-lite' },
    video: { modelId: 'placeholder/cheap-video' },
    speech: { modelId: 'openai/tts-1' },
    transcribe: { modelId: 'openai/whisper-1' },
    caption: { modelId: 'openai/gpt-4.1-mini' },
    embed_visual: PAID_EMBED_VISUAL_REF,
    music: { modelId: 'elevenlabs/music_v1' },
    ...VOICE_LIVE,
    enabledTools: [...BASE_EDIT_TOOLS, ...GEN_TOOLS],
    limits: { maxVideoSeconds: 4, maxImagesPerJob: 2, perJobSoftCapGbp: 0.5 },
  },
  balanced: {
    id: 'balanced',
    label: 'Standard',
    reasoner: BALANCED_ROLES.reasoner,
    image: { modelId: 'google/gemini-3-pro-image' },
    video: BALANCED_ROLES.video,
    speech: BALANCED_ROLES.speech,
    transcribe: BALANCED_ROLES.transcribe,
    caption: BALANCED_ROLES.caption,
    embed_visual: BALANCED_ROLES.embed_visual,
    music: BALANCED_ROLES.music,
    ...VOICE_LIVE,
    enabledTools: [...BASE_EDIT_TOOLS, ...GEN_TOOLS],
    limits: { maxVideoSeconds: 8, maxImagesPerJob: 4, perJobSoftCapGbp: 1.5 },
  },
  'high-fidelity': {
    id: 'high-fidelity',
    label: 'Best quality',
    reasoner: { modelId: 'openai/gpt-4.1' },
    image: { modelId: 'bytedance/seedream-5.0-pro' },
    video: { modelId: STARTER_LIVE_VIDEO_MODEL_ID },
    speech: { modelId: 'openai/tts-1-hd' },
    transcribe: { modelId: 'openai/whisper-1' },
    caption: { modelId: 'openai/gpt-4.1' },
    embed_visual: PAID_EMBED_VISUAL_REF,
    music: { modelId: 'elevenlabs/music_v2' },
    ...VOICE_LIVE,
    enabledTools: [...BASE_EDIT_TOOLS, ...GEN_TOOLS],
    limits: { maxVideoSeconds: 8, maxImagesPerJob: 6, perJobSoftCapGbp: 4 },
  },
  'broll-live': {
    id: 'broll-live',
    label: 'B-roll live (short clips)',
    reasoner: { modelId: 'openai/gpt-4.1-mini' },
    image: { modelId: 'bytedance/seedream-5.0-lite' },
    video: { modelId: STARTER_LIVE_VIDEO_MODEL_ID },
    speech: { modelId: 'openai/tts-1' },
    transcribe: { modelId: 'openai/whisper-1' },
    caption: { modelId: 'openai/gpt-4.1-mini' },
    embed_visual: PAID_EMBED_VISUAL_REF,
    music: { modelId: 'elevenlabs/music_v1' },
    ...VOICE_LIVE,
    enabledTools: [...BASE_EDIT_TOOLS, ...GEN_TOOLS],
    limits: { maxVideoSeconds: 8, maxImagesPerJob: 4, perJobSoftCapGbp: 2 },
  },
  ...gatewayProfiles,
}

/** Local/dev kill-switch — image and video tools off. Not a customer-facing profile. */
export const KILL_SWITCH_MODEL_PROFILE_ID = 'founder-edit' as const

/** Product default — generates (ADR-0051 §5). Confirm still required when £>0. */
export const DEFAULT_MODEL_PROFILE_ID = 'balanced' as const

export const MODEL_PROFILE_IDS = [
  'founder-edit',
  'ci-stub',
  'cheap-draft',
  'balanced',
  'high-fidelity',
  'broll-live',
  'gemini-flash-image',
  'gemini-pro-image',
  'grok-imagine',
  'seedream-lite',
  'seedream-pro',
] as const

export type ModelProfileId = (typeof MODEL_PROFILE_IDS)[number]

export const getModelProfile = (id: string): ModelProfile => {
  // Legacy DB rows / env that still say "mock" → OpenAI founder-edit.
  const normalized = id === 'mock' ? KILL_SWITCH_MODEL_PROFILE_ID : id
  const profile = MODEL_PROFILES[normalized]
  if (!profile) {
    throw new Error(`Unknown model profile: ${id}. Known: ${MODEL_PROFILE_IDS.join(', ')}`)
  }
  return profile
}

export const resolveModelRef = (
  profileId: string,
  role: Exclude<GeneratorRole, 'reasoner'>,
): ModelRef => {
  const profile = getModelProfile(profileId)
  const ref = profile[role]
  if (ref.modelId === 'disabled') {
    throw new Error(`Profile ${profileId} disables the ${role} role`)
  }
  return ref
}

export const isToolEnabled = (profileId: string, toolName: string): boolean =>
  getModelProfile(profileId).enabledTools.includes(toolName)

/** Campaign Pack picker — three cost tiers, no test stub, no duplicate vendor rows. */
export const listCampaignImageProfiles = (): Array<{ id: string; label: string }> =>
  (['cheap-draft', 'balanced', 'high-fidelity'] as const).map((id) => {
    const profile = getModelProfile(id)
    return { id: profile.id, label: profile.label }
  })

/** Default for new campaign packs — real image spend, not ci-stub. */
export const DEFAULT_CAMPAIGN_MODEL_PROFILE_ID = 'cheap-draft' as const
