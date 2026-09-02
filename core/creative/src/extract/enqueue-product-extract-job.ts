import type { SupabaseClient } from '@supabase/supabase-js'
import { debitForJob } from '../billing/debit-for-job'
import { resolveCreativeSpendGate } from '../billing/gate'
import { loadHostedSpendContext } from '../billing/load-hosted-spend-context'
import {
  enqueueGenerationJob,
  markGenerationJob,
  type GenerationJobRow,
} from '../generation-jobs/enqueue'
import {
  EXTRACT_SCREENSHOT_GBP,
  extractCreditBlockReason,
} from '../generation-jobs/estimate-extract'
import { readCreativeBudgets } from '../pricing/limits'
import type { HostLookup } from './ssrf'
import { validateProductExtractUrls } from './validate-product-extract-urls'

export const PRODUCT_EXTRACT_JOB_KIND = 'product_pages' as const

export const estimateProductExtractEnqueueGbp = (urlCount: number): number =>
  Number((EXTRACT_SCREENSHOT_GBP * Math.max(1, urlCount)).toFixed(4))

export type EnqueueProductExtractJobInput = {
  supabase: SupabaseClient
  productId: string
  /** Studio project context when enqueue originates from a cut; null for product-only. */
  projectId?: string | null
  urls: string[]
  modelProfileId: string
  /** Pipeline id for worker routing; fixtures use mock-reasoner. */
  modelId?: string
  confirmSpend?: boolean
  lookup?: HostLookup
}

export const enqueueProductExtractJob = async (
  input: EnqueueProductExtractJobInput,
): Promise<{ job: GenerationJobRow; estimatedGbp: number; urls: string[] }> => {
  const validated = await validateProductExtractUrls(input.urls, { lookup: input.lookup })
  const urls = validated.map((entry) => entry.normalized.href)
  const modelId = input.modelId?.trim() || 'product-extract-pipeline'
  const estimatedGbp = estimateProductExtractEnqueueGbp(urls.length)

  const ctx = await loadHostedSpendContext(input.supabase, {
    productId: input.productId,
    projectId: input.projectId ?? null,
  })
  const budgets = readCreativeBudgets()
  const remainingMonthlyGbp = budgets.monthlyGeneratorCap - ctx.spentThisMonthGbp
  const creditBlock = extractCreditBlockReason({ estimatedGbp, remainingMonthlyGbp })
  if (creditBlock) {
    throw new Error(creditBlock)
  }

  const gate = await resolveCreativeSpendGate(input.supabase, {
    productId: input.productId,
    projectId: input.projectId ?? null,
    estimatedGbp,
    requireConfirm: estimatedGbp > 0,
    confirmSpend: input.confirmSpend ?? true,
  })
  if (!gate.ok) {
    throw new Error(gate.error)
  }

  const job = await enqueueGenerationJob(input.supabase, {
    productId: input.productId,
    projectId: input.projectId ?? null,
    role: 'extract',
    modelId,
    modelProfileId: input.modelProfileId,
    estimatedGbp,
    units: urls.length,
    inputSnapshot: {
      extractKind: PRODUCT_EXTRACT_JOB_KIND,
      urls,
      modelProfileId: input.modelProfileId,
      modelId,
    },
  })

  const debit = await debitForJob(input.supabase, {
    productId: input.productId,
    projectId: input.projectId ?? null,
    jobId: job.id,
    role: 'extract',
    modelId,
    units: urls.length,
    estimatedGbp,
    confirmSpend: input.confirmSpend ?? true,
  })
  if (!debit.ok) {
    await markGenerationJob(input.supabase, job.id, {
      status: 'failed',
      error_message: debit.error,
    })
    throw new Error(debit.error)
  }

  return { job, estimatedGbp, urls }
}
