import type { Browser, Page } from 'playwright'
import { assertSafeFetchUrl, type HostLookup, UnsafeUrlError } from './ssrf'
import { isAuthWall } from './is-auth-wall'
import {
  EXTRACT_SCREENSHOT_MAX_BYTES,
  EXTRACT_SCREENSHOT_TIMEOUT_MS,
  EXTRACT_SCREENSHOT_VIEWPORT,
  type LaunchBrowser,
} from './capture-page-screenshot'

export const EXTRACT_STILLS_PER_URL_MAX = 10
export const EXTRACT_STILL_MIN_HEIGHT = 200
export const EXTRACT_STILL_MIN_WIDTH = 400
export const EXTRACT_STILL_MAX_ASPECT = 2.5

export type SectionBox = {
  x: number
  y: number
  width: number
  height: number
  label: string
  heading?: string
}

export type PageStill = {
  png: Buffer
  label: string
  note: string
  sourceUrl?: string
}

export type PageStillTargets = {
  boxes: SectionBox[]
  hrefs: string[]
}

const defaultLaunchBrowser: LaunchBrowser = async () => {
  const { launchExtractBrowser } = await import('./capture-page-screenshot')
  return launchExtractBrowser()
}

const PREFERRED_PATH_RE =
  /pric|product|feature|platform|solution|resource|about|customer|stor|case|testimonial|how-it-works|blog|learn/i

const COLLECT_PAGE_STILL_TARGETS = (): PageStillTargets => {
  const sel =
    'header, [role="banner"], main, [role="main"], section, article, footer, [role="contentinfo"]'
  const nodes = [...document.querySelectorAll(sel)]
  const boxes: SectionBox[] = []
  for (const el of nodes) {
    const r = el.getBoundingClientRect()
    const heading = (el.querySelector('h1, h2, h3')?.textContent ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80)
    const named = heading || el.id.trim() || (el.getAttribute('aria-label') ?? '').trim()
    const box: SectionBox = {
      x: Math.max(0, Math.round(r.left + window.scrollX)),
      y: Math.max(0, Math.round(r.top + window.scrollY)),
      width: Math.round(r.width),
      height: Math.round(r.height),
      label: named || el.tagName.toLowerCase(),
      heading: named || undefined,
    }
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
    const media = el.querySelectorAll('img, video, svg, canvas').length
    if (text.length < 40 && media === 0) continue
    boxes.push(box)
  }

  const hrefs: string[] = []
  const linkRoots = document.querySelectorAll(
    'nav, header, footer, [role="navigation"], [role="banner"], [role="contentinfo"]',
  )
  for (const root of linkRoots) {
    for (const a of root.querySelectorAll('a[href]')) {
      const href = (a as HTMLAnchorElement).href
      if (href) hrefs.push(href)
    }
  }
  return { boxes, hrefs }
}

/** Best-effort public cookie banner — do not fail the job if nothing matches. */
const DISMISS_COOKIE_BANNER = async (): Promise<void> => {
  const buttons = [...document.querySelectorAll('button, [role="button"], a')]
  const match = buttons.find((el) =>
    /^(accept all|accept|agree|i agree|got it|allow all|allow cookies)$/i.test(
      (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
    ),
  )
  if (match instanceof HTMLElement) match.click()
  await new Promise<void>((resolve) => {
    window.setTimeout(() => resolve(), 250)
  })
}

const MEASURE_PAGE_HEIGHT = (): number =>
  Math.max(
    document.documentElement.scrollHeight,
    document.body?.scrollHeight ?? 0,
    document.scrollingElement?.scrollHeight ?? 0,
  )

const SCROLL_TO_Y = async (y: number): Promise<number> => {
  // Inline the delay — Playwright evaluate cannot close over module helpers.
  const root = document.scrollingElement ?? document.documentElement
  root.scrollTop = y
  window.scrollTo(0, y)
  await new Promise<void>((resolve) => {
    window.setTimeout(() => resolve(), 250)
  })
  return window.scrollY || root.scrollTop || 0
}

const similarBox = (a: SectionBox, b: SectionBox): boolean =>
  Math.abs(a.y - b.y) < 48 && Math.abs(a.height - b.height) < 48 && Math.abs(a.x - b.x) < 48

/**
 * First-fold boxes (including a tall hero `<section>` that starts in the viewport)
 * are already covered by the hero still — do not clip or re-shoot them.
 */
export const overlapsHeroViewport = (box: SectionBox, viewportHeight: number): boolean => {
  const top = Math.max(0, box.y)
  const bottom = box.y + box.height
  const overlap = Math.min(bottom, viewportHeight) - Math.max(top, 0)
  if (overlap <= 0) return false
  return overlap >= viewportHeight * 0.45 || top < viewportHeight * 0.15
}

export const rankSectionBoxes = (
  boxes: SectionBox[],
  options?: { max?: number; viewportHeight?: number },
): SectionBox[] => {
  const max = options?.max ?? EXTRACT_STILLS_PER_URL_MAX - 1
  const viewportHeight = options?.viewportHeight ?? EXTRACT_SCREENSHOT_VIEWPORT.height
  const kept: SectionBox[] = []
  for (const box of boxes) {
    if (box.width < EXTRACT_STILL_MIN_WIDTH) continue
    if (box.height < EXTRACT_STILL_MIN_HEIGHT) continue
    if (box.height / box.width > EXTRACT_STILL_MAX_ASPECT) continue
    if (overlapsHeroViewport(box, viewportHeight)) continue
    if (kept.some((existing) => similarBox(existing, box))) continue
    kept.push(box)
    if (kept.length >= max) break
  }
  return kept
}

export const EXTRACT_FOLD_STEP_RATIO = 0.8

/**
 * Scroll Y offsets after the hero (y=0). Driven by page height, not section tags —
 * wrapping `<main>` / div landings still get later folds.
 */
export const foldScrollYs = (
  pageHeight: number,
  viewportHeight: number,
  max = EXTRACT_STILLS_PER_URL_MAX - 1,
): number[] => {
  if (pageHeight <= viewportHeight + 80) return []
  const step = Math.max(1, Math.round(viewportHeight * EXTRACT_FOLD_STEP_RATIO))
  const lastStart = pageHeight - viewportHeight
  const ys: number[] = []
  for (let y = step; y < lastStart && ys.length < max; y += step) {
    ys.push(y)
  }
  if (ys.length < max && lastStart >= viewportHeight * 0.4) {
    const last = Math.max(0, lastStart)
    if (!ys.some((y) => Math.abs(y - last) < viewportHeight * 0.35)) {
      ys.push(last)
    }
  }
  return ys.slice(0, max)
}

const pathKey = (url: URL): string => (url.pathname.replace(/\/$/, '') || '/') + url.search

const sameSiteHost = (a: URL, b: URL): boolean =>
  a.hostname.replace(/^www\./, '') === b.hostname.replace(/^www\./, '')

const pathScore = (pathname: string): number => {
  if (/pric/i.test(pathname)) return 0
  if (PREFERRED_PATH_RE.test(pathname)) return 1
  return 2
}

/**
 * Same-site public nav/footer links to fill leftover still slots.
 * Skips the start URL, auth walls, other hosts, and non-http schemes.
 */
export const rankDiscoverLinks = (
  hrefs: string[],
  startUrl: string,
  max = EXTRACT_STILLS_PER_URL_MAX - 1,
): string[] => {
  let start: URL
  try {
    start = new URL(startUrl)
  } catch {
    return []
  }
  const startKey = pathKey(start)
  const seen = new Set<string>([startKey])
  const candidates: { href: string; score: number; index: number }[] = []

  for (const [index, raw] of hrefs.entries()) {
    let url: URL
    try {
      url = new URL(raw, start)
    } catch {
      continue
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue
    if (!sameSiteHost(url, start)) continue
    if (isAuthWall(start.toString(), url.toString())) continue
    if (/\.(pdf|zip|dmg|docx?)($|\?)/i.test(url.pathname)) continue
    url.hash = ''
    const key = pathKey(url)
    if (seen.has(key)) continue
    seen.add(key)
    candidates.push({ href: url.toString(), score: pathScore(url.pathname), index })
  }

  return candidates
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, max)
    .map((item) => item.href)
}

const stillNote = (label: string, heading?: string): string => {
  if (label === 'hero') return 'Hero (above the fold)'
  if (heading) return heading
  if (label === 'header' || label === 'banner') return 'Header'
  if (label === 'footer' || label === 'contentinfo') return 'Footer'
  if (label === 'main') return 'Main'
  if (label.startsWith('/')) return `Page: ${label}`
  return `Section: ${label}`
}

const screenshotViewport = async (
  page: Page,
  timeoutMs: number,
  maxBytes: number,
): Promise<Buffer> => {
  const png = Buffer.from(
    await page.screenshot({
      type: 'png',
      fullPage: false,
      timeout: timeoutMs,
    }),
  )
  if (png.byteLength > maxBytes) {
    throw new UnsafeUrlError(`Screenshot exceeded ${maxBytes} bytes`)
  }
  if (png.byteLength < 64) {
    throw new Error('Screenshot capture produced an empty image')
  }
  return png
}

const dismissCookieBanner = async (page: Page): Promise<void> => {
  try {
    await page.evaluate(DISMISS_COOKIE_BANNER)
  } catch {
    // Banner click is best-effort.
  }
}

const parseStillTargets = (raw: unknown): PageStillTargets => {
  if (raw && typeof raw === 'object' && 'boxes' in raw) {
    const value = raw as PageStillTargets
    return {
      boxes: Array.isArray(value.boxes) ? value.boxes : [],
      hrefs: Array.isArray(value.hrefs) ? value.hrefs : [],
    }
  }
  if (Array.isArray(raw)) {
    return { boxes: raw as SectionBox[], hrefs: [] }
  }
  return { boxes: [], hrefs: [] }
}

const slugLabel = (label: string): string =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'still'

const scrollPageTo = async (page: Page, y: number): Promise<number> => {
  let actual = Number(await page.evaluate(SCROLL_TO_Y, y))
  if (Number.isNaN(actual)) actual = 0
  if (Math.abs(actual - y) <= 80) return actual
  try {
    await page.mouse.wheel(0, y - actual)
    actual = Number(await page.evaluate(SCROLL_TO_Y, y))
  } catch {
    // Wheel is a fallback when window.scrollTo is a no-op.
  }
  return Number.isNaN(actual) ? 0 : actual
}

const expandPageHeight = async (page: Page): Promise<number> => {
  let height = Number(await page.evaluate(MEASURE_PAGE_HEIGHT))
  if (Number.isNaN(height)) height = 0
  for (let i = 0; i < 8; i += 1) {
    await scrollPageTo(page, height)
    const next = Number(await page.evaluate(MEASURE_PAGE_HEIGHT))
    if (!Number.isFinite(next) || next <= height + 40) break
    height = next
  }
  await scrollPageTo(page, 0)
  const measured = Number(await page.evaluate(MEASURE_PAGE_HEIGHT))
  return Number.isFinite(measured) ? measured : height
}

/**
 * Viewport hero, then scrolled page folds, then same-site nav/footer pages
 * until 10 stills. Never a single full-page strip (ADR-0089 / #1029 / #1369).
 */
export const capturePageStills = async (input: {
  url: string
  lookup?: HostLookup
  launchBrowser?: LaunchBrowser
  timeoutMs?: number
  maxBytes?: number
  maxStills?: number
}): Promise<{ finalUrl: string; stills: PageStill[] }> => {
  const timeoutMs = input.timeoutMs ?? EXTRACT_SCREENSHOT_TIMEOUT_MS
  const maxBytes = input.maxBytes ?? EXTRACT_SCREENSHOT_MAX_BYTES
  const maxStills = input.maxStills ?? EXTRACT_STILLS_PER_URL_MAX
  const safeStart = await assertSafeFetchUrl(input.url, { lookup: input.lookup })

  const launch = input.launchBrowser ?? defaultLaunchBrowser
  const browser: Browser = await launch()
  try {
    const page = await browser.newPage({
      viewport: EXTRACT_SCREENSHOT_VIEWPORT,
      deviceScaleFactor: 1,
    })
    page.setDefaultTimeout(timeoutMs)

    const response = await page.goto(safeStart.toString(), {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs,
    })
    if (!response) {
      throw new UnsafeUrlError('Screenshot navigation returned no response')
    }

    const finalUrl = await assertSafeFetchUrl(page.url(), { lookup: input.lookup })
    if (isAuthWall(input.url, finalUrl.toString())) {
      return { finalUrl: finalUrl.toString(), stills: [] }
    }

    const stills: PageStill[] = []
    await page
      .waitForLoadState('networkidle', { timeout: Math.min(8_000, timeoutMs) })
      .catch(() => undefined)
    await dismissCookieBanner(page)

    const heroPng = await screenshotViewport(page, timeoutMs, maxBytes)
    stills.push({
      png: heroPng,
      label: 'hero',
      note: stillNote('hero'),
      sourceUrl: finalUrl.toString(),
    })

    const targets = parseStillTargets(await page.evaluate(COLLECT_PAGE_STILL_TARGETS))
    const pageHeight = await expandPageHeight(page)
    const folds = foldScrollYs(
      pageHeight,
      EXTRACT_SCREENSHOT_VIEWPORT.height,
      maxStills - stills.length,
    )

    for (const [index, y] of folds.entries()) {
      if (stills.length >= maxStills) break
      try {
        const actual = await scrollPageTo(page, y)
        if (actual < y - 80) break
        const png = await screenshotViewport(page, timeoutMs, maxBytes)
        const nearby = targets.boxes.find(
          (box) => box.y >= y - 40 && box.y < y + EXTRACT_SCREENSHOT_VIEWPORT.height * 0.6,
        )
        const foldLabel = nearby?.heading || nearby?.label || `fold-${index + 2}`
        stills.push({
          png,
          label: slugLabel(foldLabel),
          note: nearby?.heading ?? `Scrolled section ${index + 2}`,
          sourceUrl: finalUrl.toString(),
        })
      } catch (scrollError) {
        console.warn(
          `[capture-page-stills] Scroll ${y} skipped:`,
          scrollError instanceof Error ? scrollError.message : scrollError,
        )
      }
    }

    const leftover = maxStills - stills.length
    const discover =
      leftover > 0 ? rankDiscoverLinks(targets.hrefs, finalUrl.toString(), leftover) : []

    for (const href of discover) {
      if (stills.length >= maxStills) break
      try {
        const safe = await assertSafeFetchUrl(href, { lookup: input.lookup })
        const next = await page.goto(safe.toString(), {
          waitUntil: 'domcontentloaded',
          timeout: timeoutMs,
        })
        if (!next) continue
        const landed = await assertSafeFetchUrl(page.url(), { lookup: input.lookup })
        if (isAuthWall(finalUrl.toString(), landed.toString())) continue
        await dismissCookieBanner(page)
        const png = await screenshotViewport(page, timeoutMs, maxBytes)
        const path = new URL(landed.toString()).pathname.replace(/\/$/, '') || '/'
        stills.push({
          png,
          label: slugLabel(path),
          note: stillNote(path),
          sourceUrl: landed.toString(),
        })
      } catch (visitError) {
        console.warn(
          `[capture-page-stills] Discover ${href} skipped:`,
          visitError instanceof Error ? visitError.message : visitError,
        )
      }
    }

    return { finalUrl: finalUrl.toString(), stills }
  } finally {
    await browser.close().catch(() => undefined)
  }
}
