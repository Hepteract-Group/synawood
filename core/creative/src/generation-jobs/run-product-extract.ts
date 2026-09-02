import type { SupabaseClient } from '@supabase/supabase-js'
import type { BlobEnv } from '../persistence/blob'
import { captureSection, type SectionCaptureResult } from '../extract/capture-section'
import type { LaunchBrowser } from '../extract/capture-page-screenshot'
import type { HostLookup } from '../extract/ssrf'
import type { FetchLike } from '../extract/url-adapter'
import { finalizeCostEvent } from '../pricing/ledger'
import { getGenerationJob, markGenerationJob } from './enqueue'
import { PRODUCT_EXTRACT_JOB_KIND } from '../extract/enqueue-product-extract-job'

export type RunProductExtractResult = {
  jobId: string
  attempted: number
  captured: number
  skipped: number
  results: SectionCaptureResult[]
}

/**
 * Worker runner for `product_pages` extract jobs (ADR-0089 §6).
 *
 * Visits each public URL in the job snapshot, writes ProductExtract rows
 * (screenshot + text), and marks the job ready. Soft-fails bad pages — one
 * 404 or auth wall does not abort the remaining URLs.
 *
 * After the loop, zero stills means the Extracts grid is empty. That is not a
 * single-page skip — mark failed so the banner cannot look like success.
 */
export const runProductExtractJob = async (input: {
  supabase: SupabaseClient
  blobEnv: BlobEnv
  jobId: string
  /** Override DNS lookup for test isolation. */
  lookup?: HostLookup
  /** Override fetch for test isolation. */
  fetchImpl?: FetchLike
  /** Override browser launch for test isolation. */
  launchBrowser?: LaunchBrowser
}): Promise<RunProductExtractResult> => {
  const job = await getGenerationJob(input.supabase, input.jobId)
  if (!job) {
    throw new Error(`Generation job not found: ${input.jobId}`)
  }
  if (job.role !== 'extract') {
    throw new Error(`Job ${input.jobId} is not an extract job`)
  }

  const snapshot = job.input_snapshot ?? {}
  if (snapshot.extractKind !== PRODUCT_EXTRACT_JOB_KIND) {
    throw new Error(
      `Job ${input.jobId} is not a product_pages extract (extractKind=${String(snapshot.extractKind)})`,
    )
  }

  const rawUrls = Array.isArray(snapshot.urls) ? (snapshot.urls as unknown[]) : []
  const urls = rawUrls.filter((u): u is string => typeof u === 'string' && Boolean(u.trim()))

  if (urls.length === 0) {
    throw new Error(`product_pages extract job ${input.jobId} has no URLs`)
  }

  try {
    await markGenerationJob(input.supabase, job.id, {
      status: 'generating',
      attempt_count: (job.attempt_count ?? 0) + 1,
    })

    const results: SectionCaptureResult[] = []

    for (const url of urls) {
      const result = await captureSection({
        supabase: input.supabase,
        blobEnv: input.blobEnv,
        productId: job.product_id,
        jobId: job.id,
        url,
        lookup: input.lookup,
        fetchImpl: input.fetchImpl,
        launchBrowser: input.launchBrowser,
      })
      results.push(result)

      if (result.skipped) {
        console.warn(
          `[run-product-extract] Skipped ${url} (${result.skipped}): ${result.skipReason ?? ''}`,
        )
      }
    }

    const captured = results.filter((r) => !r.skipped).length
    const skipped = results.filter((r) => Boolean(r.skipped)).length
    const stills = results.filter((r) => Boolean(r.screenshotExtract)).length
    const estimatedGbp = job.estimated_gbp ?? 0

    if (stills === 0) {
      const reasons = results
        .map((r) => r.screenshotError ?? r.skipReason)
        .filter((msg): msg is string => Boolean(msg))
      throw new Error(
        `No stills landed in the Extracts bin. ${reasons.join('; ') || 'Screenshot capture failed on every page.'}`.slice(
          0,
          500,
        ),
      )
    }

    await markGenerationJob(input.supabase, job.id, {
      status: 'ready',
      actual_gbp: estimatedGbp,
      error_message:
        skipped > 0
          ? `${skipped} of ${urls.length} pages skipped; see job results`.slice(0, 500)
          : null,
    })

    await finalizeCostEvent(input.supabase, {
      productId: job.product_id,
      projectId: job.project_id ?? undefined,
      jobId: job.id,
      role: 'extract',
      modelId: job.model_id ?? undefined,
      units: urls.length,
      estimatedGbp,
      actualGbp: estimatedGbp,
    })

    return {
      jobId: job.id,
      attempted: urls.length,
      captured,
      skipped,
      results,
    }
  } catch (error) {
    await markGenerationJob(input.supabase, job.id, {
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Product extract job failed',
    })
    throw error
  }
}
