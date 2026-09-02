import type { ProjectAsset, ProjectClip, StudioProject } from '../project/schema'

export const SPEECH_ENHANCED_PROBE_KEY = 'speechEnhanced'

export const isStubEnhanceModelId = (modelId: string): boolean =>
  modelId.startsWith('mock') ||
  modelId === 'disabled' ||
  modelId.includes('stub') ||
  modelId.includes('ci-')

export const isSpeechEnhancedProbe = (probe: Record<string, unknown> | undefined): boolean =>
  probe?.[SPEECH_ENHANCED_PROBE_KEY] === true

export type EnhanceSpeechPlan =
  | { ok: false; error: string }
  | {
      ok: true
      skip: true
      clip: ProjectClip
      asset: ProjectAsset
      reason: string
    }
  | {
      ok: true
      skip: false
      clip: ProjectClip
      asset: ProjectAsset
    }

export const planEnhanceSpeech = (
  project: StudioProject,
  input: { clipId?: string; assetId?: string },
): EnhanceSpeechPlan => {
  const clip = input.clipId
    ? project.clips.find((item) => item.id === input.clipId)
    : input.assetId
      ? project.clips.find((item) => item.assetId === input.assetId)
      : undefined
  if (!clip) {
    return { ok: false, error: 'Select a talking-head clip to enhance.' }
  }
  const asset = project.assets.find((item) => item.id === clip.assetId)
  if (!asset) {
    return { ok: false, error: 'That clip’s media is missing from this project.' }
  }
  if (asset.kind !== 'audio' && asset.kind !== 'video') {
    return { ok: false, error: 'Speech enhance needs an audio or video clip.' }
  }
  if (isSpeechEnhancedProbe(asset.probe)) {
    return {
      ok: true,
      skip: true,
      clip,
      asset,
      reason: 'This take is already enhanced — skipped.',
    }
  }
  return { ok: true, skip: false, clip, asset }
}

export const enhancedProbeFor = (
  source: ProjectAsset,
  modelId: string,
): Record<string, unknown> => ({
  ...source.probe,
  [SPEECH_ENHANCED_PROBE_KEY]: true,
  enhancedFromAssetId: source.id,
  enhanceModelId: modelId,
})
