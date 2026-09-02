import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { startAssetIndexAfterAttach } from '../asset-intelligence/start-index-after-attach'
import { putBlob, type BlobEnv } from '../persistence/blob'
import type { AssetRef } from '../generators/types'
import { assertGeneratedAssetQc } from '../generators/qc'
import { debitForJob } from '../billing/debit-for-job'
import { refundJobWallet } from '../billing/refund-job-wallet'
import { finalizeCostEvent } from '../pricing/ledger'
import { enqueueGenerationJob, markGenerationJob, type GenerationRole } from './enqueue'

export const persistGeneratedAsset = async (input: {
  supabase: SupabaseClient
  blobEnv: BlobEnv
  productId: string
  projectId: string
  asset: AssetRef
  role: GenerationRole
  modelProfileId?: string
}): Promise<{ assetId: string; blobKey: string }> => {
  assertGeneratedAssetQc(input.asset)
  const assetId = randomUUID()
  const ext =
    input.asset.contentType === 'image/svg+xml'
      ? 'svg'
      : input.asset.contentType === 'image/png'
        ? 'png'
        : input.asset.contentType === 'image/jpeg' || input.asset.contentType === 'image/jpg'
          ? 'jpg'
          : input.asset.contentType === 'image/webp'
            ? 'webp'
            : input.asset.contentType === 'video/mp4'
              ? 'mp4'
              : input.asset.contentType === 'audio/mpeg'
                ? 'mp3'
                : 'bin'
  const { blobKey } = await putBlob({
    blobEnv: input.blobEnv,
    productId: input.productId,
    kind: 'generated',
    parts: [input.projectId, input.role, `${assetId}.${ext}`],
    data: Buffer.from(input.asset.bytes),
    contentType: input.asset.contentType,
  })
  const { error } = await input.supabase.from('assets').insert({
    id: assetId,
    product_id: input.productId,
    project_id: input.projectId,
    kind: input.asset.kind,
    source: 'generator',
    blob_key: blobKey,
    content_type: input.asset.contentType,
    probe: input.asset.probe,
  })
  if (error) {
    throw new Error(`Failed to register generated asset: ${error.message}`)
  }
  if (input.asset.kind === 'video') {
    try {
      await startAssetIndexAfterAttach({
        supabase: input.supabase,
        blobEnv: input.blobEnv,
        productId: input.productId,
        projectId: input.projectId,
        assetId,
        modelProfileId: input.modelProfileId,
        source: 'generated',
      })
    } catch (indexError) {
      console.error('Asset index start failed after generate; asset kept', {
        assetId,
        indexError,
      })
    }
  }
  return { assetId, blobKey }
}

export const runSyncedGeneration = async (input: {
  supabase: SupabaseClient
  blobEnv: BlobEnv
  productId: string
  projectId: string
  role: GenerationRole
  modelId: string
  modelProfileId: string
  estimatedGbp: number
  units: number
  inputSnapshot: Record<string, unknown>
  confirmSpend?: boolean
  produce: () => Promise<
    AssetRef | { transcriptOnly: true; text: string; segments: unknown } | { metadataOnly: true }
  >
}): Promise<{
  jobId: string
  assetId?: string
  blobKey?: string
  contentType?: string
  probe?: Record<string, unknown>
  actualGbp: number
  transcript?: { text: string; segments: unknown }
  brandRefsUnsupported?: boolean
}> => {
  const job = await enqueueGenerationJob(input.supabase, {
    productId: input.productId,
    projectId: input.projectId,
    role: input.role,
    modelId: input.modelId,
    modelProfileId: input.modelProfileId,
    estimatedGbp: input.estimatedGbp,
    units: input.units,
    inputSnapshot: input.inputSnapshot,
  })

  const debit = await debitForJob(input.supabase, {
    productId: input.productId,
    projectId: input.projectId,
    jobId: job.id,
    role: input.role,
    modelId: input.modelId,
    units: input.units,
    estimatedGbp: input.estimatedGbp,
    confirmSpend: input.confirmSpend,
  })
  if (!debit.ok) {
    await markGenerationJob(input.supabase, job.id, {
      status: 'failed',
      error_message: debit.error,
    })
    throw new Error(debit.error)
  }

  try {
    await markGenerationJob(input.supabase, job.id, {
      status: 'generating',
      attempt_count: 1,
    })
    const produced = await input.produce()
    const actualGbp = input.estimatedGbp

    if ('transcriptOnly' in produced || 'metadataOnly' in produced) {
      await markGenerationJob(input.supabase, job.id, {
        status: 'ready',
        actual_gbp: actualGbp,
      })
      await finalizeCostEvent(input.supabase, {
        productId: input.productId,
        projectId: input.projectId,
        jobId: job.id,
        role: input.role,
        modelId: input.modelId,
        units: input.units,
        estimatedGbp: input.estimatedGbp,
        actualGbp,
      })
      if ('transcriptOnly' in produced) {
        return {
          jobId: job.id,
          actualGbp,
          transcript: { text: produced.text, segments: produced.segments },
        }
      }
      return { jobId: job.id, actualGbp }
    }

    const saved = await persistGeneratedAsset({
      supabase: input.supabase,
      blobEnv: input.blobEnv,
      productId: input.productId,
      projectId: input.projectId,
      asset: produced,
      role: input.role,
      modelProfileId: input.modelProfileId,
    })
    await markGenerationJob(input.supabase, job.id, {
      status: 'ready',
      output_asset_id: saved.assetId,
      actual_gbp: actualGbp,
      brand_refs_unsupported: Boolean(produced.brandRefsUnsupported),
    })
    await finalizeCostEvent(input.supabase, {
      productId: input.productId,
      projectId: input.projectId,
      jobId: job.id,
      role: input.role,
      modelId: input.modelId,
      units: input.units,
      estimatedGbp: input.estimatedGbp,
      actualGbp,
    })
    return {
      jobId: job.id,
      assetId: saved.assetId,
      blobKey: saved.blobKey,
      contentType: produced.contentType,
      probe: produced.probe,
      actualGbp,
      brandRefsUnsupported: produced.brandRefsUnsupported,
    }
  } catch (error) {
    const failed = await markGenerationJob(input.supabase, job.id, {
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Generation failed',
    })
    await refundJobWallet(input.supabase, {
      productId: input.productId,
      jobId: job.id,
      status: failed.status,
      actualGbp: failed.actual_gbp,
    })
    throw error
  }
}

export {
  enqueueGenerationJob,
  getGenerationJob,
  listGenerationJobsForProduct,
  listGenerationJobsForProject,
  markGenerationJob,
} from './enqueue'
export type { GenerationJobRow, GenerationRole } from './enqueue'
