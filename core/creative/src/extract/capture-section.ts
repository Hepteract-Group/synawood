import type { SupabaseClient } from '@supabase/supabase-js'
import type { BlobEnv } from '../persistence/blob'
import type { ProductExtract } from './product-extract-schema'
import { adaptUrlSource } from './url-adapter'
import { capturePageStills } from './capture-page-stills'
import { type LaunchBrowser } from './capture-page-screenshot'
import { putExtractBlob } from './put-extract-blob'
import { insertProductExtract } from './insert-product-extract'
import { scoreScreenshotBytes, type ExtractQualityScore } from './vision-quality'
import { UnsafeUrlError, type HostLookup } from './ssrf'
import type { FetchLike } from './url-adapter'
import { randomUUID } from 'node:crypto'
import { isAuthWall } from './is-auth-wall'

export { isAuthWall }

export type SectionSkipReason = 'auth-wall' | 'http-error' | 'ssrf' | 'page-error'

export type SectionCaptureResult = {
  url: string
  screenshotExtract?: ProductExtract
  /** All stills for this URL (hero + scrolled sections + leftover nav pages). `screenshotExtract` is the first. */
  screenshotExtracts?: ProductExtract[]
  textExtract?: ProductExtract
  skipped?: SectionSkipReason
  /** Human-readable log message paired with `skipped`; not structured data. */
  skipReason?: string
  /** Screenshot failed after text capture; Extracts bin stills will be empty. */
  screenshotError?: string
  /** Text row insert failed; screenshot still runs. Distinct from “page had no copy”. */
  textInsertError?: string
}

/**
 * Capture one public URL: fetch text digest + stills (hero, scrolled sections, leftover nav pages; cap 10).
 * Soft-fails with a typed skip reason instead of throwing so the caller continues the loop.
 *
 * Screenshot runs in a fresh headless browser context (no cookies, no stored state).
 * `capturePageStills` calls `assertSafeFetchUrl` on the post-redirect URL from
 * Playwright, covering the SSRF re-check required by ADR-0089 §2.
 *
 * Text still persists when screenshot fails so copy is not lost. The job runner
 * fails the run when no stills land — Extracts bin is a stills grid.
 */
export const captureSection = async (input: {
  supabase: SupabaseClient
  blobEnv: BlobEnv
  productId: string
  jobId: string
  url: string
  lookup?: HostLookup
  fetchImpl?: FetchLike
  launchBrowser?: LaunchBrowser
  /** Injected scorer. Default is byte-size heuristic — no live vision in unit tests. */
  scoreScreenshot?: (png: Uint8Array) => ExtractQualityScore | Promise<ExtractQualityScore>
}): Promise<SectionCaptureResult> => {
  const { url, productId, jobId, supabase, blobEnv } = input

  let textExtract: ProductExtract | undefined
  let textInsertError: string | undefined
  let finalUrl = url

  try {
    const digest = await adaptUrlSource({
      url,
      lookup: input.lookup,
      fetchImpl: input.fetchImpl,
    })
    finalUrl = digest.finalUrl

    if (isAuthWall(url, digest.finalUrl)) {
      return {
        url,
        skipped: 'auth-wall',
        skipReason: `Redirected to auth wall: ${digest.finalUrl}`,
      }
    }

    const text = digest.textDigest.trim()
    if (text) {
      try {
        textExtract = await insertProductExtract({
          supabase,
          productId,
          kind: 'text',
          sourceUrl: digest.finalUrl,
          text,
          quality: 'usable',
          jobId,
        })
      } catch (insertError) {
        textInsertError = insertError instanceof Error ? insertError.message : String(insertError)
        console.warn(`[capture-section] Text extract insert failed for ${url}:`, textInsertError)
      }
    }
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      return { url, skipped: 'ssrf', skipReason: error.message }
    }
    const message = error instanceof Error ? error.message : String(error)
    if (/status (4\d\d|5\d\d)/i.test(message)) {
      return { url, skipped: 'http-error', skipReason: message }
    }
    return { url, skipped: 'page-error', skipReason: message }
  }

  let screenshotExtract: ProductExtract | undefined
  const screenshotExtracts: ProductExtract[] = []
  try {
    const shot = await capturePageStills({
      url: finalUrl,
      lookup: input.lookup,
      launchBrowser: input.launchBrowser,
    })

    if (isAuthWall(url, shot.finalUrl)) {
      return {
        url,
        textExtract,
        textInsertError,
        skipped: 'auth-wall',
        skipReason: `Screenshot redirected to auth wall: ${shot.finalUrl}`,
      }
    }

    if (shot.stills.length === 0) {
      throw new Error('No section stills captured')
    }

    for (const still of shot.stills) {
      const extractId = randomUUID()
      const { blobKey } = await putExtractBlob({
        blobEnv,
        productId,
        extractId,
        kind: 'screenshot',
        data: still.png,
        contentType: 'image/png',
        filename: `${still.label}.png`,
      })

      const scored = await (input.scoreScreenshot ?? scoreScreenshotBytes)(still.png)
      const qualityNote = [still.note, scored.note].filter(Boolean).join(' — ') || undefined
      const row = await insertProductExtract({
        supabase,
        productId,
        id: extractId,
        kind: 'screenshot',
        sourceUrl: still.sourceUrl ?? shot.finalUrl,
        blobKey,
        quality: scored.quality,
        qualityNote,
        jobId,
      })
      screenshotExtracts.push(row)
      screenshotExtract ??= row
    }
  } catch (error) {
    const screenshotError = error instanceof Error ? error.message : String(error)
    console.warn(`[capture-section] Screenshot failed for ${url}:`, screenshotError)
    return {
      url,
      screenshotExtract,
      screenshotExtracts,
      textExtract,
      screenshotError,
      textInsertError,
    }
  }

  return { url, screenshotExtract, screenshotExtracts, textExtract, textInsertError }
}
