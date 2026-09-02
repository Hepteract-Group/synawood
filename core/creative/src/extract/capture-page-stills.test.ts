import { describe, expect, it, vi } from 'vitest'
import {
  EXTRACT_STILLS_PER_URL_MAX,
  capturePageStills,
  foldScrollYs,
  rankDiscoverLinks,
  rankSectionBoxes,
  type SectionBox,
} from './capture-page-stills'

const box = (overrides: Partial<SectionBox>): SectionBox => ({
  x: 0,
  y: 800,
  width: 1280,
  height: 480,
  label: 'section',
  ...overrides,
})

const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }]

const makePng = (fill = 1) =>
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, ...Buffer.alloc(128, fill)])

const makePage = (input: {
  startUrl: string
  boxes?: SectionBox[]
  hrefs?: string[]
  pageHeight?: number
}) => {
  let currentUrl = input.startUrl
  let shot = 0
  const pageHeight = input.pageHeight ?? 720
  const page = {
    setDefaultTimeout: vi.fn(),
    waitForLoadState: vi.fn(async () => undefined),
    mouse: { wheel: vi.fn(async () => undefined) },
    goto: vi.fn(async (url: string): Promise<{ ok: () => true } | null> => {
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
      return { boxes: input.boxes ?? [], hrefs: input.hrefs ?? [] }
    }),
    screenshot: vi.fn(async () => makePng(++shot)),
  }
  return {
    newPage: vi.fn(async () => page),
    close: vi.fn(async () => undefined),
    page,
  }
}

describe('rankSectionBoxes (#1029 / #1369)', () => {
  it('drops boxes that are too short, too narrow, or a blank-looking strip', () => {
    const ranked = rankSectionBoxes([
      box({ height: 80, label: 'tiny' }),
      box({ width: 120, label: 'rail' }),
      box({ width: 400, height: 1200, label: 'skinny' }),
      box({ y: 900, height: 400, label: 'pricing' }),
    ])
    expect(ranked.map((item) => item.label)).toEqual(['pricing'])
  })

  it('skips sections already covered by the hero viewport', () => {
    const ranked = rankSectionBoxes([
      box({ y: 0, height: 400, label: 'header' }),
      box({ y: 900, height: 400, label: 'features' }),
    ])
    expect(ranked.map((item) => item.label)).toEqual(['features'])
  })

  it('skips a tall first-fold section that overlaps the hero (duplicate hero clip)', () => {
    const ranked = rankSectionBoxes([
      box({ y: 0, height: 900, label: 'section' }),
      box({ y: 960, height: 400, label: 'pricing' }),
    ])
    expect(ranked.map((item) => item.label)).toEqual(['pricing'])
  })

  it('caps remaining clips so hero plus sections stay at 10 per URL', () => {
    const boxes = Array.from({ length: 20 }, (_, i) =>
      box({ y: 800 + i * 500, label: `block-${i}` }),
    )
    const ranked = rankSectionBoxes(boxes)
    expect(ranked).toHaveLength(EXTRACT_STILLS_PER_URL_MAX - 1)
  })
})

describe('foldScrollYs (#1369)', () => {
  it('returns later fold offsets when the page is taller than the viewport', () => {
    expect(foldScrollYs(2500, 720, 9)).toEqual([576, 1152, 1728])
  })

  it('returns no extra folds when the page fits in one viewport', () => {
    expect(foldScrollYs(720, 720, 9)).toEqual([])
    expect(foldScrollYs(800, 720, 9)).toEqual([])
  })
})

describe('rankDiscoverLinks (#1369)', () => {
  it('keeps same-site nav/footer paths and skips login, self, and other hosts', () => {
    expect(
      rankDiscoverLinks(
        [
          'https://povotra.com/',
          'https://povotra.com/pricing',
          'https://povotra.com/login',
          'https://other.com/about',
          'mailto:hi@povotra.com',
          'https://povotra.com/#hero',
          'https://www.povotra.com/resources',
        ],
        'https://povotra.com/',
      ),
    ).toEqual(['https://povotra.com/pricing', 'https://www.povotra.com/resources'])
  })

  it('prefers pricing and product paths over generic ones', () => {
    const ranked = rankDiscoverLinks(
      ['https://example.com/legal', 'https://example.com/pricing', 'https://example.com/product'],
      'https://example.com/',
    )
    expect(ranked.slice(0, 2)).toEqual([
      'https://example.com/pricing',
      'https://example.com/product',
    ])
  })
})

describe('capturePageStills (#1369)', () => {
  it('scrolls the landing page in viewport folds before visiting nav links', async () => {
    const browser = makePage({
      startUrl: 'https://example.com/',
      boxes: [],
      hrefs: ['https://example.com/pricing'],
      pageHeight: 2500,
    })

    const result = await capturePageStills({
      url: 'https://example.com/',
      lookup: publicLookup,
      launchBrowser: async () => browser as never,
    })

    const scrollYs = browser.page.evaluate.mock.calls
      .filter((call) => typeof call[1] === 'number')
      .map((call) => call[1])
    expect(scrollYs).toEqual(expect.arrayContaining([576, 1152, 1728]))
    expect(result.stills.filter((still) => still.sourceUrl === 'https://example.com/').length).toBe(
      4,
    )
    expect(result.stills.some((still) => still.note.includes('Scrolled'))).toBe(true)
    expect(browser.page.goto.mock.calls.map((call) => call[0])).toEqual([
      'https://example.com/',
      'https://example.com/pricing',
    ])
  })

  it('visits same-site nav links when the landing page has fewer than 10 stills', async () => {
    const browser = makePage({
      startUrl: 'https://example.com/',
      boxes: [],
      hrefs: ['https://example.com/pricing', 'https://example.com/resources'],
    })

    const result = await capturePageStills({
      url: 'https://example.com/',
      lookup: publicLookup,
      launchBrowser: async () => browser as never,
    })

    expect(browser.page.goto.mock.calls.map((call) => call[0])).toEqual([
      'https://example.com/',
      'https://example.com/pricing',
      'https://example.com/resources',
    ])
    expect(result.stills).toHaveLength(3)
    expect(result.stills.map((still) => still.sourceUrl)).toEqual([
      'https://example.com/',
      'https://example.com/pricing',
      'https://example.com/resources',
    ])
    expect(browser.page.screenshot).not.toHaveBeenCalledWith(
      expect.objectContaining({ fullPage: true }),
    )
  })

  it('does not follow nav links once 10 stills are already captured', async () => {
    const browser = makePage({
      startUrl: 'https://example.com/',
      hrefs: ['https://example.com/pricing'],
      pageHeight: 6000,
    })

    const result = await capturePageStills({
      url: 'https://example.com/',
      lookup: publicLookup,
      launchBrowser: async () => browser as never,
    })

    expect(browser.page.goto.mock.calls.map((call) => call[0])).toEqual(['https://example.com/'])
    expect(result.stills).toHaveLength(EXTRACT_STILLS_PER_URL_MAX)
  })

  it('skips a fold when the screenshot throws and still visits leftover nav', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const browser = makePage({
      startUrl: 'https://example.com/',
      boxes: [],
      hrefs: ['https://example.com/pricing'],
      pageHeight: 2000,
    })
    browser.page.screenshot = vi.fn(async () => {
      if (browser.page.screenshot.mock.calls.length === 2) {
        throw new Error('fold timeout')
      }
      return makePng(9)
    })

    const result = await capturePageStills({
      url: 'https://example.com/',
      lookup: publicLookup,
      launchBrowser: async () => browser as never,
    })

    expect(warn.mock.calls.some((call) => String(call[0]).includes('Scroll'))).toBe(true)
    expect(result.stills.length).toBeGreaterThan(0)
    warn.mockRestore()
  })

  it('skips a nav URL that throws and keeps earlier stills', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const browser = makePage({
      startUrl: 'https://example.com/',
      boxes: [],
      hrefs: ['https://example.com/pricing'],
      pageHeight: 720,
    })
    browser.page.goto = vi.fn(async (url: string) => {
      if (url.includes('/pricing')) throw new Error('nav failed')
      return { ok: () => true }
    })

    const result = await capturePageStills({
      url: 'https://example.com/',
      lookup: publicLookup,
      launchBrowser: async () => browser as never,
    })

    expect(result.stills).toHaveLength(1)
    expect(warn.mock.calls.some((call) => String(call[0]).includes('Discover'))).toBe(true)
    warn.mockRestore()
  })

  it('throws when the start URL returns no response', async () => {
    const browser = makePage({ startUrl: 'https://example.com/' })
    browser.page.goto = vi.fn(async (_url: string) => null)

    await expect(
      capturePageStills({
        url: 'https://example.com/',
        lookup: publicLookup,
        launchBrowser: async () => browser as never,
      }),
    ).rejects.toThrow(/no response/)
  })
})
