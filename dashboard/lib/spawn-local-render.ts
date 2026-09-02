import { spawn } from 'node:child_process'
import path from 'node:path'

/** Repo root when Next is started from `dashboard/` (local-first). */
const repoRoot = () => path.resolve(process.cwd(), '..')

/**
 * Remotion's `bundle()` cannot run inside a Next.js API route (webpack cannot
 * re-bundle webpack/rspack native bindings). Spawn the standalone worker instead.
 */
export const spawnLocalRenderWorker = (jobId: string): void => {
  const child = spawn('npm', ['run', 'render:local', '--', '--job', jobId], {
    cwd: repoRoot(),
    env: process.env,
    stdio: 'inherit',
    detached: true,
  })
  child.unref()
  child.on('error', (error) => {
    console.error('[studio render worker spawn]', error)
  })
}
