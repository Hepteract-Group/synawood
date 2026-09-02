import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import type { BlobEnv } from '../persistence/blob'
import type { StudioProject } from '../project/schema'
import type { CutReviewStill } from './inspect-preview'

const CUT_REVIEW_SCRIPT = 'automations/creative-cut-review.ts'
const SPAWN_TIMEOUT_MS = 180_000

export type CutReviewSpawnFn = (
  command: string,
  args: readonly string[],
  options: SpawnOptions,
) => ChildProcess

export const findMarketingOsRoot = (start = process.cwd()): string => {
  let dir = start
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(path.join(dir, CUT_REVIEW_SCRIPT))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error(`Could not find ${CUT_REVIEW_SCRIPT} from ${start}`)
}

export const parseCutReviewWorkerResult = (stdout: string): CutReviewStill[] => {
  const start = stdout.indexOf('{')
  const end = stdout.lastIndexOf('}')
  if (start < 0 || end <= start) {
    throw new Error('Cut-review worker did not return JSON stills.')
  }
  const parsed = JSON.parse(stdout.slice(start, end + 1)) as {
    ok?: boolean
    error?: string
    stills?: Array<{ frame: number; bytesBase64: string }>
  }
  if (!parsed.ok) {
    throw new Error(parsed.error ?? 'Cut-review worker failed.')
  }
  return (parsed.stills ?? []).map((row) => ({
    frame: row.frame,
    bytes: Buffer.from(row.bytesBase64, 'base64'),
  }))
}

/**
 * Encode cut-review stills in a child process. Remotion `bundle()` cannot run
 * inside a Next.js API route (see `dashboard/lib/spawn-local-render.ts`).
 */
export const spawnCutReviewStills = async (input: {
  project: StudioProject
  blobEnv: BlobEnv
  frames: number[]
  spawnFn?: CutReviewSpawnFn
}): Promise<CutReviewStill[]> => {
  if (input.frames.length === 0) return []
  const cwd = findMarketingOsRoot()
  const spawnChild = input.spawnFn ?? spawn
  const child = spawnChild(process.execPath, ['--import', 'tsx', CUT_REVIEW_SCRIPT], {
    cwd,
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const errChunks: Buffer[] = []
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('Cut-review snapshot timed out after 180s.'))
    }, SPAWN_TIMEOUT_MS)

    child.stdout?.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.from(chunk))
    })
    child.stderr?.on('data', (chunk: Buffer | string) => {
      errChunks.push(Buffer.from(chunk))
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      const stdout = Buffer.concat(chunks).toString('utf8')
      const stderr = Buffer.concat(errChunks).toString('utf8')
      if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `Cut-review worker exited ${code}`))
        return
      }
      try {
        resolve(parseCutReviewWorkerResult(stdout))
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
    child.stdin?.write(JSON.stringify({ project: input.project, frames: input.frames }))
    child.stdin?.end()
  })
}
