import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Stub generation-jobs/enqueue ────────────────────────────────────────────

const mockMarkGenerationJob = vi.fn(async (..._args: unknown[]) => undefined)
const mockGetGenerationJob = vi.fn()

vi.mock('./enqueue', async () => {
  const actual = await vi.importActual<typeof import('./enqueue')>('./enqueue')
  return {
    ...actual,
    getGenerationJob: mockGetGenerationJob,
    markGenerationJob: mockMarkGenerationJob,
  }
})

// ── Stub pricing ledger ──────────────────────────────────────────────────────

vi.mock('../pricing/ledger', () => ({
  finalizeCostEvent: vi.fn(async () => ({ id: 'ce-1' })),
}))

// ── Stub capture-section ─────────────────────────────────────────────────────

const mockCaptureSection = vi.fn()

vi.mock('../extract/capture-section', async () => {
  const actual = await vi.importActual<typeof import('../extract/capture-section')>(
    '../extract/capture-section',
  )
  return {
    ...actual,
    captureSection: mockCaptureSection,
  }
})

// ── Fixtures ─────────────────────────────────────────────────────────────────

const makeJob = (overrides: Record<string, unknown> = {}) => ({
  id: 'job-prod-1',
  product_id: 'acme',
  project_id: null,
  status: 'queued',
  role: 'extract',
  model_id: null,
  model_profile_id: 'founder-edit',
  estimated_gbp: 0.04,
  actual_gbp: null,
  input_snapshot: {
    extractKind: 'product_pages',
    urls: ['https://example.com/', 'https://example.com/pricing'],
  },
  output_asset_id: null,
  error_message: null,
  attempt_count: 0,
  units: 2,
  ...overrides,
})

const makeExtractRow = (kind: 'screenshot' | 'text', url: string) => ({
  id: `extract-${kind}-1`,
  productId: 'acme',
  kind,
  sourceUrl: url,
  blobKey: kind === 'screenshot' ? 'local/marketing-os/acme/extract/id/screenshot.png' : undefined,
  text: kind === 'text' ? 'Sample page text' : undefined,
  quality: 'usable' as const,
  jobId: 'job-prod-1',
  createdAt: '2026-08-27T00:00:00.000Z',
  updatedAt: '2026-08-27T00:00:00.000Z',
})

const supabase = {} as never
const blobEnv = {
  connectionString: 'x',
  containerName: 'marketing-os',
  useLocalPrefix: true,
  accountName: 'a',
  accountKey: 'k',
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('runProductExtractJob — fixture URLs produce Extract rows (#1092)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('processes all URLs and returns captured count', async () => {
    mockGetGenerationJob.mockResolvedValueOnce(makeJob())
    mockCaptureSection
      .mockResolvedValueOnce({
        url: 'https://example.com/',
        screenshotExtract: makeExtractRow('screenshot', 'https://example.com/'),
        textExtract: makeExtractRow('text', 'https://example.com/'),
      })
      .mockResolvedValueOnce({
        url: 'https://example.com/pricing',
        screenshotExtract: makeExtractRow('screenshot', 'https://example.com/pricing'),
        textExtract: makeExtractRow('text', 'https://example.com/pricing'),
      })

    const { runProductExtractJob } = await import('./run-product-extract')
    const result = await runProductExtractJob({ supabase, blobEnv, jobId: 'job-prod-1' })

    expect(result.attempted).toBe(2)
    expect(result.captured).toBe(2)
    expect(result.skipped).toBe(0)
    expect(result.results).toHaveLength(2)
    expect(mockMarkGenerationJob).toHaveBeenCalledWith(
      expect.anything(),
      'job-prod-1',
      expect.objectContaining({ status: 'generating' }),
    )
    expect(mockMarkGenerationJob).toHaveBeenCalledWith(
      expect.anything(),
      'job-prod-1',
      expect.objectContaining({ status: 'ready' }),
    )
  })
})

describe('runProductExtractJob — 404 does not wipe successful pages (#1092)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('skips the failing URL and still marks the job ready', async () => {
    mockGetGenerationJob.mockResolvedValueOnce(makeJob())
    mockCaptureSection
      .mockResolvedValueOnce({
        url: 'https://example.com/',
        screenshotExtract: makeExtractRow('screenshot', 'https://example.com/'),
        textExtract: makeExtractRow('text', 'https://example.com/'),
      })
      .mockResolvedValueOnce({
        url: 'https://example.com/pricing',
        skipped: 'http-error',
        skipReason: 'Fetch failed with status 404',
      })

    const { runProductExtractJob } = await import('./run-product-extract')
    const result = await runProductExtractJob({ supabase, blobEnv, jobId: 'job-prod-1' })

    expect(result.attempted).toBe(2)
    expect(result.captured).toBe(1)
    expect(result.skipped).toBe(1)

    const readyCall = mockMarkGenerationJob.mock.calls.find((c) => {
      const patch = c[2] as Record<string, unknown> | undefined
      return patch?.status === 'ready'
    })
    expect(readyCall).toBeDefined()
    // job still reaches ready — not failed
    const failedCall = mockMarkGenerationJob.mock.calls.find((c) => {
      const patch = c[2] as Record<string, unknown> | undefined
      return patch?.status === 'failed'
    })
    expect(failedCall).toBeUndefined()
  })
})

describe('runProductExtractJob — auth wall not stored as success (#1092)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('counts auth-wall pages as skipped in the result', async () => {
    mockGetGenerationJob.mockResolvedValueOnce(makeJob())
    mockCaptureSection
      .mockResolvedValueOnce({
        url: 'https://example.com/',
        skipped: 'auth-wall',
        skipReason: 'Redirected to auth wall: https://example.com/login',
      })
      .mockResolvedValueOnce({
        url: 'https://example.com/pricing',
        screenshotExtract: makeExtractRow('screenshot', 'https://example.com/pricing'),
        textExtract: makeExtractRow('text', 'https://example.com/pricing'),
      })

    const { runProductExtractJob } = await import('./run-product-extract')
    const result = await runProductExtractJob({ supabase, blobEnv, jobId: 'job-prod-1' })

    expect(result.captured).toBe(1)
    expect(result.skipped).toBe(1)

    const authWallResult = result.results.find((r) => r.url === 'https://example.com/')
    expect(authWallResult?.skipped).toBe('auth-wall')
    expect(authWallResult?.screenshotExtract).toBeUndefined()
    expect(authWallResult?.textExtract).toBeUndefined()
  })
})

describe('runProductExtractJob — no stills is a failure (#1365)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('marks the job failed when every page has text but no screenshot', async () => {
    mockGetGenerationJob.mockResolvedValueOnce(makeJob())
    mockCaptureSection
      .mockResolvedValueOnce({
        url: 'https://example.com/',
        textExtract: makeExtractRow('text', 'https://example.com/'),
        screenshotError: "Executable doesn't exist at /tmp/chromium_headless_shell",
      })
      .mockResolvedValueOnce({
        url: 'https://example.com/pricing',
        textExtract: makeExtractRow('text', 'https://example.com/pricing'),
        screenshotError: "Executable doesn't exist at /tmp/chromium_headless_shell",
      })

    const { runProductExtractJob } = await import('./run-product-extract')
    await expect(runProductExtractJob({ supabase, blobEnv, jobId: 'job-prod-1' })).rejects.toThrow(
      /No stills landed/,
    )

    const failedCall = mockMarkGenerationJob.mock.calls.find((c) => {
      const patch = c[2] as Record<string, unknown> | undefined
      return patch?.status === 'failed'
    })
    expect(failedCall?.[2]).toEqual(
      expect.objectContaining({
        status: 'failed',
        error_message: expect.stringMatching(/No stills landed|Executable doesn't exist/),
      }),
    )
  })

  it('marks the job failed when every page is skipped, with the skip reason', async () => {
    mockGetGenerationJob.mockResolvedValueOnce(
      makeJob({ input_snapshot: { extractKind: 'product_pages', urls: ['https://example.com/'] } }),
    )
    mockCaptureSection.mockResolvedValueOnce({
      url: 'https://example.com/',
      skipped: 'auth-wall',
      skipReason: 'Redirected to auth wall: https://example.com/login',
    })

    const { runProductExtractJob } = await import('./run-product-extract')
    await expect(runProductExtractJob({ supabase, blobEnv, jobId: 'job-prod-1' })).rejects.toThrow(
      /No stills landed/,
    )
    const failedCall = mockMarkGenerationJob.mock.calls.find((c) => {
      const patch = c[2] as Record<string, unknown> | undefined
      return patch?.status === 'failed'
    })
    expect(String((failedCall?.[2] as { error_message?: string })?.error_message)).toMatch(
      /auth wall/i,
    )
  })
})

describe('runProductExtractJob — validation (#1092)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws when job is not found', async () => {
    mockGetGenerationJob.mockResolvedValueOnce(null)
    const { runProductExtractJob } = await import('./run-product-extract')
    await expect(runProductExtractJob({ supabase, blobEnv, jobId: 'missing-job' })).rejects.toThrow(
      /not found/,
    )
  })

  it('throws when job role is not extract', async () => {
    mockGetGenerationJob.mockResolvedValueOnce(makeJob({ role: 'image' }))
    const { runProductExtractJob } = await import('./run-product-extract')
    await expect(runProductExtractJob({ supabase, blobEnv, jobId: 'job-prod-1' })).rejects.toThrow(
      /not an extract/,
    )
  })

  it('throws when extractKind is missing or wrong', async () => {
    mockGetGenerationJob.mockResolvedValueOnce(
      makeJob({ input_snapshot: { extractKind: 'brief_extract', urls: [] } }),
    )
    const { runProductExtractJob } = await import('./run-product-extract')
    await expect(runProductExtractJob({ supabase, blobEnv, jobId: 'job-prod-1' })).rejects.toThrow(
      /product_pages/,
    )
  })

  it('throws when no URLs in snapshot', async () => {
    mockGetGenerationJob.mockResolvedValueOnce(
      makeJob({ input_snapshot: { extractKind: 'product_pages', urls: [] } }),
    )
    const { runProductExtractJob } = await import('./run-product-extract')
    await expect(runProductExtractJob({ supabase, blobEnv, jobId: 'job-prod-1' })).rejects.toThrow(
      /no URLs/,
    )
  })
})
