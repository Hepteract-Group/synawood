#!/usr/bin/env node
/**
 * Local Creative Studio render worker (Plan 01).
 *
 * Usage:
 *   npm run render:local -- --job <render_job_uuid>
 *
 * Requires repo-root `.env` with Synawood Supabase + Azure Blob values.
 * Encodes on this machine (Remotion + Chromium). Not for Vercel serverless.
 */
import {
  createServiceSupabase,
  readBlobEnv,
  readSupabaseEnv,
} from '../core/creative/src/index.ts'
import { runLocalRenderJob } from '../core/creative/src/render/run-local.ts'

const readJobId = (argv: string[]): string => {
  const flagIndex = argv.findIndex((arg) => arg === '--job' || arg === '-j')
  if (flagIndex >= 0 && argv[flagIndex + 1]) {
    return argv[flagIndex + 1]!
  }
  const positional = argv.find((arg) => !arg.startsWith('-'))
  if (positional) {
    return positional
  }
  throw new Error('Usage: npm run render:local -- --job <render_job_uuid>')
}

const main = async () => {
  const jobId = readJobId(process.argv.slice(2))
  const supabase = createServiceSupabase(readSupabaseEnv(process.env))
  const blobEnv = readBlobEnv(process.env)
  console.log(`Rendering job ${jobId}…`)
  const result = await runLocalRenderJob({ supabase, blobEnv, jobId })
  console.log(
    JSON.stringify(
      {
        ok: true,
        jobId: result.jobId,
        durationMs: result.durationMs,
        mp4BlobKey: result.mp4BlobKey,
        stillBlobKey: result.stillBlobKey,
        outputAssetIds: result.outputAssetIds,
      },
      null,
      2,
    ),
  )
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
