/** Wave 2J / #580 — mid-window keyframe (video) or the still itself (image). */

import { extractVideoFrameJpegResult } from '../project/media-probe'

export type AssetMediaKind = 'video' | 'image' | 'audio' | 'other'

export type ExtractFrameJpeg = (input: {
  bytes: Uint8Array
  contentType: string
  fileName: string
  seekSeconds: number
}) => Promise<Buffer | null>

export type ExtractShotThumbResult =
  { skipped: false; bytes: Buffer; contentType: string } | { skipped: true; reason: string }

export const shotNeedsKeyframeThumb = (kind: AssetMediaKind): boolean =>
  kind === 'video' || kind === 'image'

/** Midpoint of the shot window in seconds. Open-ended windows seek at start. */
export const shotThumbSeekSeconds = (startMs: number, endMs: number | null): number => {
  const end = endMs == null || endMs <= startMs ? startMs : endMs
  return Math.max(0, (startMs + end) / 2000)
}

export const extractShotThumbBytes = async (input: {
  kind: AssetMediaKind
  bytes: Uint8Array
  contentType: string
  fileName: string
  startMs: number
  endMs: number | null
  extractFrame?: ExtractFrameJpeg
}): Promise<ExtractShotThumbResult> => {
  if (input.kind === 'image') {
    return {
      skipped: false,
      bytes: Buffer.from(input.bytes),
      contentType: input.contentType || 'image/jpeg',
    }
  }
  if (input.kind !== 'video') {
    return { skipped: true, reason: `no video frame on ${input.kind} assets` }
  }

  const extractFrame = input.extractFrame
  if (extractFrame) {
    const jpeg = await extractFrame({
      bytes: input.bytes,
      contentType: input.contentType,
      fileName: input.fileName,
      seekSeconds: shotThumbSeekSeconds(input.startMs, input.endMs),
    })
    if (!jpeg || jpeg.byteLength === 0) {
      return { skipped: true, reason: 'ffmpeg did not return a keyframe' }
    }
    return { skipped: false, bytes: jpeg, contentType: 'image/jpeg' }
  }

  const framed = await extractVideoFrameJpegResult({
    bytes: input.bytes,
    contentType: input.contentType,
    fileName: input.fileName,
    seekSeconds: shotThumbSeekSeconds(input.startMs, input.endMs),
  })
  if (!framed.ok) {
    return { skipped: true, reason: framed.reason }
  }
  return { skipped: false, bytes: framed.bytes, contentType: 'image/jpeg' }
}
