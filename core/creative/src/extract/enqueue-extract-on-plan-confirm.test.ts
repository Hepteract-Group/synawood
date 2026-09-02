import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./list-product-extracts', () => ({
  listProductExtracts: vi.fn(),
}))

vi.mock('./enqueue-product-extract-job', () => ({
  enqueueProductExtractJob: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('enqueueExtractOnPlanConfirm (#1100)', () => {
  it('does not enqueue when Re-extract is off and no extra URLs', async () => {
    const { enqueueExtractOnPlanConfirm } = await import('./enqueue-extract-on-plan-confirm')
    const { enqueueProductExtractJob } = await import('./enqueue-product-extract-job')
    const { listProductExtracts } = await import('./list-product-extracts')
    const result = await enqueueExtractOnPlanConfirm({
      supabase: {} as never,
      productId: 'prod-1',
      projectId: 'proj-1',
      reExtractThisTurn: false,
      extraExtractUrls: [],
      modelProfileId: 'balanced',
    })
    expect(result).toEqual({ enqueued: false, urls: [] })
    expect(enqueueProductExtractJob).not.toHaveBeenCalled()
    expect(listProductExtracts).not.toHaveBeenCalled()
  })

  it('enqueues extra URLs without listing existing extracts', async () => {
    const { enqueueExtractOnPlanConfirm } = await import('./enqueue-extract-on-plan-confirm')
    const { enqueueProductExtractJob } = await import('./enqueue-product-extract-job')
    const { listProductExtracts } = await import('./list-product-extracts')
    vi.mocked(enqueueProductExtractJob).mockResolvedValue({
      job: { id: 'job-1' } as never,
      estimatedGbp: 0.02,
      urls: ['https://example.com/pricing'],
    })
    const result = await enqueueExtractOnPlanConfirm({
      supabase: {} as never,
      productId: 'prod-1',
      projectId: 'proj-1',
      reExtractThisTurn: false,
      extraExtractUrls: ['https://example.com/pricing'],
      modelProfileId: 'balanced',
    })
    expect(result.enqueued).toBe(true)
    expect(result.urls).toEqual(['https://example.com/pricing'])
    expect(listProductExtracts).not.toHaveBeenCalled()
    expect(enqueueProductExtractJob).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmSpend: true,
        urls: ['https://example.com/pricing'],
        projectId: 'proj-1',
      }),
    )
  })

  it('unions existing source URLs when Re-extract is on', async () => {
    const { enqueueExtractOnPlanConfirm } = await import('./enqueue-extract-on-plan-confirm')
    const { enqueueProductExtractJob } = await import('./enqueue-product-extract-job')
    const { listProductExtracts } = await import('./list-product-extracts')
    vi.mocked(listProductExtracts).mockResolvedValue([
      { sourceUrl: 'https://example.com/home' },
      { sourceUrl: 'https://example.com/pricing' },
    ] as never)
    vi.mocked(enqueueProductExtractJob).mockResolvedValue({
      job: { id: 'job-2' } as never,
      estimatedGbp: 0.04,
      urls: ['https://example.com/pricing', 'https://example.com/home'],
    })
    const result = await enqueueExtractOnPlanConfirm({
      supabase: {} as never,
      productId: 'prod-1',
      projectId: 'proj-1',
      reExtractThisTurn: true,
      extraExtractUrls: ['https://example.com/pricing'],
      modelProfileId: 'balanced',
    })
    expect(result.urls).toEqual(['https://example.com/pricing', 'https://example.com/home'])
    expect(enqueueProductExtractJob).toHaveBeenCalledWith(
      expect.objectContaining({
        urls: ['https://example.com/pricing', 'https://example.com/home'],
        confirmSpend: true,
      }),
    )
  })

  it('skips enqueue when Re-extract is on but no URLs exist', async () => {
    const { enqueueExtractOnPlanConfirm } = await import('./enqueue-extract-on-plan-confirm')
    const { enqueueProductExtractJob } = await import('./enqueue-product-extract-job')
    const { listProductExtracts } = await import('./list-product-extracts')
    vi.mocked(listProductExtracts).mockResolvedValue([])
    const result = await enqueueExtractOnPlanConfirm({
      supabase: {} as never,
      productId: 'prod-1',
      projectId: 'proj-1',
      reExtractThisTurn: true,
      extraExtractUrls: [],
      modelProfileId: 'balanced',
    })
    expect(result).toEqual({ enqueued: false, urls: [] })
    expect(enqueueProductExtractJob).not.toHaveBeenCalled()
  })
})
