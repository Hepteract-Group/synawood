import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, openSync } from 'node:fs'
import path from 'node:path'

export const repoRootFromCwd = (cwd = process.cwd()): string => {
  if (existsSync(path.join(cwd, 'automations/creative-extract.ts'))) return cwd
  const parent = path.resolve(cwd, '..')
  if (existsSync(path.join(parent, 'automations/creative-extract.ts'))) return parent
  return cwd
}

export const EXTRACT_WORKER_LOG = 'docs/local/extract-worker.log'

/** Spawn `tsx automations/creative-extract.ts` — not `npm run`, which dies detached. */
export const localExtractWorkerSpawn = (
  jobId: string,
  cwd = process.cwd(),
): { cmd: string; args: string[]; cwd: string } => ({
  cmd: process.execPath,
  args: [
    '--env-file-if-exists=.env',
    '--import',
    'tsx',
    'automations/creative-extract.ts',
    '--job',
    jobId,
  ],
  cwd: repoRootFromCwd(cwd),
})

/** Spawn local extract worker (URL/PDF digest → ExtractedBrief, or product_pages stills). */
export const spawnLocalExtractWorker = (jobId: string): void => {
  const spec = localExtractWorkerSpawn(jobId)
  const logDir = path.join(spec.cwd, 'docs/local')
  mkdirSync(logDir, { recursive: true })
  const logFd = openSync(path.join(spec.cwd, EXTRACT_WORKER_LOG), 'a')
  const child = spawn(spec.cmd, spec.args, {
    cwd: spec.cwd,
    env: process.env,
    stdio: ['ignore', logFd, logFd],
    detached: true,
  })
  child.unref()
  child.on('error', (error) => {
    console.error('[studio extract worker spawn]', error)
  })
  console.info(`[studio extract worker spawn] job=${jobId} log=${EXTRACT_WORKER_LOG}`)
}
