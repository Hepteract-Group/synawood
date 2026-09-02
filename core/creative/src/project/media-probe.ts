import { parseMedia } from '@remotion/media-parser'
import { nodeReader } from '@remotion/media-parser/node'
import { spawn } from 'node:child_process'
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const extensionFor = (contentType: string, fileName = ''): string => {
  if (/\.webm$/i.test(fileName) || contentType.includes('webm')) return 'webm'
  if (/\.mov$/i.test(fileName) || contentType.includes('quicktime')) return 'mov'
  if (/\.m4a$/i.test(fileName) || contentType.includes('m4a')) return 'm4a'
  if (/\.mp3$/i.test(fileName) || contentType.includes('mpeg')) return 'mp3'
  if (/\.wav$/i.test(fileName) || contentType.includes('wav')) return 'wav'
  if (/\.mp4$/i.test(fileName) || contentType.includes('mp4')) return 'mp4'
  return 'bin'
}

const runCommand = (
  command: string,
  args: string[],
  timeoutMs = 20_000,
): Promise<{ code: number; stdout: string; stderr: string }> =>
  new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      resolve({ code: 1, stdout, stderr: `${stderr}\ntimeout` })
    }, timeoutMs)
    child.stdout?.on('data', (chunk) => {
      stdout += String(chunk)
    })
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      resolve({ code: 1, stdout, stderr: error.message })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? 1, stdout, stderr })
    })
  })

/** Prefer remotion media-parser; fall back to ffprobe when available. */
export const probeMediaDurationSeconds = async (
  bytes: Uint8Array,
  contentType = 'application/octet-stream',
  fileName = '',
): Promise<number | null> => {
  if (bytes.byteLength < 16) return null
  const ext = extensionFor(contentType, fileName)
  const dir = await mkdtemp(join(tmpdir(), 'mos-media-probe-'))
  const path = join(dir, `probe.${ext}`)
  try {
    await writeFile(path, bytes)
    try {
      const result = await parseMedia({
        src: path,
        reader: nodeReader,
        fields: { durationInSeconds: true },
        acknowledgeRemotionLicense: true,
      })
      const seconds = result.durationInSeconds
      if (typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0) {
        return seconds
      }
    } catch {
      // fall through to ffprobe
    }

    const probed = await runCommand('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      path,
    ])
    if (probed.code !== 0) return null
    const seconds = Number(probed.stdout.trim())
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null
  } catch {
    return null
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

export const durationFramesFromSeconds = (seconds: number, fps = 30): number =>
  Math.max(1, Math.round(seconds * fps))

/** JPEG frame via ffmpeg at `seekSeconds`. */
export type ExtractVideoFrameResult = { ok: true; bytes: Buffer } | { ok: false; reason: string }

export const extractVideoFrameJpegResult = async (input: {
  bytes: Uint8Array
  contentType?: string
  fileName?: string
  seekSeconds: number
}): Promise<ExtractVideoFrameResult> => {
  const bytes = input.bytes
  if (bytes.byteLength < 16) return { ok: false, reason: 'media too short to extract a frame' }
  const contentType = input.contentType ?? 'video/mp4'
  const fileName = input.fileName ?? ''
  const seek = Number.isFinite(input.seekSeconds) ? Math.max(0, input.seekSeconds) : 0
  const ext = extensionFor(contentType, fileName)
  const dir = await mkdtemp(join(tmpdir(), 'mos-poster-'))
  const inputPath = join(dir, `in.${ext}`)
  const outputPath = join(dir, 'poster.jpg')
  try {
    await writeFile(inputPath, bytes)
    const result = await runCommand(
      'ffmpeg',
      [
        '-y',
        '-ss',
        seek.toFixed(3),
        '-i',
        inputPath,
        '-frames:v',
        '1',
        '-vf',
        'scale=480:-2',
        '-q:v',
        '6',
        outputPath,
      ],
      30_000,
    )
    if (result.code !== 0) {
      const detail = result.stderr.trim().replace(/\s+/g, ' ').slice(-180)
      return { ok: false, reason: detail || `ffmpeg exit ${result.code}` }
    }
    return { ok: true, bytes: await readFile(outputPath) }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'frame extract failed'
    return { ok: false, reason: message }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/** JPEG frame via ffmpeg at `seekSeconds` — null when ffmpeg/decode fails. */
export const extractVideoFrameJpeg = async (input: {
  bytes: Uint8Array
  contentType?: string
  fileName?: string
  seekSeconds: number
}): Promise<Buffer | null> => {
  const result = await extractVideoFrameJpegResult(input)
  return result.ok ? result.bytes : null
}

/** Small JPEG poster via ffmpeg — null when ffmpeg/decode fails. */
export const extractVideoPosterJpeg = async (
  bytes: Uint8Array,
  contentType = 'video/mp4',
  fileName = '',
): Promise<Buffer | null> =>
  extractVideoFrameJpeg({ bytes, contentType, fileName, seekSeconds: 0.15 })
