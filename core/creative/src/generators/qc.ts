import type { AssetRef } from './types'

const MIN_BYTES = 1

/**
 * ADR-0018 QC gate: generated media must be non-empty and kind-consistent
 * before we attach it to the project or report ok to the agent.
 */
export const assertGeneratedAssetQc = (asset: AssetRef): void => {
  if (!asset.bytes || asset.bytes.byteLength < MIN_BYTES) {
    throw new Error(
      `Generated ${asset.kind} is empty (0 bytes). The model returned no usable media — retry or switch image/video model.`,
    )
  }

  if (asset.kind === 'image' && !asset.contentType.startsWith('image/')) {
    throw new Error(
      `Generated image has non-image content type "${asset.contentType}". Refusing to attach.`,
    )
  }
  if (asset.kind === 'video' && !asset.contentType.startsWith('video/')) {
    throw new Error(
      `Generated video has non-video content type "${asset.contentType}". Refusing to attach.`,
    )
  }
  if (asset.kind === 'audio' && !asset.contentType.startsWith('audio/')) {
    throw new Error(
      `Generated audio has non-audio content type "${asset.contentType}". Refusing to attach.`,
    )
  }

  if (asset.kind === 'video') {
    const duration = Number(asset.probe.durationSeconds ?? asset.probe.durationFrames ?? 0)
    if (!(duration > 0)) {
      throw new Error(
        'Generated video is missing a positive duration in probe — refusing to attach.',
      )
    }
  }
}
