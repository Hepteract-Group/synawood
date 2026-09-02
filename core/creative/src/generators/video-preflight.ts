/** Known vendor limits checked before confirmSpend / Gateway (#603, #608). */

import { resolveVideoModelFamily } from '../model-profiles/video-families'
import {
  videoModelLabel,
  videoModelMaxInputImageBytes,
  videoModelMaxInputImages,
  videoModelMaxInputVideos,
} from '../model-profiles/video-models'

export type VideoGeneratePreflightInput = {
  modelId: string
  stillCount: number
  videoCount?: number
  audioCount?: number
  otherCount?: number
  stillByteLengths?: number[]
  firstStillSize?: { width: number; height: number }
  lastStillSize?: { width: number; height: number }
}

export type VideoGeneratePreflightResult =
  | { ok: true }
  | {
      ok: false
      code:
        | 'still_count'
        | 'still_size'
        | 'video_count'
        | 'unsupported_ref'
        | 'audio_ref'
        | 'last_frame_ratio'
      message: string
    }

const creditsUntouched = 'I have not generated anything — no credits used.'

const ASPECT_RATIO_EPSILON = 0.04

export const stillAspectsMismatch = (
  first: { width: number; height: number },
  last: { width: number; height: number },
): boolean => {
  if (first.width <= 0 || first.height <= 0 || last.width <= 0 || last.height <= 0) return false
  return Math.abs(first.width / first.height - last.width / last.height) > ASPECT_RATIO_EPSILON
}

export const preflightVideoGenerate = (
  input: VideoGeneratePreflightInput,
): VideoGeneratePreflightResult => {
  const maxStills = videoModelMaxInputImages(input.modelId)
  if (input.stillCount > maxStills) {
    const label = videoModelLabel(input.modelId)
    const stillWord = maxStills === 1 ? 'still' : 'stills'
    return {
      ok: false,
      code: 'still_count',
      message: `${label} takes ${maxStills} ${stillWord}; you passed ${input.stillCount}. Drop extras or switch to a model that accepts more (Seedance 2.0 Fast: 9, Seedance 2.5: 50). ${creditsUntouched}`,
    }
  }

  const maxBytes = videoModelMaxInputImageBytes(input.modelId)
  if (maxBytes != null && input.stillByteLengths) {
    const tooBig = input.stillByteLengths.findIndex((bytes) => bytes > maxBytes)
    if (tooBig >= 0) {
      const mb = Math.round(maxBytes / (1024 * 1024))
      return {
        ok: false,
        code: 'still_size',
        message: `Still ${tooBig + 1} is larger than this model allows (${mb}MB). Shrink the file. ${creditsUntouched}`,
      }
    }
  }

  if ((input.audioCount ?? 0) > 0) {
    const label = videoModelLabel(input.modelId)
    return {
      ok: false,
      code: 'audio_ref',
      message: `${label} does not take audio files as generate refs. Drop the audio tag and keep the still or clip. ${creditsUntouched}`,
    }
  }

  if ((input.otherCount ?? 0) > 0) {
    return {
      ok: false,
      code: 'unsupported_ref',
      message: `One of the tagged files is not a still or a video clip. Drop it and tag the collection photo instead. ${creditsUntouched}`,
    }
  }

  const maxVideos = videoModelMaxInputVideos(input.modelId)
  const videoCount = input.videoCount ?? 0
  if (videoCount > maxVideos) {
    const label = videoModelLabel(input.modelId)
    if (maxVideos === 0) {
      return {
        ok: false,
        code: 'video_count',
        message: `${label} takes stills only; you tagged a video. Switch to Seedance 2.0 Fast (video refs) or drop the clip. ${creditsUntouched}`,
      }
    }
    return {
      ok: false,
      code: 'video_count',
      message: `${label} takes ${maxVideos} video refs; you passed ${videoCount}. Drop extras. ${creditsUntouched}`,
    }
  }

  if (
    resolveVideoModelFamily(input.modelId) === 'seedance' &&
    input.firstStillSize &&
    input.lastStillSize &&
    stillAspectsMismatch(input.firstStillSize, input.lastStillSize)
  ) {
    return {
      ok: false,
      code: 'last_frame_ratio',
      message: `The first still and last still have different aspect ratios. Seedance needs matching ratios for first/last frame. Crop one or drop the last still. ${creditsUntouched}`,
    }
  }

  return { ok: true }
}
