/** ADR-0032 / #525 — start index after attach without failing the attach. */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { BlobEnv } from '../persistence/blob'
import { enqueueAssetIndexJob } from './enqueue-index'
import { runAssetIndexJob } from './run-index'

export const startAssetIndexAfterAttach = async (input: {
  supabase: SupabaseClient
  blobEnv: BlobEnv
  productId: string
  projectId: string
  assetId: string
  modelProfileId?: string
  /** Log label: upload vs generated. */
  source: 'upload' | 'generated'
}): Promise<void> => {
  try {
    const { job } = await enqueueAssetIndexJob({
      supabase: input.supabase,
      productId: input.productId,
      projectId: input.projectId,
      assetId: input.assetId,
      modelProfileId: input.modelProfileId,
      allowUnconfirmedPaid: true,
    })
    const skipPaidStages = Boolean(
      (job.input_snapshot as { skipPaidStages?: boolean } | null)?.skipPaidStages,
    )
    void runAssetIndexJob({
      supabase: input.supabase,
      blobEnv: input.blobEnv,
      jobId: job.id,
      assetId: input.assetId,
      modelProfileId: input.modelProfileId,
      skipPaidStages,
    }).catch((indexError) => {
      console.error(`Asset index failed after ${input.source}`, {
        assetId: input.assetId,
        indexError,
      })
    })
  } catch (indexError) {
    console.error(`Asset index enqueue failed after ${input.source}; asset kept`, {
      assetId: input.assetId,
      indexError,
    })
  }
}
