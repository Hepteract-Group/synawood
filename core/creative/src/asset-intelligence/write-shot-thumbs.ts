/** Wave 2J / #580 — Blob keyframes for heuristic shots. Soft-fail extract. */

import { putBlob as putBlobDefault, type BlobEnv } from '../persistence/blob'
import {
  extractShotThumbBytes,
  shotNeedsKeyframeThumb,
  type AssetMediaKind,
  type ExtractShotThumbResult,
} from './extract-shot-thumb'
import type { ProposedShot } from './shots'
import { KEYFRAME_THUMBS_MISSING_PREFIX } from './thumbs-missing'

export type WriteShotThumbsResult = {
  thumbBlobKeyByOrdinal: Record<number, string>
  thumbNote: string | null
}

const thumbFileName = (ordinal: number, contentType: string): string => {
  if (contentType.includes('png')) return `shot-${ordinal}-thumb.png`
  if (contentType.includes('webp')) return `shot-${ordinal}-thumb.webp`
  return `shot-${ordinal}-thumb.jpg`
}

export const writeShotThumbs = async (input: {
  blobEnv: BlobEnv
  productId: string
  assetId: string
  kind: AssetMediaKind
  bytes: Uint8Array
  contentType: string
  fileName: string
  shots: ProposedShot[]
  putBlob?: typeof putBlobDefault
  extractShotThumb?: (args: {
    kind: AssetMediaKind
    bytes: Uint8Array
    contentType: string
    fileName: string
    startMs: number
    endMs: number | null
  }) => Promise<ExtractShotThumbResult>
}): Promise<WriteShotThumbsResult> => {
  const thumbBlobKeyByOrdinal: Record<number, string> = {}
  if (!shotNeedsKeyframeThumb(input.kind) || input.shots.length === 0) {
    return { thumbBlobKeyByOrdinal, thumbNote: null }
  }

  const put = input.putBlob ?? putBlobDefault
  const extract = input.extractShotThumb ?? extractShotThumbBytes
  const failures: string[] = []

  for (const shot of input.shots) {
    try {
      const extracted = await extract({
        kind: input.kind,
        bytes: input.bytes,
        contentType: input.contentType,
        fileName: input.fileName,
        startMs: shot.startMs,
        endMs: shot.endMs,
      })
      if (extracted.skipped) {
        failures.push(`shot ${shot.ordinal}: ${extracted.reason}`)
        continue
      }
      const { blobKey } = await put({
        blobEnv: input.blobEnv,
        productId: input.productId,
        kind: 'uploads',
        parts: [input.assetId, thumbFileName(shot.ordinal, extracted.contentType)],
        data: extracted.bytes,
        contentType: extracted.contentType,
      })
      thumbBlobKeyByOrdinal[shot.ordinal] = blobKey
    } catch (error) {
      const message = error instanceof Error ? error.message : 'extract failed'
      failures.push(`shot ${shot.ordinal}: ${message}`)
    }
  }

  const needed = input.shots.length
  const wrote = Object.keys(thumbBlobKeyByOrdinal).length
  if (wrote >= needed) {
    return { thumbBlobKeyByOrdinal, thumbNote: null }
  }

  const detail = failures.slice(0, 3).join('; ') || 'extract failed'
  return {
    thumbBlobKeyByOrdinal,
    thumbNote: `${KEYFRAME_THUMBS_MISSING_PREFIX}: ${detail}. Retry index.`.slice(0, 500),
  }
}
