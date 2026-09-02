import { describe, expect, it, vi } from 'vitest'
import { UnsafeUrlError } from './ssrf'
import { validateProductExtractUrls } from './validate-product-extract-urls'

const publicLookup = async (hostname: string) => {
  if (hostname === '127.0.0.1' || hostname === 'localhost') {
    return [{ address: '127.0.0.1', family: 4 }]
  }
  return [{ address: '93.184.216.34', family: 4 }]
}

describe('validateProductExtractUrls (#1091)', () => {
  it('rejects private/link-local URLs before enqueue', async () => {
    await expect(
      validateProductExtractUrls(['http://127.0.0.1/page'], { lookup: publicLookup }),
    ).rejects.toBeInstanceOf(UnsafeUrlError)
    await expect(
      validateProductExtractUrls(['http://localhost/about'], { lookup: publicLookup }),
    ).rejects.toBeInstanceOf(UnsafeUrlError)
  })

  it('accepts a public fixture URL without live fetch', async () => {
    const validated = await validateProductExtractUrls(['https://example.com/about'], {
      lookup: publicLookup,
    })
    expect(validated).toHaveLength(1)
    expect(validated[0]?.normalized.href).toBe('https://example.com/about')
  })

  it('dedupes identical URLs', async () => {
    const validated = await validateProductExtractUrls(
      ['https://example.com/a', 'https://example.com/a'],
      { lookup: publicLookup },
    )
    expect(validated).toHaveLength(1)
  })

  it('rejects an empty URL list', async () => {
    await expect(validateProductExtractUrls([], { lookup: publicLookup })).rejects.toThrow(
      /At least one public URL/,
    )
    await expect(validateProductExtractUrls(['  '], { lookup: publicLookup })).rejects.toThrow(
      /At least one public URL/,
    )
  })
})

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

vi.mock('../generation-jobs/enqueue', () => ({
  enqueueGenerationJob: vi.fn(async (_supabase, input) => ({
    id: 'job-product-extract-1',
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
  markGenerationJob: vi.fn(async () => undefined),
}))

describe('enqueueProductExtractJob (#1091)', () => {
  it('enqueues one extract job for public fixture URLs without crawling', async () => {
    const { enqueueProductExtractJob } = await import('./enqueue-product-extract-job')
    const { enqueueGenerationJob } = await import('../generation-jobs/enqueue')
    const result = await enqueueProductExtractJob({
      supabase: { from: vi.fn() } as never,
      productId: 'acme',
      projectId: '22222222-2222-4222-8222-222222222222',
      urls: ['https://example.com/pricing', 'https://example.com/about'],
      modelProfileId: 'founder-edit',
      lookup: publicLookup,
    })
    expect(result.job.role).toBe('extract')
    expect(result.urls).toEqual(['https://example.com/pricing', 'https://example.com/about'])
    expect(enqueueGenerationJob).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        role: 'extract',
        inputSnapshot: expect.objectContaining({
          extractKind: 'product_pages',
          urls: ['https://example.com/pricing', 'https://example.com/about'],
        }),
      }),
    )
  })

  it('blocks when monthly generator credits are exhausted', async () => {
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
    } as never)
    const { enqueueProductExtractJob } = await import('./enqueue-product-extract-job')
    await expect(
      enqueueProductExtractJob({
        supabase: { from: vi.fn() } as never,
        productId: 'acme',
        urls: ['https://example.com/about'],
        modelProfileId: 'founder-edit',
        lookup: publicLookup,
      }),
    ).rejects.toThrow(/credit|cap|month/i)
  })

  it('throws when the spend gate rejects', async () => {
    const { resolveCreativeSpendGate } = await import('../billing/gate')
    vi.mocked(resolveCreativeSpendGate).mockResolvedValueOnce({
      ok: false,
      error: 'Confirm spend first',
    } as never)
    const { enqueueProductExtractJob } = await import('./enqueue-product-extract-job')
    await expect(
      enqueueProductExtractJob({
        supabase: { from: vi.fn() } as never,
        productId: 'acme',
        urls: ['https://example.com/about'],
        modelProfileId: 'founder-edit',
        confirmSpend: false,
        lookup: publicLookup,
      }),
    ).rejects.toThrow(/Confirm spend first/)
  })

  it('marks the job failed when debit fails', async () => {
    const { debitForJob } = await import('../billing/debit-for-job')
    const { markGenerationJob } = await import('../generation-jobs/enqueue')
    vi.mocked(debitForJob).mockResolvedValueOnce({ ok: false, error: 'Wallet empty' } as never)
    const { enqueueProductExtractJob } = await import('./enqueue-product-extract-job')
    await expect(
      enqueueProductExtractJob({
        supabase: { from: vi.fn() } as never,
        productId: 'acme',
        urls: ['https://example.com/about'],
        modelProfileId: 'founder-edit',
        lookup: publicLookup,
      }),
    ).rejects.toThrow(/Wallet empty/)
    expect(markGenerationJob).toHaveBeenCalledWith(
      expect.anything(),
      'job-product-extract-1',
      expect.objectContaining({ status: 'failed', error_message: 'Wallet empty' }),
    )
  })
})
