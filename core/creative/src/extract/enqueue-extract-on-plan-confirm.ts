import type { SupabaseClient } from '@supabase/supabase-js'
import {
  extractUrlsForPlanConfirm,
  shouldEnqueueExtractOnPlanConfirm,
} from '../generation-plan/extract-on-confirm'
import {
  enqueueProductExtractJob,
  type EnqueueProductExtractJobInput,
} from './enqueue-product-extract-job'
import { listProductExtracts } from './list-product-extracts'

export type EnqueueExtractOnPlanConfirmInput = {
  supabase: SupabaseClient
  productId: string
  projectId: string
  reExtractThisTurn?: boolean
  extraExtractUrls?: string[]
  modelProfileId: string
  lookup?: EnqueueProductExtractJobInput['lookup']
}

/** Enqueue a product extract job when plan confirm asked to recrawl. */
export const enqueueExtractOnPlanConfirm = async (
  input: EnqueueExtractOnPlanConfirmInput,
): Promise<{ enqueued: boolean; urls: string[] }> => {
  if (
    !shouldEnqueueExtractOnPlanConfirm({
      reExtractThisTurn: input.reExtractThisTurn,
      extraExtractUrls: input.extraExtractUrls,
    })
  ) {
    return { enqueued: false, urls: [] }
  }

  let existingSourceUrls: string[] = []
  if (input.reExtractThisTurn) {
    const extracts = await listProductExtracts({
      supabase: input.supabase,
      productId: input.productId,
      limit: 50,
    })
    existingSourceUrls = extracts.map((entry) => entry.sourceUrl)
  }

  const urls = extractUrlsForPlanConfirm({
    extraExtractUrls: input.extraExtractUrls,
    reExtractThisTurn: input.reExtractThisTurn,
    existingSourceUrls,
  })
  if (urls.length === 0) {
    return { enqueued: false, urls: [] }
  }

  await enqueueProductExtractJob({
    supabase: input.supabase,
    productId: input.productId,
    projectId: input.projectId,
    urls,
    modelProfileId: input.modelProfileId,
    confirmSpend: true,
    lookup: input.lookup,
  })
  return { enqueued: true, urls }
}
