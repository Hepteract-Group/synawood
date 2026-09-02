import { describe, expect, it, vi } from 'vitest'
import { estimateExtractGbp, fillExtractedBriefFromDigest } from './fill-brief-from-digest'
import type { UrlSourceDigest } from '../extract/types'

const mockInsert = vi.fn()
const mockFrom = vi.fn(() => ({
  insert: (row: unknown) => {
    mockInsert(row)
    return {
      select: () => ({
        single: async () => ({ data: row, error: null }),
      }),
    }
  },
}))

vi.mock('./enqueue', async () => {
  const actual = await vi.importActual<typeof import('./enqueue')>('./enqueue')
  return {
    ...actual,
    enqueueGenerationJob: vi.fn(async (_supabase, input) => ({
      id: 'job-1',
      product_id: input.productId,
      project_id: input.projectId,
      status: 'queued' as const,
      role: input.role,
      model_id: input.modelId,
      model_profile_id: input.modelProfileId,
      estimated_gbp: input.estimatedGbp,
      actual_gbp: null,
      input_snapshot: input.inputSnapshot,
      output_asset_id: null,
      error_message: null,
      attempt_count: 0,
      units: input.units ?? null,
    })),
  }
})

vi.mock('../pricing/ledger', () => ({
  sumCostEventsGbp: vi.fn(async () => 0),
  recordCostEvent: vi.fn(async () => ({ id: 'ce-1' })),
  finalizeCostEvent: vi.fn(async () => ({ id: 'ce-1' })),
}))

vi.mock('../billing/load-hosted-spend-context', () => ({
  loadHostedSpendContext: vi.fn(async () => ({
    hasWallet: false,
    walletBalanceGbp: 0,
    generationFrozen: false,
    spentThisMonthGbp: 0,
    spentThisWeekGbp: 0,
    spentThisProjectGbp: 0,
    spentThisMonthFromWalletGbp: 0,
    monthlyGeneratorCapGbp: null,
    planId: null,
    trialEndsAt: null,
    seatLimit: null,
    hasBillingRow: false,
  })),
}))

vi.mock('../billing/gate', () => ({
  resolveCreativeSpendGate: vi.fn(async () => ({ ok: true, remainingMonthlyGbp: 100 })),
}))

vi.mock('../billing/debit-for-job', () => ({
  debitForJob: vi.fn(async () => ({ ok: true, skipped: true })),
}))

describe('enqueueExtractJob', () => {
  it('rejects url extracts without a url', async () => {
    const { enqueueExtractJob } = await import('./run-extract')
    await expect(
      enqueueExtractJob({
        supabase: { from: mockFrom } as never,
        productId: 'demo',
        projectId: 'proj-1',
        sourceKind: 'url',
        reasonerModelId: 'mock-reasoner',
        modelProfileId: 'founder-edit',
      }),
    ).rejects.toThrow(/url is required/)
  })

  it('enqueues an extract job with spend estimate 0 for No LLM reasoner', async () => {
    const { enqueueExtractJob } = await import('./run-extract')
    const { enqueueGenerationJob } = await import('./enqueue')
    const result = await enqueueExtractJob({
      supabase: { from: mockFrom } as never,
      productId: 'demo',
      projectId: 'proj-1',
      sourceKind: 'url',
      url: 'https://example.com/',
      reasonerModelId: 'mock-reasoner',
      modelProfileId: 'founder-edit',
    })
    expect(result.estimatedGbp).toBe(0)
    expect(result.job.role).toBe('extract')
    expect(enqueueGenerationJob).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        role: 'extract',
        inputSnapshot: expect.objectContaining({
          sourceKind: 'url',
          url: 'https://example.com/',
        }),
      }),
    )
  })

  it('enqueues a paid URL extract without confirmSpend', async () => {
    const { enqueueExtractJob } = await import('./run-extract')
    const result = await enqueueExtractJob({
      supabase: { from: mockFrom } as never,
      productId: 'demo',
      projectId: 'proj-1',
      sourceKind: 'url',
      url: 'https://example.com/',
      reasonerModelId: 'openai/gpt-4.1-mini',
      modelProfileId: 'founder-edit',
    })
    expect(result.estimatedGbp).toBeGreaterThan(0)
    expect(result.job.role).toBe('extract')
  })

  it('rejects paid URL extract when monthly remaining is zero', async () => {
    const { loadHostedSpendContext } = await import('../billing/load-hosted-spend-context')
    vi.mocked(loadHostedSpendContext).mockResolvedValueOnce({
      hasWallet: false,
      walletBalanceGbp: 0,
      generationFrozen: false,
      spentThisMonthGbp: 10_000,
      spentThisWeekGbp: 0,
      spentThisProjectGbp: 0,
      spentThisMonthFromWalletGbp: 0,
      monthlyGeneratorCapGbp: null,
      planId: null,
      trialEndsAt: null,
      seatLimit: null,
      hasBillingRow: false,
    })
    const { enqueueExtractJob } = await import('./run-extract')
    await expect(
      enqueueExtractJob({
        supabase: { from: mockFrom } as never,
        productId: 'demo',
        projectId: 'proj-1',
        sourceKind: 'url',
        url: 'https://example.com/',
        reasonerModelId: 'openai/gpt-4.1-mini',
        modelProfileId: 'founder-edit',
      }),
    ).rejects.toThrow(/credits/i)
  })

  it('enqueues PDF extract at £0 even when monthly remaining is zero', async () => {
    const { loadHostedSpendContext } = await import('../billing/load-hosted-spend-context')
    vi.mocked(loadHostedSpendContext).mockResolvedValueOnce({
      hasWallet: false,
      walletBalanceGbp: 0,
      generationFrozen: false,
      spentThisMonthGbp: 10_000,
      spentThisWeekGbp: 0,
      spentThisProjectGbp: 0,
      spentThisMonthFromWalletGbp: 0,
      monthlyGeneratorCapGbp: null,
      planId: null,
      trialEndsAt: null,
      seatLimit: null,
      hasBillingRow: false,
    })
    const { enqueueExtractJob } = await import('./run-extract')
    const result = await enqueueExtractJob({
      supabase: { from: mockFrom } as never,
      productId: 'demo',
      projectId: 'proj-1',
      sourceKind: 'pdf',
      blobKey: 'pdfs/brochure.pdf',
      reasonerModelId: 'openai/gpt-4.1-mini',
      modelProfileId: 'founder-edit',
    })
    expect(result.estimatedGbp).toBe(0)
  })
})

describe('extractCreditBlockReason', () => {
  it('allows free extracts even with no remaining budget', async () => {
    const { extractCreditBlockReason } = await import('./estimate-extract')
    expect(extractCreditBlockReason({ estimatedGbp: 0, remainingMonthlyGbp: 0 })).toBeNull()
  })

  it('blocks paid extracts when remaining is zero or too low', async () => {
    const { extractCreditBlockReason } = await import('./estimate-extract')
    expect(extractCreditBlockReason({ estimatedGbp: 0.12, remainingMonthlyGbp: 0 })).toMatch(
      /No generator credits/,
    )
    expect(extractCreditBlockReason({ estimatedGbp: 0.12, remainingMonthlyGbp: 0.05 })).toMatch(
      /Not enough generator credits/,
    )
    expect(extractCreditBlockReason({ estimatedGbp: 0.12, remainingMonthlyGbp: 1 })).toBeNull()
  })
})

describe('estimateExtractGbp', () => {
  it('is zero for No LLM reasoners', () => {
    expect(estimateExtractGbp('mock-reasoner')).toBe(0)
    expect(estimateExtractGbp('mock-anything')).toBe(0)
  })

  it('is positive for real reasoners on URL extracts (screenshot + vision)', () => {
    expect(estimateExtractGbp('openai/gpt-4.1-mini')).toBeGreaterThan(0.04)
    expect(estimateExtractGbp('openai/gpt-4.1-mini', { sourceKind: 'url' })).toBeGreaterThan(0.04)
  })

  it('is zero for PDF extracts (no vision in v1)', () => {
    expect(estimateExtractGbp('openai/gpt-4.1-mini', { sourceKind: 'pdf' })).toBe(0)
  })
})

describe('settleExtractActualGbp', () => {
  it('bills full estimate only when enrichment succeeded', async () => {
    const { settleExtractActualGbp, EXTRACT_SCREENSHOT_GBP } = await import('./estimate-extract')
    expect(
      settleExtractActualGbp({
        estimatedGbp: 0.05,
        enrichmentSucceeded: true,
        screenshotCaptured: true,
      }),
    ).toBe(0.05)
    expect(
      settleExtractActualGbp({
        estimatedGbp: 0.05,
        enrichmentSucceeded: false,
        screenshotCaptured: true,
      }),
    ).toBe(EXTRACT_SCREENSHOT_GBP)
    expect(
      settleExtractActualGbp({
        estimatedGbp: 0.05,
        enrichmentSucceeded: false,
        screenshotCaptured: false,
      }),
    ).toBe(0)
  })
})

describe('fillExtractedBriefFromDigest smoke', () => {
  it('keeps confidence in range', () => {
    const digest: UrlSourceDigest = {
      kind: 'url',
      finalUrl: 'https://example.com',
      title: 'Example',
      textDigest: 'Example product for busy people who need focus tools every day.',
      imageCandidates: [],
      colorGuesses: [],
      fetchedAt: '2026-08-02T12:00:00.000Z',
      bytesRead: 10,
    }
    const brief = fillExtractedBriefFromDigest({ digest, sourceUri: digest.finalUrl })
    expect(brief.confidence.overall).toBeGreaterThan(0)
    expect(brief.confidence.overall).toBeLessThanOrEqual(1)
  })
})
