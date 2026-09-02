/** Lip-sync quality floor (ADR-0033 / #219). */

import type { StudioProject } from '../project/schema'

export const LIPSYNC_MAX_DRIFT = 0.15

export const assertLipsyncQualityFloor = (input: {
  videoKind: string
  audioKind: string
  videoDurationFrames: number
  audioDurationFrames: number
}): void => {
  if (input.videoKind !== 'video') {
    throw new Error('Lip-sync needs a video clip (not a still).')
  }
  if (input.audioKind !== 'audio') {
    throw new Error('Lip-sync needs an audio clip.')
  }
  const denom = Math.max(input.videoDurationFrames, 1)
  const drift = Math.abs(input.videoDurationFrames - input.audioDurationFrames) / denom
  if (drift > LIPSYNC_MAX_DRIFT) {
    throw new Error(
      'Lip-sync quality floor: audio and video duration differ by more than 15%. Trim them to match, then retry.',
    )
  }
}

export const resolveLipsyncPair = (
  project: StudioProject,
  input: { videoClipId: string; audioClipId: string },
) => {
  const videoClip = project.clips.find((clip) => clip.id === input.videoClipId)
  const audioClip = project.clips.find((clip) => clip.id === input.audioClipId)
  if (!videoClip) throw new Error(`Unknown video clip: ${input.videoClipId}`)
  if (!audioClip) throw new Error(`Unknown audio clip: ${input.audioClipId}`)
  const videoAsset = project.assets.find((asset) => asset.id === videoClip.assetId)
  const audioAsset = project.assets.find((asset) => asset.id === audioClip.assetId)
  if (!videoAsset) throw new Error('Video clip has no asset.')
  if (!audioAsset) throw new Error('Audio clip has no asset.')
  assertLipsyncQualityFloor({
    videoKind: videoAsset.kind,
    audioKind: audioAsset.kind,
    videoDurationFrames: videoClip.durationInFrames,
    audioDurationFrames: audioClip.durationInFrames,
  })
  return { videoClip, audioClip, videoAsset, audioAsset }
}
