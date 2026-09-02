#!/usr/bin/env node
/**
 * Drain queued extract + render jobs (Docker / Fly worker).
 *
 * Usage:
 *   node --import tsx automations/studio-workers-poll.ts
 */
import { createServiceSupabase, readBlobEnv, readSupabaseEnv } from '../core/creative/src/index.ts'
import { PRODUCT_EXTRACT_JOB_KIND } from '../core/creative/src/extract/enqueue-product-extract-job.ts'
import { getGenerationJob } from '../core/creative/src/generation-jobs/enqueue.ts'
import {
  listQueuedExtractJobs,
  listQueuedRenderJobs,
} from '../core/creative/src/generation-jobs/list-queued-worker-jobs.ts'
import { runExtractJob } from '../core/creative/src/generation-jobs/run-extract.ts'
import { runProductExtractJob } from '../core/creative/src/generation-jobs/run-product-extract.ts'
import { runLocalRenderJob } from '../core/creative/src/render/run-local.ts'

const POLL_MS = 3_000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const drainOnce = async () => {
  const supabase = createServiceSupabase(readSupabaseEnv(process.env))
  const blobEnv = readBlobEnv(process.env)

  const extracts = await listQueuedExtractJobs(supabase)
  for (const job of extracts) {
    try {
      console.log(`[workers] extract ${job.id}`)
      const loaded = await getGenerationJob(supabase, job.id)
      if (!loaded) continue
      if (loaded.input_snapshot?.extractKind === PRODUCT_EXTRACT_JOB_KIND) {
        await runProductExtractJob({ supabase, blobEnv, jobId: job.id })
      } else {
        await runExtractJob({ supabase, blobEnv, jobId: job.id })
      }
    } catch (error) {
      console.error(
        `[workers] extract ${job.id} failed:`,
        error instanceof Error ? error.message : error,
      )
    }
  }

  const renders = await listQueuedRenderJobs(supabase)
  for (const job of renders) {
    try {
      console.log(`[workers] render ${job.id}`)
      await runLocalRenderJob({ supabase, blobEnv, jobId: job.id })
    } catch (error) {
      console.error(
        `[workers] render ${job.id} failed:`,
        error instanceof Error ? error.message : error,
      )
    }
  }
}

const main = async () => {
  console.log('[workers] polling extract + render queues')
  for (;;) {
    try {
      await drainOnce()
    } catch (error) {
      console.error('[workers] poll tick failed:', error instanceof Error ? error.message : error)
    }
    await sleep(POLL_MS)
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
