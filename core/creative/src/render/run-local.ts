import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SupabaseClient } from '@supabase/supabase-js'
import { bundle } from '@remotion/bundler'
import { makeCancelSignal, renderMedia, renderStill, selectComposition } from '@remotion/renderer'
import { createSignedBlobUrl, deleteBlob, putBlob, type BlobEnv } from '../persistence/blob'
import { toTalkingHeadProps } from '../compositions/to-talking-head-props'
import { toSlideshowProps } from '../compositions/to-slideshow-props'
import { toCampaignPackStillProps } from '../compositions/to-campaign-pack-props'
import { bundleAuthoredForRender } from '../authored/bundle-for-render'
import { toAuthoredInputProps } from '../authored/input-props'
import { authoredRequestAllowed, allowedOriginsFromInputProps } from '../authored/network-allowlist'
import {
  isAuthoredComposition,
  isCampaignPackComposition,
  isSlideshowComposition,
  loadProject,
} from '../project'
import { planWantsTrialWatermark } from '../billing/trial-watermark'
import { loadHostedSpendContext } from '../billing/load-hosted-spend-context'
import type { RenderTargets } from './enqueue'
import { CANCELLED_RENDER_MESSAGE, clearRenderCancel, registerRenderCancel } from './active-renders'
import { getRenderJob, markRenderJob, plainEnglishRenderError } from './status'

const compositionsDir = path.dirname(fileURLToPath(import.meta.url))
const entryPoint = path.resolve(compositionsDir, '../compositions/entry.ts')

export type LocalRenderResult = {
  jobId: string
  outputAssetIds: string[]
  mp4BlobKey?: string
  stillBlobKey?: string
  durationMs: number
}

const slideMidFrames = (slides: Array<{ durationInFrames: number }>): number[] => {
  let from = 0
  return slides.map((slide) => {
    const mid = from + Math.max(0, Math.floor(slide.durationInFrames / 2))
    from += slide.durationInFrames
    return mid
  })
}

export const runLocalRenderJob = async (input: {
  supabase: SupabaseClient
  blobEnv: BlobEnv
  jobId: string
}): Promise<LocalRenderResult> => {
  const job = await getRenderJob(input.supabase, input.jobId)
  if (job.status === 'failed' && job.error_message === CANCELLED_RENDER_MESSAGE) {
    throw new Error(CANCELLED_RENDER_MESSAGE)
  }

  const targets: RenderTargets = job.targets ?? 'both'
  const wantMp4 = targets === 'mp4' || targets === 'both'
  const wantStills = targets === 'stills' || targets === 'both'

  const attempts = (job.attempt_count ?? 0) + 1
  await markRenderJob(input.supabase, job.id, {
    status: 'rendering',
    attemptCount: attempts,
    errorMessage: null,
  })

  const started = Date.now()
  const workDir = await mkdtemp(path.join(tmpdir(), 'mos-render-'))
  const { cancelSignal, cancel } = makeCancelSignal()
  registerRenderCancel(job.id, cancel)

  try {
    const { project } = await loadProject(input.supabase, job.project_id)
    const spendCtx = await loadHostedSpendContext(input.supabase, {
      productId: project.productId,
    })
    const trialWatermark = planWantsTrialWatermark(spendCtx.planId)
    const resolveUrl = (blobKey: string) =>
      createSignedBlobUrl({
        blobEnv: input.blobEnv,
        blobKey,
        expiresInSeconds: 60 * 60 * 2,
      })
    const authored = isAuthoredComposition(project.compositionId)
    const slideshow = isSlideshowComposition(project.compositionId)
    const campaignPack = isCampaignPackComposition(project.compositionId)
    const slideshowMapped = slideshow
      ? toSlideshowProps(project, resolveUrl, { trialWatermark })
      : null
    const campaignMapped = campaignPack
      ? toCampaignPackStillProps(project, resolveUrl, undefined, { trialWatermark })
      : null
    const authoredMapped = authored
      ? toAuthoredInputProps(project, resolveUrl, { trialWatermark })
      : null
    const inputProps = authored
      ? authoredMapped!
      : slideshow
        ? (() => {
            const { durationInFrames: _duration, ...props } = slideshowMapped!
            return props
          })()
        : campaignPack
          ? (() => {
              const { durationInFrames: _duration, ...props } = campaignMapped!
              return props
            })()
          : toTalkingHeadProps(project, resolveUrl, { trialWatermark })

    const serveUrl = authored
      ? (
          await bundleAuthoredForRender({
            source: project.compositionSource?.source ?? '',
            workDir: path.join(workDir, 'authored-bundle'),
            inputProps: {
              ...authoredMapped!,
              durationInFrames: project.durationFrames,
              fps: project.fps,
              width: project.width,
              height: project.height,
            },
          })
        ).serveUrl
      : await bundle({
          entryPoint,
          webpackOverride: (config) => config,
        })

    const composition = await selectComposition({
      serveUrl,
      id: project.compositionId,
      inputProps,
    })

    const durationInFrames = slideshow
      ? Math.max(project.durationFrames, slideshowMapped!.durationInFrames)
      : campaignPack
        ? 1
        : project.durationFrames
    const renderComposition = { ...composition, durationInFrames }
    const allowedOrigins = authored ? allowedOriginsFromInputProps(inputProps) : []
    const onDownload = authored
      ? (src: string) => {
          if (!authoredRequestAllowed(src, allowedOrigins)) {
            throw new Error(`Blocked outbound request to ${src}`)
          }
        }
      : undefined

    await mkdir(workDir, { recursive: true })
    let mp4BlobKey: string | undefined
    let stillBlobKey: string | undefined

    const stillAssetIds: string[] = []
    const videoAssetIds: string[] = []

    if (wantStills) {
      const frames =
        slideshow && slideshowMapped && slideshowMapped.slides.length > 0
          ? slideMidFrames(slideshowMapped.slides)
          : [0]
      for (let i = 0; i < frames.length; i++) {
        const frame = Math.min(frames[i]!, Math.max(0, durationInFrames - 1))
        const fileName =
          frames.length === 1 ? 'still.png' : `slide-${String(i + 1).padStart(2, '0')}.png`
        const stillPath = path.join(workDir, fileName)
        await renderStill({
          composition: renderComposition,
          serveUrl,
          output: stillPath,
          inputProps,
          frame,
          cancelSignal,
          onDownload,
        })
        const stillBytes = await readFile(stillPath)
        const stillPut = await putBlob({
          blobEnv: input.blobEnv,
          productId: project.productId,
          kind: 'renders',
          parts: [project.id, job.id, fileName],
          data: stillBytes,
          contentType: 'image/png',
        })
        if (!stillBlobKey) stillBlobKey = stillPut.blobKey
        const stillAssetId = crypto.randomUUID() as string
        const { error: stillInsertError } = await input.supabase.from('assets').insert({
          id: stillAssetId,
          product_id: project.productId,
          project_id: project.id,
          kind: 'image',
          source: 'generator',
          blob_key: stillPut.blobKey,
          content_type: 'image/png',
          probe: {
            role: frames.length === 1 ? 'render_still' : 'render_slide_still',
            slideIndex: i,
            frame,
          },
        })
        if (stillInsertError) {
          await deleteBlob({ blobEnv: input.blobEnv, blobKey: stillPut.blobKey }).catch(
            () => undefined,
          )
          throw new Error(`Failed to persist still ${fileName}: ${stillInsertError.message}`)
        }
        stillAssetIds.push(stillAssetId)
      }
    }

    if (wantMp4) {
      const mp4Path = path.join(workDir, 'final.mp4')
      await renderMedia({
        composition: renderComposition,
        serveUrl,
        codec: 'h264',
        outputLocation: mp4Path,
        inputProps,
        cancelSignal,
        onDownload,
      })
      const mp4Bytes = await readFile(mp4Path)
      const put = await putBlob({
        blobEnv: input.blobEnv,
        productId: project.productId,
        kind: 'renders',
        parts: [project.id, job.id, 'final.mp4'],
        data: mp4Bytes,
        contentType: 'video/mp4',
      })
      mp4BlobKey = put.blobKey
      const mp4AssetId = crypto.randomUUID() as string
      const { error: mp4InsertError } = await input.supabase.from('assets').insert({
        id: mp4AssetId,
        product_id: project.productId,
        project_id: project.id,
        kind: 'video',
        source: 'generator',
        blob_key: mp4BlobKey,
        content_type: 'video/mp4',
        probe: { role: 'render_output' },
      })
      if (mp4InsertError) {
        await deleteBlob({ blobEnv: input.blobEnv, blobKey: mp4BlobKey })
        throw new Error(`Failed to persist render asset: ${mp4InsertError.message}`)
      }
      videoAssetIds.push(mp4AssetId)
    }

    // Slideshow / campaign packs: stills first so output[0] is primary still.
    // Talking-head: keep MP4 primary when both are requested.
    const outputAssetIds =
      slideshow || campaignPack
        ? [...stillAssetIds, ...videoAssetIds]
        : [...videoAssetIds, ...stillAssetIds]

    const latest = await getRenderJob(input.supabase, job.id)
    if (latest.error_message === CANCELLED_RENDER_MESSAGE || latest.status === 'failed') {
      throw new Error(CANCELLED_RENDER_MESSAGE)
    }

    if (outputAssetIds.length === 0) {
      throw new Error('Render produced no output assets')
    }

    const durationMs = Date.now() - started
    await markRenderJob(input.supabase, job.id, {
      status: 'completed',
      outputAssetIds,
      durationMs,
      attemptCount: attempts,
      errorMessage: null,
    })

    await input.supabase
      .from('studio_projects')
      .update({ status: 'needs_review', updated_at: new Date().toISOString() })
      .eq('id', project.id)

    return {
      jobId: job.id,
      outputAssetIds,
      mp4BlobKey,
      stillBlobKey,
      durationMs,
    }
  } catch (error) {
    const message = plainEnglishRenderError(error)
    const current = await getRenderJob(input.supabase, job.id).catch(() => null)
    if (current?.error_message !== CANCELLED_RENDER_MESSAGE) {
      await markRenderJob(input.supabase, job.id, {
        status: 'failed',
        errorMessage: message,
        attemptCount: attempts,
      })
      await input.supabase
        .from('studio_projects')
        .update({ status: 'drafting', updated_at: new Date().toISOString() })
        .eq('id', job.project_id)
    }
    throw new Error(message)
  } finally {
    clearRenderCancel(job.id)
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined)
  }
}
