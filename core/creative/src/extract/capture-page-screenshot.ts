import type { Browser, LaunchOptions } from 'playwright'
import { assertSafeFetchUrl, type HostLookup, UnsafeUrlError } from './ssrf'

export const EXTRACT_SCREENSHOT_TIMEOUT_MS = 20_000
export const EXTRACT_SCREENSHOT_MAX_BYTES = 2_500_000
export const EXTRACT_SCREENSHOT_VIEWPORT = { width: 1280, height: 720 } as const

export const PLAYWRIGHT_INSTALL_HINT =
  'Playwright Chromium is not installed. In the repo root run: npx playwright install chromium'

export type CapturePageScreenshotResult = {
  png: Buffer
  finalUrl: string
  bytes: number
}

export type LaunchBrowser = () => Promise<Browser>

export type ChromiumLaunch = (options: LaunchOptions) => Promise<Browser>

const EXTRACT_BROWSER_ARGS = ['--disable-dev-shm-usage', '--no-sandbox']

const isMissingBrowserExecutable = (error: unknown): boolean =>
  /Executable doesn't exist/i.test(error instanceof Error ? error.message : String(error))

/** Bundled Chromium first; system Chrome if Playwright browsers were never installed. */
export const launchExtractBrowser = async (launchChromium?: ChromiumLaunch): Promise<Browser> => {
  const launch: ChromiumLaunch =
    launchChromium ??
    (async (options) => {
      const { chromium } = await import('playwright')
      return chromium.launch(options)
    })
  try {
    return await launch({ headless: true, args: EXTRACT_BROWSER_ARGS })
  } catch (bundled) {
    if (!isMissingBrowserExecutable(bundled)) throw bundled
    try {
      return await launch({
        headless: true,
        channel: 'chrome',
        args: EXTRACT_BROWSER_ARGS,
      })
    } catch (chromeErr) {
      throw new Error(PLAYWRIGHT_INSTALL_HINT, { cause: chromeErr })
    }
  }
}

const defaultLaunchBrowser: LaunchBrowser = () => launchExtractBrowser()

/**
 * Full-page PNG via Playwright. SSRF-gated before navigate and after redirects (ADR-0028).
 */
export const capturePageScreenshot = async (input: {
  url: string
  lookup?: HostLookup
  launchBrowser?: LaunchBrowser
  timeoutMs?: number
  maxBytes?: number
}): Promise<CapturePageScreenshotResult> => {
  const timeoutMs = input.timeoutMs ?? EXTRACT_SCREENSHOT_TIMEOUT_MS
  const maxBytes = input.maxBytes ?? EXTRACT_SCREENSHOT_MAX_BYTES
  const safeStart = await assertSafeFetchUrl(input.url, { lookup: input.lookup })

  const launch = input.launchBrowser ?? defaultLaunchBrowser
  const browser = await launch()
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
    const pngFull = Buffer.from(
      await page.screenshot({
        type: 'png',
        fullPage: true,
        timeout: timeoutMs,
      }),
    )
    const png =
      pngFull.byteLength > maxBytes
        ? Buffer.from(
            await page.screenshot({
              type: 'png',
              fullPage: false,
              timeout: timeoutMs,
            }),
          )
        : pngFull
    if (png.byteLength > maxBytes) {
      throw new UnsafeUrlError(`Screenshot exceeded ${maxBytes} bytes`)
    }
    if (png.byteLength < 64) {
      throw new Error('Screenshot capture produced an empty image')
    }

    return {
      png,
      finalUrl: finalUrl.toString(),
      bytes: png.byteLength,
    }
  } finally {
    await browser.close().catch(() => undefined)
  }
}
