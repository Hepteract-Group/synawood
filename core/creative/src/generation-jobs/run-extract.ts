import type { SupabaseClient } from '@supabase/supabase-js'
import { adaptPdfSource, adaptUrlSource } from '../extract'
import { PRODUCT_EXTRACT_JOB_KIND } from '../extract/enqueue-product-extract-job'
import { capturePageScreenshot } from '../extract/capture-page-screenshot'
import { materializeExtractBrandImages } from '../extract/materialize-brand-images'
import { persistExtractScreenshotAsset } from '../extract/persist-screenshot-asset'
import { getBlobBytes, type BlobEnv } from '../persistence/blob'
import { attachMissingExtractAssets, loadProject, saveProject, type ProjectAsset } from '../project'
import { resolveCreativeSpendGate } from '../billing/gate'
import { debitForJob } from '../billing/debit-for-job'
import { refundJobWallet } from '../billing/refund-job-wallet'
import { loadHostedSpendContext } from '../billing/load-hosted-spend-context'
import { readCreativeBudgets } from '../pricing/limits'
import { finalizeCostEvent } from '../pricing/ledger'
import {
  enqueueGenerationJob,
  getGenerationJob,
  markGenerationJob,
  type GenerationJobRow,
} from './enqueue'
import {
  estimateExtractGbp,
  extractCreditBlockReason,
  isNoLlmReasoner,
  settleExtractActualGbp,
} from './estimate-extract'
import { fillExtractedBriefFromDigest } from './fill-brief-from-digest'
import { enrichBriefFromVision, markEnrichmentSkipped } from './enrich-brief-from-vision'
import type { ExtractedBrief } from '../brief/extracted-brief'

export type ExtractSourceKind = 'url' | 'pdf'

export type EnqueueExtractInput = {
  supabase: SupabaseClient
  productId: string
  projectId: string
  sourceKind: ExtractSourceKind
  url?: string
  /** Blob key of an uploaded PDF already on the product. */
  blobKey?: string
  reasonerModelId: string
  modelProfileId: string
  /** Ignored. Extract click is consent; kept so older clients do not 400. */
  confirmSpend?: boolean
}

export const enqueueExtractJob = async (
  input: EnqueueExtractInput,
): Promise<{ job: GenerationJobRow; estimatedGbp: number }> => {
  if (input.sourceKind === 'url' && !input.url?.trim()) {
    throw new Error('url is required for sourceKind=url')
  }
  if (input.sourceKind === 'pdf' && !input.blobKey?.trim()) {
    throw new Error('blobKey is required for sourceKind=pdf')
  }

  const estimatedGbp = estimateExtractGbp(input.reasonerModelId, {
    sourceKind: input.sourceKind,
  })

  const ctx = await loadHostedSpendContext(input.supabase, {
    productId: input.productId,
    projectId: input.projectId,
  })
  const budgets = readCreativeBudgets()
  const remainingMonthlyGbp = budgets.monthlyGeneratorCap - ctx.spentThisMonthGbp
  const creditBlock = extractCreditBlockReason({ estimatedGbp, remainingMonthlyGbp })
  if (creditBlock) {
    throw new Error(creditBlock)
  }
  const gate = await resolveCreativeSpendGate(input.supabase, {
    productId: input.productId,
    projectId: input.projectId,
    estimatedGbp,
    requireConfirm: false,
    confirmSpend: true,
  })
  if (!gate.ok) {
    throw new Error(gate.error)
  }

  const job = await enqueueGenerationJob(input.supabase, {
    productId: input.productId,
    projectId: input.projectId,
    role: 'extract',
    modelId: input.reasonerModelId,
    modelProfileId: input.modelProfileId,
    estimatedGbp,
    units: 1,
    inputSnapshot: {
      sourceKind: input.sourceKind,
      url: input.url?.trim() || null,
      blobKey: input.blobKey?.trim() || null,
      reasonerModelId: input.reasonerModelId,
    },
  })

  const debit = await debitForJob(input.supabase, {
    productId: input.productId,
    projectId: input.projectId,
    jobId: job.id,
    role: 'extract',
    modelId: input.reasonerModelId,
    units: 1,
    estimatedGbp,
    confirmSpend: true,
  })
  if (!debit.ok) {
    await markGenerationJob(input.supabase, job.id, {
      status: 'failed',
      error_message: debit.error,
    })
    throw new Error(debit.error)
  }

  return { job, estimatedGbp }
}

export const runExtractJob = async (input: {
  supabase: SupabaseClient
  blobEnv: BlobEnv
  jobId: string
}): Promise<{ jobId: string; briefId: string; brief: ExtractedBrief }> => {
  const job = await getGenerationJob(input.supabase, input.jobId)
  if (!job) {
    throw new Error(`Generation job not found: ${input.jobId}`)
  }
  if (job.role !== 'extract') {
    throw new Error(`Job ${input.jobId} is not an extract job`)
  }
  if (!job.project_id) {
    throw new Error(`Extract job ${input.jobId} has no project_id`)
  }

  const snapshot = job.input_snapshot ?? {}
  const sourceKind = snapshot.sourceKind as ExtractSourceKind | undefined
  const url = typeof snapshot.url === 'string' ? snapshot.url : undefined
  const blobKey = typeof snapshot.blobKey === 'string' ? snapshot.blobKey : undefined

  try {
    await markGenerationJob(input.supabase, job.id, {
      status: 'generating',
      attempt_count: (job.attempt_count ?? 0) + 1,
    })

    let digest
    if (sourceKind === 'url') {
      if (!url) throw new Error('Extract snapshot missing url')
      digest = await adaptUrlSource({ url })
    } else if (sourceKind === 'pdf') {
      if (!blobKey) throw new Error('Extract snapshot missing blobKey')
      const bytes = await getBlobBytes({ blobEnv: input.blobEnv, blobKey })
      digest = await adaptPdfSource({ bytes })
    } else {
      throw new Error(`Unknown extract sourceKind: ${String(sourceKind)}`)
    }

    const brandImages =
      digest.kind === 'url'
        ? await materializeExtractBrandImages({
            supabase: input.supabase,
            blobEnv: input.blobEnv,
            productId: job.product_id,
            projectId: job.project_id,
            imageCandidates: digest.imageCandidates,
          })
        : {}

    const stillAssetIds = brandImages.stillAsset
      ? [brandImages.stillAsset.id]
      : brandImages.logoAsset
        ? [brandImages.logoAsset.id]
        : []

    let brief = fillExtractedBriefFromDigest({
      digest,
      sourceUri: sourceKind === 'url' ? url : blobKey,
      brandAssets: {
        logoAssetId: brandImages.logoAsset?.id,
        stillAssetIds,
        sampledPrimaryColor: brandImages.sampledPrimaryColor,
        sampledAccentColor: brandImages.sampledAccentColor,
      },
    })

    const reasonerModelId =
      (typeof snapshot.reasonerModelId === 'string' && snapshot.reasonerModelId) ||
      job.model_id ||
      'mock-reasoner'
    let enrichmentWarning: string | null = null
    let enrichmentSucceeded = false
    let screenshotCaptured = false

    if (!isNoLlmReasoner(reasonerModelId) && digest.kind === 'url' && url) {
      try {
        const shot = await capturePageScreenshot({ url })
        screenshotCaptured = true
        await persistExtractScreenshotAsset({
          supabase: input.supabase,
          blobEnv: input.blobEnv,
          productId: job.product_id,
          projectId: job.project_id,
          png: shot.png,
          sourceUrl: shot.finalUrl,
        })

        let logoBytes: Buffer | undefined
        let logoContentType: string | undefined
        if (brandImages.logoAsset?.blobKey) {
          try {
            logoBytes = await getBlobBytes({
              blobEnv: input.blobEnv,
              blobKey: brandImages.logoAsset.blobKey,
            })
            logoContentType = brandImages.logoAsset.contentType
          } catch {
            /* logo optional for vision */
          }
        }

        let stillBytes: Buffer | undefined
        let stillContentType: string | undefined
        if (brandImages.stillAsset?.blobKey) {
          try {
            stillBytes = await getBlobBytes({
              blobEnv: input.blobEnv,
              blobKey: brandImages.stillAsset.blobKey,
            })
            stillContentType = brandImages.stillAsset.contentType
          } catch {
            /* still optional for vision */
          }
        }

        brief = await enrichBriefFromVision({
          brief,
          reasonerModelId,
          digestText: digest.textDigest,
          colorGuesses: digest.colorGuesses,
          screenshotPng: shot.png,
          logoBytes,
          logoContentType,
          stillBytes,
          stillContentType,
        })
        enrichmentSucceeded = true
      } catch (error) {
        enrichmentWarning = error instanceof Error ? error.message : 'Vision enrichment failed'
        brief = markEnrichmentSkipped(brief, enrichmentWarning)
      }
    } else if (!isNoLlmReasoner(reasonerModelId) && sourceKind === 'pdf') {
      enrichmentWarning = 'Vision enrichment requires a URL source; PDF used deterministic brief.'
      brief = markEnrichmentSkipped(brief, enrichmentWarning)
    }

    const extractAssets: ProjectAsset[] = [brandImages.logoAsset, brandImages.stillAsset].filter(
      (asset): asset is ProjectAsset => Boolean(asset),
    )
    if (extractAssets.length > 0) {
      try {
        const loaded = await loadProject(input.supabase, job.project_id)
        const next = attachMissingExtractAssets(loaded.project, extractAssets)
        if (next.assets.length !== loaded.project.assets.length) {
          await saveProject(
            input.supabase,
            { ...next, revision: loaded.project.revision },
            loaded.project.revision,
          )
        }
      } catch (error) {
        console.warn(
          'Extract logo attach skipped; Review will use assets-table fallback',
          error instanceof Error ? error.message : error,
        )
      }
    }

    const { data: briefRow, error: insertError } = await input.supabase
      .from('extracted_briefs')
      .insert({
        id: brief.id,
        product_id: job.product_id,
        project_id: job.project_id,
        job_id: job.id,
        status: 'ready',
        source_kind: sourceKind,
        source_uri: sourceKind === 'url' ? url : blobKey,
        brief_json: brief,
      })
      .select('id')
      .single()

    if (insertError) {
      throw new Error(`Failed to save extracted brief: ${insertError.message}`)
    }

    // Soft-fail must not bill full vision estimate when enrichment did not run (ADR-0028).
    const estimatedGbp = job.estimated_gbp ?? 0
    const actualGbp = settleExtractActualGbp({
      estimatedGbp,
      enrichmentSucceeded,
      screenshotCaptured,
    })
    await markGenerationJob(input.supabase, job.id, {
      status: 'ready',
      actual_gbp: actualGbp,
      error_message: enrichmentWarning
        ? `Enrichment skipped: ${enrichmentWarning}`.slice(0, 500)
        : null,
    })
    await finalizeCostEvent(input.supabase, {
      productId: job.product_id,
      projectId: job.project_id,
      jobId: job.id,
      role: 'extract',
      modelId: job.model_id ?? undefined,
      units: 1,
      estimatedGbp,
      actualGbp,
    })

    return { jobId: job.id, briefId: briefRow.id as string, brief }
  } catch (error) {
    const failed = await markGenerationJob(input.supabase, job.id, {
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Extract failed',
    })
    await refundJobWallet(input.supabase, {
      productId: job.product_id,
      jobId: job.id,
      status: failed.status,
      actualGbp: failed.actual_gbp,
    })
    throw error
  }
}

export const getLatestExtractJobForProject = async (
  supabase: SupabaseClient,
  projectId: string,
): Promise<GenerationJobRow | null> => {
  const { data, error } = await supabase
    .from('generation_jobs')
    .select('*')
    .eq('project_id', projectId)
    .eq('role', 'extract')
    .order('created_at', { ascending: false })
    .limit(10)
  if (error) {
    throw new Error(`Failed to load latest extract job: ${error.message}`)
  }
  const rows = (data as GenerationJobRow[] | null) ?? []
  // product_pages jobs use the generation-job banner (toast + player strip), not Ad Generator ExtractProgress.
  return rows.find((row) => row.input_snapshot?.extractKind !== PRODUCT_EXTRACT_JOB_KIND) ?? null
}

export const loadBriefForJob = async (
  supabase: SupabaseClient,
  jobId: string,
): Promise<{ id: string; brief: ExtractedBrief } | null> => {
  const { data, error } = await supabase
    .from('extracted_briefs')
    .select('id, brief_json')
    .eq('job_id', jobId)
    .maybeSingle()
  if (error) {
    throw new Error(`Failed to load brief for job: ${error.message}`)
  }
  if (!data) return null
  return { id: data.id as string, brief: data.brief_json as ExtractedBrief }
}
