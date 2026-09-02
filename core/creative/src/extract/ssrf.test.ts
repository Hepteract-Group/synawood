import { describe, expect, it } from 'vitest'
import { assertSafeFetchUrl, isPrivateOrReservedIp, UnsafeUrlError } from './ssrf'
import { adaptUrlSource, parseHtmlDigest } from './url-adapter'
import type { FetchLike } from './url-adapter'

const FIXTURE_HTML = `<!doctype html>
<html>
<head>
  <title>the private example — focus PDF reader</title>
  <meta name="description" content="Read PDFs without the clutter." />
  <meta property="og:image" content="/og.png" />
  <meta name="theme-color" content="#1a5c3a" />
  <link rel="icon" href="/favicon.ico" />
</head>
<body>
  <h1>Stop drowning in PDFs</h1>
  <p>the private example helps founders read smarter. #c45c26 accent.</p>
</body>
</html>`

describe('isPrivateOrReservedIp', () => {
  it('blocks loopback, RFC1918, link-local, and CGNAT', () => {
    expect(isPrivateOrReservedIp('127.0.0.1')).toBe(true)
    expect(isPrivateOrReservedIp('10.0.0.5')).toBe(true)
    expect(isPrivateOrReservedIp('192.168.1.1')).toBe(true)
    expect(isPrivateOrReservedIp('172.16.0.1')).toBe(true)
    expect(isPrivateOrReservedIp('169.254.1.1')).toBe(true)
    expect(isPrivateOrReservedIp('100.64.1.1')).toBe(true)
    expect(isPrivateOrReservedIp('::1')).toBe(true)
  })

  it('allows public addresses', () => {
    expect(isPrivateOrReservedIp('8.8.8.8')).toBe(false)
    expect(isPrivateOrReservedIp('1.1.1.1')).toBe(false)
  })
})

describe('assertSafeFetchUrl', () => {
  it('rejects non-http(s) and localhost', async () => {
    await expect(assertSafeFetchUrl('file:///etc/passwd')).rejects.toBeInstanceOf(UnsafeUrlError)
    await expect(assertSafeFetchUrl('http://localhost/x')).rejects.toBeInstanceOf(UnsafeUrlError)
    await expect(assertSafeFetchUrl('http://127.0.0.1/x')).rejects.toBeInstanceOf(UnsafeUrlError)
  })

  it('rejects hostnames that resolve to private IPs', async () => {
    await expect(
      assertSafeFetchUrl('https://evil.example', {
        lookup: async () => [{ address: '10.0.0.9', family: 4 }],
      }),
    ).rejects.toBeInstanceOf(UnsafeUrlError)
  })

  it('allows https hosts that resolve publicly', async () => {
    const url = await assertSafeFetchUrl('https://example.com/path', {
      lookup: async () => [{ address: '93.184.216.34', family: 4 }],
    })
    expect(url.hostname).toBe('example.com')
  })
})

describe('parseHtmlDigest', () => {
  it('extracts title, description, images, colors, and body text', () => {
    const digest = parseHtmlDigest(FIXTURE_HTML, new URL('https://example.com/'))
    expect(digest.title).toMatch(/the private example/)
    expect(digest.description).toMatch(/clutter/)
    expect(digest.imageCandidates.some((item) => item.role === 'og')).toBe(true)
    expect(digest.imageCandidates[0]?.url).toBe('https://example.com/og.png')
    expect(digest.colorGuesses).toContain('#1a5c3a')
    expect(digest.textDigest).toMatch(/Stop drowning/)
  })
})

describe('adaptUrlSource', () => {
  it('fetches via injectable fetch and returns a url digest', async () => {
    const fetchImpl: FetchLike = async () =>
      new Response(FIXTURE_HTML, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
        // Response.url is set by fetch; construct manually via object
      })

    // Response from `new Response` has empty url — wrap
    const fetchWithUrl: FetchLike = async (input) => {
      const res = await fetchImpl(input)
      Object.defineProperty(res, 'url', { value: String(input) })
      return res
    }

    const digest = await adaptUrlSource({
      url: 'https://example.com/',
      fetchImpl: fetchWithUrl,
      lookup: async () => [{ address: '93.184.216.34', family: 4 }],
      now: () => new Date('2026-08-02T12:00:00.000Z'),
    })

    expect(digest.kind).toBe('url')
    expect(digest.title).toMatch(/the private example/)
    expect(digest.bytesRead).toBeGreaterThan(100)
    expect(digest.fetchedAt).toBe('2026-08-02T12:00:00.000Z')
  })

  it('rejects oversized bodies', async () => {
    const big = 'x'.repeat(2000)
    const fetchImpl: FetchLike = async (input) => {
      const res = new Response(big, { status: 200 })
      Object.defineProperty(res, 'url', { value: String(input) })
      return res
    }
    await expect(
      adaptUrlSource({
        url: 'https://example.com/',
        fetchImpl,
        lookup: async () => [{ address: '93.184.216.34', family: 4 }],
        maxBytes: 100,
      }),
    ).rejects.toBeInstanceOf(UnsafeUrlError)
  })
})
