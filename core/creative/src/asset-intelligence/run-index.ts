/** Wave 2C / #164–#166 — probe → shots → caption → transcribe → embed. */

import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_MODEL_PROFILE_ID, resolveModelRef } from '../model-profiles'
import { getBlobBytes, type BlobEnv } from '../persistence/blob'
import { markGenerationJob } from '../generation-jobs/enqueue'
import { recordCostEvent } from '../pricing/ledger'
import { captionAssetWithVlm } from './caption'
import { embedAssetForIndex, ASSET_TEXT_EMBEDDING_MODEL_ID } from './embed'
import { embedShotVisualForIndex } from './embed-shot-visual'
import { enqueueAssetIndexJob } from './enqueue-index'
import { estimateAssetIndexGbp } from './estimate-index'
import { isAssetFaceDetectEnabled, runFaceDetectPass } from './face-detect'
import {
  replaceAssetEmbedding,
  replaceAssetShots,
  replaceAssetTags,
  upsertAssetIndexState,
} from './persist'
import { probeAssetBytes } from './probe'
import type { AssetIndexState } from './schema'
import { proposeHeuristicShots } from './shots'
import { PAID_INDEX_SOFT_SKIP_MESSAGE } from './soft-skip'
import { VISUAL_EMBED_CAP_SKIP_MESSAGE } from './visual-embed-status'
import { writeShotThumbs } from './write-shot-thumbs'
import {
  transcribeAssetForIndex,
  transcriptWindowForShot,
  type TranscriptSegment,
} from './transcript'

type AssetRow = {
  id: string
  product_id: string
  project_id: string | null
  kind: 'video' | 'image' | 'audio' | 'other'
  blob_key: string
  content_type: string | null
  probe: Record<string, unknown> | null
}

const loadAssetRow = async (supabase: SupabaseClient, assetId: string): Promise<AssetRow> => {
  const { data, error } = await supabase.from('assets').select('*').eq('id', assetId).single()
  if (error || !data) {
    throw new Error(`Asset not found: ${error?.message ?? assetId}`)
  }
  return data as AssetRow
}

export const runAssetIndexJob = async (input: {
  supabase: SupabaseClient
  blobEnv: BlobEnv
  jobId: string
  assetId: string
  /** Model profile for caption + transcribe roles. Defaults to founder-edit. */
  modelProfileId?: string
  /** When true, skip caption/transcribe/embed (probe+shots only) — soft-cap path. */
  skipPaidStages?: boolean
}): Promise<{
  state: AssetIndexState
  shotCount: number
  tagCount: number
  hasTranscript: boolean
  hasTextEmbedding: boolean
  hasVisualEmbedding: boolean
}> => {
  const asset = await loadAssetRow(input.supabase, input.assetId)
  const modelProfileId = input.modelProfileId?.trim() || DEFAULT_MODEL_PROFILE_ID
  const skipPaid = input.skipPaidStages === true
  let estimate = estimateAssetIndexGbp(modelProfileId)

  await markGenerationJob(input.supabase, input.jobId, { status: 'generating' })
  await upsertAssetIndexState(input.supabase, {
    assetId: asset.id,
    productId: asset.product_id,
    status: 'indexing',
    stage: 'probe',
    lastError: null,
  })

  try {
    const bytes = await getBlobBytes({ blobEnv: input.blobEnv, blobKey: asset.blob_key })
    const fileName =
      typeof asset.probe?.name === 'string'
        ? asset.probe.name
        : (asset.blob_key.split('/').pop() ?? '')

    const probed = await probeAssetBytes({
      bytes,
      contentType: asset.content_type ?? 'application/octet-stream',
      fileName,
      kind: asset.kind,
    })

    const nextProbe = {
      ...(asset.probe ?? {}),
      ...Object.fromEntries(
        Object.entries({
          durationSeconds: probed.durationSeconds,
          width: probed.width,
          height: probed.height,
          fps: probed.fps,
          videoCodec: probed.videoCodec,
          audioCodec: probed.audioCodec,
          container: probed.container,
          indexedProbe: true,
        }).filter(([, value]) => value != null),
      ),
    }

    const { error: probeUpdateError } = await input.supabase
      .from('assets')
      .update({ probe: nextProbe })
      .eq('id', asset.id)
    if (probeUpdateError) {
      throw new Error(`Failed to update asset probe: ${probeUpdateError.message}`)
    }

    await upsertAssetIndexState(input.supabase, {
      assetId: asset.id,
      productId: asset.product_id,
      status: 'indexing',
      stage: 'shots',
    })

    const shots = proposeHeuristicShots({
      kind: asset.kind,
      durationSeconds:
        probed.durationSeconds ??
        (typeof asset.probe?.durationSeconds === 'number' ? asset.probe.durationSeconds : null),
    })
    const { thumbBlobKeyByOrdinal, thumbNote } = await writeShotThumbs({
      blobEnv: input.blobEnv,
      productId: asset.product_id,
      assetId: asset.id,
      kind: asset.kind,
      bytes,
      contentType: asset.content_type ?? 'application/octet-stream',
      fileName,
      shots,
    })
    const persistedShots = await replaceAssetShots(input.supabase, {
      assetId: asset.id,
      productId: asset.product_id,
      shots,
      thumbBlobKeyByOrdinal,
    })
    const shotCount = persistedShots.length
    estimate = estimateAssetIndexGbp(modelProfileId, { shotCount: Math.max(1, shotCount) })

    // ADR-0032 / #176: face detect off by default; no celebrity labeling.
    const facePass = runFaceDetectPass({
      enabled: isAssetFaceDetectEnabled(),
      kind: asset.kind,
    })

    let caption: string | null = null
    let tagCount = 0
    let captionNote: string | null = skipPaid ? PAID_INDEX_SOFT_SKIP_MESSAGE : null
    let transcriptExcerpt: string | null = null
    let transcriptSegments: TranscriptSegment[] = []
    let transcriptNote: string | null = null

    if (!skipPaid) {
      await upsertAssetIndexState(input.supabase, {
        assetId: asset.id,
        productId: asset.product_id,
        status: 'indexing',
        stage: 'caption',
      })

      try {
        const { modelId } = resolveModelRef(modelProfileId, 'caption')
        const captionResult = await captionAssetWithVlm({
          modelId,
          kind: asset.kind,
          mediaType: asset.content_type ?? 'application/octet-stream',
          fileName,
          bytes,
        })
        if (captionResult.skipped) {
          captionNote = captionResult.reason.slice(0, 500)
        } else {
          caption = captionResult.caption
          tagCount = await replaceAssetTags(input.supabase, {
            assetId: asset.id,
            productId: asset.product_id,
            tags: captionResult.tags,
            source: 'caption',
          })
          if (estimate.captionGbp > 0) {
            await recordCostEvent(input.supabase, {
              productId: asset.product_id,
              projectId: asset.project_id ?? undefined,
              jobId: input.jobId,
              role: 'caption',
              modelId,
              units: 1,
              estimatedGbp: estimate.captionGbp,
              actualGbp: estimate.captionGbp,
            })
          }
        }
      } catch (captionError) {
        // Soft-fail caption: keep probe/shots usable for Story Builder (ADR-0032 skippable stage).
        const message = captionError instanceof Error ? captionError.message : 'Caption VLM failed'
        captionNote = `caption failed: ${message}`.slice(0, 500)
      }

      await upsertAssetIndexState(input.supabase, {
        assetId: asset.id,
        productId: asset.product_id,
        status: 'indexing',
        stage: 'transcribe',
        caption,
        lastError: captionNote,
      })

      try {
        const { modelId } = resolveModelRef(modelProfileId, 'transcribe')
        const transcriptResult = await transcribeAssetForIndex({
          assetId: asset.id,
          modelId,
          kind: asset.kind,
          mediaType: asset.content_type ?? 'application/octet-stream',
          fileName,
          bytes,
        })
        if (transcriptResult.skipped) {
          transcriptNote = transcriptResult.reason.slice(0, 500)
        } else {
          transcriptExcerpt = transcriptResult.transcriptExcerpt
          transcriptSegments = transcriptResult.segments
          if (estimate.transcribeGbp > 0) {
            await recordCostEvent(input.supabase, {
              productId: asset.product_id,
              projectId: asset.project_id ?? undefined,
              jobId: input.jobId,
              role: 'transcribe',
              modelId,
              units: 30,
              estimatedGbp: estimate.transcribeGbp,
              actualGbp: estimate.transcribeGbp,
            })
          }
        }
      } catch (transcriptError) {
        const message =
          transcriptError instanceof Error ? transcriptError.message : 'Transcribe failed'
        transcriptNote = `transcribe failed: ${message}`.slice(0, 500)
      }
    }

    await upsertAssetIndexState(input.supabase, {
      assetId: asset.id,
      productId: asset.product_id,
      status: 'indexing',
      stage: 'embed',
      caption,
      transcriptExcerpt,
      transcriptSegments,
      lastError:
        [thumbNote, captionNote, transcriptNote].filter(Boolean).join('; ').slice(0, 500) || null,
    })

    let hasTextEmbedding = false
    let embedNote: string | null = null
    try {
      const useMock = modelProfileId === 'ci-stub'
      const embedResult = await embedAssetForIndex({
        caption,
        transcriptExcerpt,
        useMock,
        modelId: ASSET_TEXT_EMBEDDING_MODEL_ID,
      })
      if (embedResult.skipped) {
        embedNote = embedResult.reason.slice(0, 500)
      } else {
        await replaceAssetEmbedding(input.supabase, {
          assetId: asset.id,
          productId: asset.product_id,
          kind: 'text',
          modelId: embedResult.text.modelId,
          pgVector: embedResult.text.pgVector,
        })
        hasTextEmbedding = true
        try {
          for (const shot of persistedShots) {
            const window =
              transcriptWindowForShot(
                { startMs: shot.startMs, endMs: shot.endMs },
                transcriptSegments,
              ) ?? transcriptExcerpt
            const shotEmbed = await embedAssetForIndex({
              caption,
              transcriptExcerpt: window,
              useMock,
              modelId: ASSET_TEXT_EMBEDDING_MODEL_ID,
            })
            if (shotEmbed.skipped) continue
            await replaceAssetEmbedding(input.supabase, {
              assetId: asset.id,
              productId: asset.product_id,
              kind: 'text',
              modelId: shotEmbed.text.modelId,
              pgVector: shotEmbed.text.pgVector,
              shotId: shot.id,
            })
          }
        } catch (shotEmbedError) {
          const message =
            shotEmbedError instanceof Error ? shotEmbedError.message : 'Shot embed failed'
          embedNote = `shot embed skipped: ${message}`.slice(0, 500)
        }
        if (estimate.embedGbp > 0) {
          await recordCostEvent(input.supabase, {
            productId: asset.product_id,
            projectId: asset.project_id ?? undefined,
            jobId: input.jobId,
            role: 'embed',
            modelId: embedResult.text.modelId,
            units: 1,
            estimatedGbp: estimate.embedGbp,
            actualGbp: estimate.embedGbp,
          })
        }
        // #580 thumbs exist; #581/#582 write visual rows next (soft-fail).
      }
    } catch (embedError) {
      const message = embedError instanceof Error ? embedError.message : 'Embed failed'
      embedNote = `embed failed: ${message}`.slice(0, 500)
    }

    let hasVisualEmbedding = false
    let visualNote: string | null = null
    if (skipPaid) {
      visualNote = VISUAL_EMBED_CAP_SKIP_MESSAGE
    } else {
      try {
        const visualRef = resolveModelRef(modelProfileId, 'embed_visual')
        const useVisualMock = modelProfileId === 'ci-stub' || visualRef.modelId.startsWith('mock-')
        let wroteVisual = 0
        let neededVisual = 0
        for (const shot of persistedShots) {
          if (!shot.thumbBlobKey) {
            neededVisual += 1
            continue
          }
          neededVisual += 1
          const thumbBytes = await getBlobBytes({
            blobEnv: input.blobEnv,
            blobKey: shot.thumbBlobKey,
          })
          const visual = await embedShotVisualForIndex({
            thumbBytes,
            seed: shot.id,
            useMock: useVisualMock,
            modelId: visualRef.modelId,
          })
          if (visual.skipped) {
            visualNote = visual.reason.slice(0, 500)
            continue
          }
          await replaceAssetEmbedding(input.supabase, {
            assetId: asset.id,
            productId: asset.product_id,
            kind: 'visual',
            modelId: visual.modelId,
            pgVector: visual.pgVector,
            shotId: shot.id,
          })
          wroteVisual += 1
          hasVisualEmbedding = true
        }
        if (wroteVisual > 0 && estimate.visualGbp > 0) {
          const visualEstimate = estimateAssetIndexGbp(modelProfileId, {
            shotCount: wroteVisual,
          })
          await recordCostEvent(input.supabase, {
            productId: asset.product_id,
            projectId: asset.project_id ?? undefined,
            jobId: input.jobId,
            role: 'embed_visual',
            modelId: visualRef.modelId,
            units: wroteVisual,
            estimatedGbp: visualEstimate.visualGbp,
            actualGbp: visualEstimate.visualGbp,
          })
        }
        if (wroteVisual === 0 && neededVisual > 0 && !visualNote) {
          visualNote = 'visual embed skipped: no keyframe thumb'
        }
      } catch (visualError) {
        const message = visualError instanceof Error ? visualError.message : 'Visual embed failed'
        visualNote = `visual embed failed: ${message}`.slice(0, 500)
      }
    }

    const softNotes =
      [thumbNote, captionNote, transcriptNote, embedNote, visualNote]
        .filter(Boolean)
        .join('; ')
        .slice(0, 500) || null

    const state = await upsertAssetIndexState(input.supabase, {
      assetId: asset.id,
      productId: asset.product_id,
      status: 'ready',
      stage: 'ready',
      caption,
      transcriptExcerpt,
      transcriptSegments,
      lastError: softNotes,
      faceDetectRan: facePass.ran,
      indexedAt: new Date().toISOString(),
    })

    await markGenerationJob(input.supabase, input.jobId, {
      status: 'ready',
      output_asset_id: asset.id,
      actual_gbp: 0,
      // Soft-skip notes live on asset_index_state.last_error only — keep job row clean.
      error_message: null,
    })

    return {
      state,
      shotCount,
      tagCount,
      hasTranscript: Boolean(transcriptExcerpt),
      hasTextEmbedding,
      hasVisualEmbedding,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Asset index failed'
    await upsertAssetIndexState(input.supabase, {
      assetId: asset.id,
      productId: asset.product_id,
      status: 'failed',
      stage: 'failed',
      lastError: message.slice(0, 500),
    })
    await markGenerationJob(input.supabase, input.jobId, {
      status: 'failed',
      error_message: message.slice(0, 500),
    })
    throw error
  }
}

/**
 * Local-first upload path: enqueue the index job row, then run
 * probe→shots→caption→transcribe→embed in-process (no worker required).
 * HTTP reindex (#170) should call enqueueAssetIndexJob alone once a worker
 * drains role=index.
 */
export const enqueueAndRunAssetIndexInline = async (input: {
  supabase: SupabaseClient
  blobEnv: BlobEnv
  productId: string
  projectId: string | null
  assetId: string
  modelProfileId?: string
  confirmSpend?: boolean
  /** Upload path: allow probe/shots when soft caps block paid stages. */
  allowUnconfirmedPaid?: boolean
}): Promise<{
  jobId: string
  state: AssetIndexState
  shotCount: number
  tagCount: number
  hasTranscript: boolean
  hasTextEmbedding: boolean
  hasVisualEmbedding: boolean
}> => {
  const { job } = await enqueueAssetIndexJob({
    supabase: input.supabase,
    productId: input.productId,
    projectId: input.projectId,
    assetId: input.assetId,
    modelProfileId: input.modelProfileId,
    confirmSpend: input.confirmSpend,
    allowUnconfirmedPaid: input.allowUnconfirmedPaid,
  })
  const skipPaidStages = Boolean(
    (job.input_snapshot as { skipPaidStages?: boolean } | null)?.skipPaidStages,
  )
  const result = await runAssetIndexJob({
    supabase: input.supabase,
    blobEnv: input.blobEnv,
    jobId: job.id,
    assetId: input.assetId,
    modelProfileId: input.modelProfileId,
    skipPaidStages,
  })
  return { jobId: job.id, ...result }
}
