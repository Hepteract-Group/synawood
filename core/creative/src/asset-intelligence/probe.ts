/** Wave 2C / #164 — rich media probe for indexing (extends upload probe). */

import { parseMedia } from '@remotion/media-parser'
import { nodeReader } from '@remotion/media-parser/node'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { probeMediaDurationSeconds } from '../project/media-probe'

export type AssetProbeResult = {
  durationSeconds: number | null
  width: number | null
  height: number | null
  fps: number | null
  videoCodec: string | null
  audioCodec: string | null
  container: string | null
}

const extensionFor = (contentType: string, fileName = ''): string => {
  if (/\.webm$/i.test(fileName) || contentType.includes('webm')) return 'webm'
  if (/\.mov$/i.test(fileName) || contentType.includes('quicktime')) return 'mov'
  if (/\.png$/i.test(fileName) || contentType.includes('png')) return 'png'
  if (/\.jpe?g$/i.test(fileName) || contentType.includes('jpeg')) return 'jpg'
  if (/\.mp3$/i.test(fileName) || contentType.includes('mpeg')) return 'mp3'
  if (/\.wav$/i.test(fileName) || contentType.includes('wav')) return 'wav'
  if (/\.mp4$/i.test(fileName) || contentType.includes('mp4')) return 'mp4'
  return 'bin'
}

export const probeAssetBytes = async (input: {
  bytes: Uint8Array
  contentType: string
  fileName?: string
  kind: 'video' | 'image' | 'audio' | 'other'
}): Promise<AssetProbeResult> => {
  const empty: AssetProbeResult = {
    durationSeconds: null,
    width: null,
    height: null,
    fps: null,
    videoCodec: null,
    audioCodec: null,
    container: null,
  }
  if (input.bytes.byteLength < 16) return empty

  if (input.kind === 'image') {
    // Images: media-parser may fail; duration null; leave dims to later if needed.
    return empty
  }

  const ext = extensionFor(input.contentType, input.fileName ?? '')
  const dir = await mkdtemp(join(tmpdir(), 'mos-asset-probe-'))
  const path = join(dir, `probe.${ext}`)
  try {
    await writeFile(path, input.bytes)
    try {
      const result = await parseMedia({
        src: path,
        reader: nodeReader,
        fields: {
          durationInSeconds: true,
          dimensions: true,
          fps: true,
          videoCodec: true,
          audioCodec: true,
          container: true,
        },
        acknowledgeRemotionLicense: true,
      })
      const seconds =
        typeof result.durationInSeconds === 'number' &&
        Number.isFinite(result.durationInSeconds) &&
        result.durationInSeconds > 0
          ? result.durationInSeconds
          : null
      const width = typeof result.dimensions?.width === 'number' ? result.dimensions.width : null
      const height = typeof result.dimensions?.height === 'number' ? result.dimensions.height : null
      const fps =
        typeof result.fps === 'number' && Number.isFinite(result.fps) && result.fps > 0
          ? result.fps
          : null
      return {
        durationSeconds: seconds,
        width,
        height,
        fps,
        videoCodec: typeof result.videoCodec === 'string' ? result.videoCodec : null,
        audioCodec: typeof result.audioCodec === 'string' ? result.audioCodec : null,
        container: typeof result.container === 'string' ? result.container : null,
      }
    } catch {
      const seconds = await probeMediaDurationSeconds(
        input.bytes,
        input.contentType,
        input.fileName ?? '',
      )
      return { ...empty, durationSeconds: seconds }
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
