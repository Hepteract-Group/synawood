import { describe, expect, it, vi } from 'vitest'
import { UnsafeUrlError } from './ssrf'
import {
  EXTRACT_SCREENSHOT_MAX_BYTES,
  PLAYWRIGHT_INSTALL_HINT,
  capturePageScreenshot,
  launchExtractBrowser,
} from './capture-page-screenshot'

describe('capturePageScreenshot', () => {
  it('rejects private URLs before launching a browser', async () => {
    const launchBrowser = vi.fn()
    await expect(
      capturePageScreenshot({
        url: 'http://127.0.0.1/',
        launchBrowser: launchBrowser as never,
      }),
    ).rejects.toBeInstanceOf(UnsafeUrlError)
    expect(launchBrowser).not.toHaveBeenCalled()
  })

  it('captures a PNG after SSRF-safe navigation', async () => {
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, ...Buffer.alloc(120, 1)])
    const close = vi.fn(async () => undefined)
    const screenshot = vi.fn(async () => png)
    const goto = vi.fn(async () => ({ ok: () => true }))
    const page = {
      setDefaultTimeout: vi.fn(),
      goto,
      url: () => 'https://example.com/final',
      screenshot,
    }
    const browser = {
      newPage: vi.fn(async () => page),
      close,
    }

    const result = await capturePageScreenshot({
      url: 'https://example.com/',
      lookup: async () => [{ address: '93.184.216.34', family: 4 }],
      launchBrowser: async () => browser as never,
    })

    expect(result.png.equals(png)).toBe(true)
    expect(result.finalUrl).toBe('https://example.com/final')
    expect(goto).toHaveBeenCalled()
    expect(close).toHaveBeenCalled()
  })

  it('falls back to a viewport still when the full-page PNG is over the byte cap', async () => {
    const huge = Buffer.alloc(EXTRACT_SCREENSHOT_MAX_BYTES + 10, 1)
    const viewport = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, ...Buffer.alloc(120, 2)])
    const screenshot = vi.fn(async (opts: { fullPage?: boolean }) =>
      opts.fullPage ? huge : viewport,
    )
    const page = {
      setDefaultTimeout: vi.fn(),
      goto: vi.fn(async () => ({ ok: () => true })),
      url: () => 'https://example.com/',
      screenshot,
    }
    const result = await capturePageScreenshot({
      url: 'https://example.com/',
      lookup: async () => [{ address: '93.184.216.34', family: 4 }],
      launchBrowser: async () =>
        ({ newPage: vi.fn(async () => page), close: vi.fn(async () => undefined) }) as never,
    })
    expect(result.png.equals(viewport)).toBe(true)
    expect(screenshot).toHaveBeenCalledTimes(2)
  })
})

describe('launchExtractBrowser — bundled Chromium, then system Chrome', () => {
  it('uses bundled Chromium when it launches', async () => {
    const browser = { close: vi.fn() }
    const launch = vi.fn(async () => browser)
    await expect(launchExtractBrowser(launch as never)).resolves.toBe(browser)
    expect(launch).toHaveBeenCalledTimes(1)
    expect(launch).toHaveBeenCalledWith(expect.not.objectContaining({ channel: 'chrome' }))
  })

  it('falls back to system Chrome when bundled Chromium is missing', async () => {
    const browser = { close: vi.fn() }
    const launch = vi.fn(async (options: { channel?: string }) => {
      if (options.channel === 'chrome') return browser
      throw new Error(
        "browserType.launch: Executable doesn't exist at /tmp/chromium_headless_shell",
      )
    })
    await expect(launchExtractBrowser(launch as never)).resolves.toBe(browser)
    expect(launch).toHaveBeenCalledTimes(2)
    expect(launch).toHaveBeenLastCalledWith(expect.objectContaining({ channel: 'chrome' }))
  })

  it('tells the operator to install Playwright when Chrome is missing too', async () => {
    const launch = vi.fn(async () => {
      throw new Error("browserType.launch: Executable doesn't exist at /tmp/missing")
    })
    await expect(launchExtractBrowser(launch as never)).rejects.toMatchObject({
      message: PLAYWRIGHT_INSTALL_HINT,
      cause: expect.objectContaining({
        message: expect.stringMatching(/Executable doesn't exist/),
      }),
    })
  })
})
