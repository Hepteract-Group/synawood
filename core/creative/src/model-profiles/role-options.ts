import { roleOptionDisabled, withFrozenPickerOption } from './catalogue'
import { GATEWAY_IMAGE_MODELS } from './image-models'
import { GATEWAY_REASONER_MODELS } from './reasoner-models'
import {
  DEFAULT_MODEL_PROFILE_ID,
  getModelProfile,
  isToolEnabled,
  KILL_SWITCH_MODEL_PROFILE_ID,
  MODEL_PROFILES,
} from './registry'
import {
  GATEWAY_VIDEO_MODELS,
  isLiveVideoModelId,
  isVideoOffModelId,
  resolveVideoModelId,
  STARTER_LIVE_VIDEO_MODEL_ID,
} from './video-models'

export type RoleOption = {
  id: string
  label: string
  /** When selecting this image role, prefer this profile id. */
  profileId?: string
  disabled?: boolean
}

/** Compact reasoner choices shown beside chat Send. */
export const REASONER_OPTIONS: readonly RoleOption[] = [
  { id: 'mock-reasoner', label: 'No LLM' },
  ...GATEWAY_REASONER_MODELS.map((model) => ({
    id: model.gatewayModelId,
    label: model.label,
    disabled: roleOptionDisabled(model.gatewayModelId, 'reason'),
  })),
]

/** Extract forms omit No LLM; chat Send still offers it. */
export const EXTRACT_REASONER_OPTIONS: readonly RoleOption[] = REASONER_OPTIONS.filter(
  (option) => option.id !== 'mock-reasoner',
)

export const DEFAULT_EXTRACT_REASONER_ID = EXTRACT_REASONER_OPTIONS[0]?.id ?? 'openai/gpt-4.1-mini'

export const resolveExtractReasonerId = (reasonerModelId: string | null | undefined): string => {
  const id = reasonerModelId?.trim() ?? ''
  if (EXTRACT_REASONER_OPTIONS.some((option) => option.id === id)) return id
  return DEFAULT_EXTRACT_REASONER_ID
}

/** Compact image choices — each maps to a persisted Model Profile. */
export const IMAGE_OPTIONS: readonly RoleOption[] = [
  { id: 'disabled', label: 'Off', profileId: KILL_SWITCH_MODEL_PROFILE_ID },
  ...GATEWAY_IMAGE_MODELS.map((model) => ({
    id: model.gatewayModelId,
    label: model.label,
    profileId: model.profileId,
    disabled: roleOptionDisabled(model.gatewayModelId, 'pictures'),
  })),
]

/** Video slot — Off is a local kill-switch; other rows are Gateway model names. */
export const VIDEO_OPTIONS: readonly RoleOption[] = [
  { id: 'disabled', label: 'Off', profileId: KILL_SWITCH_MODEL_PROFILE_ID },
  ...GATEWAY_VIDEO_MODELS.map((model) => ({
    id: model.gatewayModelId,
    label: model.label,
    profileId: DEFAULT_MODEL_PROFILE_ID,
    disabled: roleOptionDisabled(model.gatewayModelId, 'video'),
  })),
]

export const reasonerOptionsFor = (selectedId: string): readonly RoleOption[] =>
  withFrozenPickerOption(REASONER_OPTIONS, selectedId, 'reason')

export const imageOptionsFor = (selectedId: string): readonly RoleOption[] =>
  withFrozenPickerOption(IMAGE_OPTIONS, selectedId, 'pictures')

export const videoOptionsFor = (selectedId: string): readonly RoleOption[] =>
  withFrozenPickerOption(VIDEO_OPTIONS, selectedId, 'video')

export const rolesFromProfileId = (
  profileId: string,
  reasonerModelId?: string | null,
  videoModelId?: string | null,
): { reasonerId: string; imageId: string; videoId: string } => {
  const profile = getModelProfile(profileId)
  const videoEnabled = isToolEnabled(profileId, 'generate_video_clip')
  const resolved = resolveVideoModelId({
    profileVideoModelId: profile.video.modelId,
    videoModelId,
  })
  const videoId =
    !videoEnabled || isVideoOffModelId(resolved)
      ? 'disabled'
      : VIDEO_OPTIONS.some((option) => option.id === resolved)
        ? resolved
        : isLiveVideoModelId(resolved)
          ? STARTER_LIVE_VIDEO_MODEL_ID
          : resolved
  return {
    reasonerId: reasonerModelId?.trim() || profile.reasoner.modelId,
    imageId: profile.image.modelId,
    videoId,
  }
}

/**
 * Map image pick onto a persisted Model Profile (tools / limits / gen models).
 * Reasoner is persisted separately via reasoner_model_id — do not fold it in here.
 */
export const profileIdForImage = (imageId: string): string => {
  if (imageId === 'disabled' || imageId === 'mock-image') return KILL_SWITCH_MODEL_PROFILE_ID

  const imageOption = IMAGE_OPTIONS.find((option) => option.id === imageId)
  if (imageOption?.profileId && MODEL_PROFILES[imageOption.profileId]) {
    return imageOption.profileId
  }

  const byImage = Object.values(MODEL_PROFILES).find((profile) => profile.image.modelId === imageId)
  if (byImage) return byImage.id

  return KILL_SWITCH_MODEL_PROFILE_ID
}

/**
 * Map video pick onto a persisted Model Profile.
 * Off → local kill-switch. A named video model keeps the current profile when it
 * already generates video; otherwise switch to the product default.
 */
export const profileIdForVideo = (videoId: string, currentProfileId?: string): string => {
  if (videoId === 'disabled' || videoId === 'placeholder' || videoId === 'mock-video') {
    return KILL_SWITCH_MODEL_PROFILE_ID
  }

  if (currentProfileId) {
    const current = MODEL_PROFILES[currentProfileId]
    if (
      current &&
      isToolEnabled(currentProfileId, 'generate_video_clip') &&
      isLiveVideoModelId(current.video.modelId)
    ) {
      return currentProfileId
    }
  }

  const videoOption = VIDEO_OPTIONS.find((option) => option.id === videoId)
  if (videoOption?.profileId && MODEL_PROFILES[videoOption.profileId]) {
    return videoOption.profileId
  }

  return DEFAULT_MODEL_PROFILE_ID
}

/**
 * @deprecated Prefer profileIdForImage + independent reasoner_model_id.
 * Kept for older callers; image still wins for the profile id.
 */
export const profileIdForRoles = (input: { reasonerId: string; imageId: string }): string => {
  if (input.reasonerId === 'mock-reasoner' || input.imageId === 'mock-image') {
    return KILL_SWITCH_MODEL_PROFILE_ID
  }
  if (
    input.reasonerId === 'openai/gpt-4.1' &&
    input.imageId === 'bytedance/seedream-5.0-pro' &&
    MODEL_PROFILES['high-fidelity']
  ) {
    return 'high-fidelity'
  }
  return profileIdForImage(input.imageId)
}
