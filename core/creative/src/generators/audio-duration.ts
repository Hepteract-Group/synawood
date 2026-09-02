import { parseMedia } from '@remotion/media-parser'
import { nodeReader } from '@remotion/media-parser/node'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Measure duration of an in-memory audio file (mp3/wav/m4a…).
 * Falls back to null when the container cannot be parsed.
 */
export const probeAudioDurationSeconds = async (
  bytes: Uint8Array,
  contentType = 'audio/mpeg',
): Promise<number | null> => {
  if (bytes.byteLength < 16) return null
  const ext = contentType.includes('wav')
    ? 'wav'
    : contentType.includes('mp4') || contentType.includes('m4a') || contentType.includes('aac')
      ? 'm4a'
      : contentType.includes('ogg')
        ? 'ogg'
        : contentType.includes('webm')
          ? 'webm'
          : 'mp3'
  const dir = await mkdtemp(join(tmpdir(), 'mos-audio-'))
  const path = join(dir, `probe.${ext}`)
  try {
    await writeFile(path, bytes)
    const result = await parseMedia({
      src: path,
      reader: nodeReader,
      fields: { durationInSeconds: true },
      acknowledgeRemotionLicense: true,
    })
    const seconds = result.durationInSeconds
    if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) {
      return null
    }
    return seconds
  } catch {
    return null
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

export const durationFramesFromSeconds = (seconds: number, fps = 30): number =>
  Math.max(1, Math.round(seconds * fps))
