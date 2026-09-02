import { describe, expect, it, vi } from 'vitest'
import { captureSection, isAuthWall } from './capture-section'

// ── Stub blob / DB helpers ───────────────────────────────────────────────────

vi.mock('./put-extract-blob', () => ({
  putExtractBlob: vi.fn(async (_input: { extractId: string }) => ({
    blobKey: `local/marketing-os/acme/extract/${_input.extractId}/screenshot.png`,
  })),
}))

vi.mock('./insert-product-extract', () => ({
  insertProductExtract: vi.fn(
    async (input: {
      kind: string
      sourceUrl: string
      blobKey?: string | null
      text?: string | null
      quality?: string
      qualityNote?: string | null
      jobId?: string | null
      productId: string
      id?: string
    }) => ({
      id: input.id ?? 'extract-row-1',
      productId: input.productId,
      kind: input.kind,
      sourceUrl: input.sourceUrl,
      blobKey: input.blobKey ?? undefined,
      text: input.text ?? undefined,
      quality: input.quality ?? 'usable',
      qualityNote: input.qualityNote ?? undefined,
      jobId: input.jobId ?? undefined,
      createdAt: '2026-08-27T00:00:00.000Z',
      updatedAt: '2026-08-27T00:00:00.000Z',
    }),
  ),
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }]

const makePng = () => Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, ...Buffer.alloc(128, 1)])

const makeBrowser = (
  finalUrl = 'https://example.com/',
  sectionBoxes: unknown[] = [],
  hrefs: string[] = [],
  pageHeight = 720,
) => {
  const png = makePng()
  let currentUrl = finalUrl
  const page = {
    setDefaultTimeout: vi.fn(),
    waitForLoadState: vi.fn(async () => undefined),
    mouse: { wheel: vi.fn(async () => undefined) },
    goto: vi.fn(async (url: string) => {
      currentUrl = url
      return { ok: () => true }
    }),
    url: () => currentUrl,
    evaluate: vi.fn(async (fn: () => unknown, arg?: unknown) => {
      const src = String(fn)
      if (src.includes('scrollHeight')) return pageHeight
      if (src.includes('scrollTo') || src.includes('scrollTop') || typeof arg === 'number') {
        return typeof arg === 'number' ? arg : 0
      }
      if (/accept all|allow cookies/i.test(src)) return undefined
      return { boxes: sectionBoxes, hrefs }
    }),
    screenshot: vi.fn(async () => png),
  }
  return { newPage: vi.fn(async () => page), close: vi.fn(async () => undefined), page }
}

const makeFetch =
  (status: number, html: string, finalUrl?: string) =>
  async (_url: string): Promise<Response> => {
    const url = finalUrl ?? _url
    return {
      ok: status >= 200 && status < 300,
      status,
      url,
      headers: { get: () => null },
      arrayBuffer: async () => Buffer.from(html).buffer,
    } as unknown as Response
  }

const supabase = {} as never
const blobEnv = {
  connectionString: 'x',
  containerName: 'marketing-os',
  useLocalPrefix: true,
  accountName: 'a',
  accountKey: 'k',
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('isAuthWall (#1092)', () => {
  it('returns false for matching hosts and non-auth paths', () => {
    expect(isAuthWall('https://example.com/pricing', 'https://example.com/pricing')).toBe(false)
    expect(isAuthWall('https://example.com/', 'https://example.com/features')).toBe(false)
  })

  it('does not treat www vs apex as an auth wall', () => {
    expect(isAuthWall('https://povotra.com/', 'https://www.povotra.com/')).toBe(false)
    expect(isAuthWall('https://www.example.com/pricing', 'https://example.com/pricing')).toBe(false)
  })

  it('detects cross-domain auth redirect', () => {
    expect(isAuthWall('https://app.example.com/dashboard', 'https://auth.example.com/login')).toBe(
      true,
    )
  })

  it('detects same-domain login paths', () => {
    expect(isAuthWall('https://example.com/pricing', 'https://example.com/login')).toBe(true)
    expect(isAuthWall('https://example.com/pricing', 'https://example.com/signin')).toBe(true)
    expect(isAuthWall('https://example.com/pricing', 'https://example.com/auth/google')).toBe(true)
    expect(isAuthWall('https://example.com/pricing', 'https://example.com/users/sign_in')).toBe(
      true,
    )
    expect(isAuthWall('https://example.com/pricing', 'https://example.com/sso')).toBe(true)
  })
})

describe('captureSection — fixture HTML produces Extract rows (#1092)', () => {
  it('writes text + screenshot extract rows for a public page', async () => {
    const { insertProductExtract } = await import('./insert-product-extract')
    const browser = makeBrowser('https://example.com/')

    const result = await captureSection({
      supabase,
      blobEnv,
      productId: 'acme',
      jobId: 'job-1',
      url: 'https://example.com/',
      lookup: publicLookup,
      fetchImpl: makeFetch(
        200,
        `<!doctype html><html><head><title>Acme</title></head>
         <body><h1>Welcome</h1><p>Great product for teams.</p></body></html>`,
      ),
      launchBrowser: async () => browser as never,
    })

    expect(result.skipped).toBeUndefined()
    expect(result.textExtract).toBeDefined()
    expect(result.screenshotExtract).toBeDefined()
    expect(result.screenshotExtract?.kind).toBe('screenshot')
    expect(result.textExtract?.kind).toBe('text')

    // insertProductExtract called twice: text then screenshot
    expect(insertProductExtract).toHaveBeenCalledTimes(2)
    const calls = vi.mocked(insertProductExtract).mock.calls
    expect(calls.some((c) => c[0]?.kind === 'text')).toBe(true)
    expect(calls.some((c) => c[0]?.kind === 'screenshot')).toBe(true)

    // blob key is set on the screenshot row
    expect(result.screenshotExtract?.blobKey).toMatch(/extract\/.*\/screenshot\.png|\/hero\.png/)

    expect(browser.close).toHaveBeenCalled()
  })

  it('stores a hero still plus section clips, not one full-page strip (#1029)', async () => {
    const { insertProductExtract } = await import('./insert-product-extract')
    vi.mocked(insertProductExtract).mockClear()
    const browser = makeBrowser(
      'https://example.com/',
      [{ x: 0, y: 900, width: 1280, height: 400, label: 'section' }],
      [],
      1600,
    )

    const result = await captureSection({
      supabase,
      blobEnv,
      productId: 'acme',
      jobId: 'job-sections',
      url: 'https://example.com/',
      lookup: publicLookup,
      fetchImpl: makeFetch(200, '<html><body><h1>Acme</h1></body></html>'),
      launchBrowser: async () => browser as never,
    })

    expect(result.screenshotExtracts!.length).toBeGreaterThanOrEqual(2)
    expect(browser.page.evaluate).toHaveBeenCalledWith(expect.any(Function), 576)
    expect(browser.page.screenshot).not.toHaveBeenCalledWith(
      expect.objectContaining({ fullPage: true }),
    )
    expect(browser.page.screenshot).toHaveBeenCalledWith(
      expect.objectContaining({ fullPage: false }),
    )
  })

  it('stores discovered nav pages with their own source URL (#1369)', async () => {
    const { insertProductExtract } = await import('./insert-product-extract')
    vi.mocked(insertProductExtract).mockClear()
    const browser = makeBrowser('https://example.com/', [], ['https://example.com/pricing'])

    await captureSection({
      supabase,
      blobEnv,
      productId: 'acme',
      jobId: 'job-discover',
      url: 'https://example.com/',
      lookup: publicLookup,
      fetchImpl: makeFetch(200, '<html><body><h1>Acme</h1></body></html>'),
      launchBrowser: async () => browser as never,
    })

    const shotCalls = vi
      .mocked(insertProductExtract)
      .mock.calls.filter((call) => call[0]?.kind === 'screenshot')
    expect(shotCalls.map((call) => call[0]?.sourceUrl)).toEqual([
      'https://example.com/',
      'https://example.com/pricing',
    ])
  })

  it('stores a rejected still instead of dropping it (#1093)', async () => {
    const { insertProductExtract } = await import('./insert-product-extract')
    vi.mocked(insertProductExtract).mockClear()
    const browser = makeBrowser('https://example.com/')

    const result = await captureSection({
      supabase,
      blobEnv,
      productId: 'acme',
      jobId: 'job-reject',
      url: 'https://example.com/',
      lookup: publicLookup,
      fetchImpl: makeFetch(200, '<html><body><h1>Acme</h1></body></html>'),
      launchBrowser: async () => browser as never,
      scoreScreenshot: () => ({ quality: 'reject', note: 'login chrome' }),
    })

    expect(result.screenshotExtract?.blobKey).toMatch(/screenshot\.png/)
    const shotCall = vi
      .mocked(insertProductExtract)
      .mock.calls.find((call) => call[0]?.kind === 'screenshot')
    expect(shotCall?.[0]?.quality).toBe('reject')
    expect(shotCall?.[0]?.qualityNote).toMatch(/login chrome/)
  })
})

describe('captureSection — 404 soft-fail (#1092)', () => {
  it('skips with http-error reason and does not insert rows', async () => {
    const { insertProductExtract } = await import('./insert-product-extract')
    vi.mocked(insertProductExtract).mockClear()

    const result = await captureSection({
      supabase,
      blobEnv,
      productId: 'acme',
      jobId: 'job-2',
      url: 'https://example.com/missing',
      lookup: publicLookup,
      fetchImpl: makeFetch(404, 'Not Found'),
      launchBrowser: async () => ({ newPage: vi.fn(), close: vi.fn() }) as never,
    })

    expect(result.skipped).toBe('http-error')
    expect(result.skipReason).toMatch(/404/)
    expect(result.screenshotExtract).toBeUndefined()
    expect(result.textExtract).toBeUndefined()
    expect(insertProductExtract).not.toHaveBeenCalled()
  })
})

describe('captureSection — auth wall skipped (#1092)', () => {
  it('skips without storing a success when redirect lands on /login', async () => {
    const { insertProductExtract } = await import('./insert-product-extract')
    vi.mocked(insertProductExtract).mockClear()

    const result = await captureSection({
      supabase,
      blobEnv,
      productId: 'acme',
      jobId: 'job-3',
      url: 'https://app.example.com/dashboard',
      lookup: publicLookup,
      // fetch redirects to login page
      fetchImpl: makeFetch(200, '<html><body>Login</body></html>', 'https://app.example.com/login'),
      launchBrowser: async () => ({ newPage: vi.fn(), close: vi.fn() }) as never,
    })

    expect(result.skipped).toBe('auth-wall')
    expect(result.textExtract).toBeUndefined()
    expect(result.screenshotExtract).toBeUndefined()
    expect(insertProductExtract).not.toHaveBeenCalled()
  })
})

describe('captureSection — screenshot missing (#1365)', () => {
  it('keeps the text extract and records why the still failed', async () => {
    const result = await captureSection({
      supabase,
      blobEnv,
      productId: 'acme',
      jobId: 'job-shot-fail',
      url: 'https://example.com/',
      lookup: publicLookup,
      fetchImpl: makeFetch(200, '<html><body><h1>Acme</h1></body></html>'),
      launchBrowser: async () => {
        throw new Error(
          "browserType.launch: Executable doesn't exist at /tmp/chromium_headless_shell",
        )
      },
    })

    expect(result.skipped).toBeUndefined()
    expect(result.textExtract).toBeDefined()
    expect(result.screenshotExtract).toBeUndefined()
    expect(result.screenshotError).toMatch(/Executable doesn't exist/)
  })

  it('still captures a screenshot when text insert fails', async () => {
    const { insertProductExtract } = await import('./insert-product-extract')
    vi.mocked(insertProductExtract).mockRejectedValueOnce(
      new Error('Failed to insert product extract: duplicate'),
    )
    const browser = makeBrowser('https://example.com/')

    const result = await captureSection({
      supabase,
      blobEnv,
      productId: 'acme',
      jobId: 'job-text-fail',
      url: 'https://example.com/',
      lookup: publicLookup,
      fetchImpl: makeFetch(200, '<html><body><h1>Acme</h1></body></html>'),
      launchBrowser: async () => browser as never,
    })

    expect(result.skipped).toBeUndefined()
    expect(result.textExtract).toBeUndefined()
    expect(result.textInsertError).toMatch(/duplicate/)
    expect(result.screenshotExtract?.kind).toBe('screenshot')
  })
})

describe('captureSection — SSRF blocked URL (#1092)', () => {
  it('returns ssrf skip reason without inserting rows', async () => {
    const { insertProductExtract } = await import('./insert-product-extract')
    vi.mocked(insertProductExtract).mockClear()

    const result = await captureSection({
      supabase,
      blobEnv,
      productId: 'acme',
      jobId: 'job-4',
      url: 'http://127.0.0.1/admin',
      lookup: async () => [{ address: '127.0.0.1', family: 4 }],
      fetchImpl: async () => {
        throw new Error('should not reach')
      },
      launchBrowser: async () => ({ newPage: vi.fn(), close: vi.fn() }) as never,
    })

    expect(result.skipped).toBe('ssrf')
    expect(insertProductExtract).not.toHaveBeenCalled()
  })
})
