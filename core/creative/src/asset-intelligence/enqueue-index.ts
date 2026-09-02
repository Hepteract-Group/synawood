import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_MODEL_PROFILE_ID } from '../model-profiles'
import { resolveCreativeSpendGate } from '../billing/gate'
import { debitForJob } from '../billing/debit-for-job'
import {
  enqueueGenerationJob,
  markGenerationJob,
  type GenerationJobRow,
} from '../generation-jobs/enqueue'
import { upsertAssetIndexState } from './persist'
import type { AssetIndexState } from './schema'
import { estimateAssetIndexGbp } from './estimate-index'
import { MAX_HEURISTIC_SHOTS } from './shots'

export const enqueueAssetIndexJob = async (input: {
  supabase: SupabaseClient
  productId: string
  /** Prefer the project that uploaded the asset; null for product-library-only. */
  projectId: string | null
  assetId: string
  /** Profile whose `caption` role the index job will resolve (#169). */
  modelProfileId?: string
  /** Required when estimate > £0 and soft caps would fire (#175). */
  confirmSpend?: boolean
  /**
   * Upload auto-index may skip the soft-cap confirm (probe/shots still run;
   * paid stages soft-skip inside the runner when this is true and gate fails).
   */
  allowUnconfirmedPaid?: boolean
}): Promise<{ job: GenerationJobRow; state: AssetIndexState; estimatedGbp: number }> => {
  const modelProfileId = input.modelProfileId?.trim() || DEFAULT_MODEL_PROFILE_ID
  const estimate = estimateAssetIndexGbp(modelProfileId, { shotCount: MAX_HEURISTIC_SHOTS })

  let gateOk = true
  let gateError = ''
  try {
    const gate = await resolveCreativeSpendGate(input.supabase, {
      productId: input.productId,
      projectId: input.projectId,
      estimatedGbp: estimate.estimatedGbp,
      requireConfirm: true,
      confirmSpend: input.confirmSpend,
      suggestProfile: 'ci-stub',
    })
    if (!gate.ok) {
      gateOk = false
      gateError = gate.error
    }
  } catch (error) {
    if (!input.allowUnconfirmedPaid) throw error
    console.warn('Asset index metering read failed; treating spent as £0', {
      productId: input.productId,
      projectId: input.projectId,
      error,
    })
  }
  if (!gateOk && !input.allowUnconfirmedPaid) {
    throw new Error(gateError)
  }

  const state = await upsertAssetIndexState(input.supabase, {
    assetId: input.assetId,
    productId: input.productId,
    status: 'pending',
    stage: 'queued',
    lastError: null,
    indexedAt: null,
  })

  const job = await enqueueGenerationJob(input.supabase, {
    productId: input.productId,
    projectId: input.projectId,
    role: 'index',
    modelId: 'index-pipeline',
    modelProfileId,
    estimatedGbp: estimate.estimatedGbp,
    inputSnapshot: {
      assetId: input.assetId,
      productId: input.productId,
      projectId: input.projectId,
      modelProfileId,
      estimatedGbp: estimate.estimatedGbp,
      confirmSpend: input.confirmSpend === true,
      skipPaidStages: !gateOk && input.allowUnconfirmedPaid === true,
      estimate,
    },
  })

  if (estimate.estimatedGbp > 0 && input.confirmSpend === true) {
    const debit = await debitForJob(input.supabase, {
      productId: input.productId,
      projectId: input.projectId,
      jobId: job.id,
      role: 'index',
      modelId: 'index-pipeline',
      estimatedGbp: estimate.estimatedGbp,
      confirmSpend: true,
    })
    if (!debit.ok) {
      await markGenerationJob(input.supabase, job.id, {
        status: 'failed',
        error_message: debit.error,
      })
      throw new Error(debit.error)
    }
  }

  return { job, state, estimatedGbp: estimate.estimatedGbp }
}
