#!/usr/bin/env node
/**
 * Local Creative Studio extract worker (Wave 2B / #151 / #1365).
 *
 * Usage:
 *   npm run extract:local -- --job <generation_job_uuid>
 *
 * Dispatches product_pages jobs (Extracts bin) vs URL/PDF ExtractedBrief jobs.
 */
import {
  createServiceSupabase,
  readBlobEnv,
  readSupabaseEnv,
} from '../core/creative/src/index.ts'
import { PRODUCT_EXTRACT_JOB_KIND } from '../core/creative/src/extract/enqueue-product-extract-job.ts'
import { getGenerationJob } from '../core/creative/src/generation-jobs/enqueue.ts'
import { runExtractJob } from '../core/creative/src/generation-jobs/run-extract.ts'
import { runProductExtractJob } from '../core/creative/src/generation-jobs/run-product-extract.ts'

const readJobId = (argv: string[]): string => {
  const flagIndex = argv.findIndex((arg) => arg === '--job' || arg === '-j')
  if (flagIndex >= 0 && argv[flagIndex + 1]) {
    return argv[flagIndex + 1]!
  }
  const positional = argv.find((arg) => !arg.startsWith('-'))
  if (positional) return positional
  throw new Error('Usage: npm run extract:local -- --job <generation_job_uuid>')
}

const main = async () => {
  const jobId = readJobId(process.argv.slice(2))
  const supabase = createServiceSupabase(readSupabaseEnv(process.env))
  const blobEnv = readBlobEnv(process.env)
  console.log(`Extracting job ${jobId}…`)
  const job = await getGenerationJob(supabase, jobId)
  if (!job) {
    throw new Error(`Generation job not found: ${jobId}`)
  }
  if (job.input_snapshot?.extractKind === PRODUCT_EXTRACT_JOB_KIND) {
    const result = await runProductExtractJob({ supabase, blobEnv, jobId })
    console.log(JSON.stringify({ ok: true, kind: 'product_pages', ...result }, null, 2))
    return
  }
  const result = await runExtractJob({ supabase, blobEnv, jobId })
  console.log(JSON.stringify({ ok: true, kind: 'brief', ...result, brief: { id: result.brief.id } }, null, 2))
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
