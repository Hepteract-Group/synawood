import { describe, expect, it } from 'vitest'
import { resolveSmokeBaseUrl, runSmoke } from './post-deploy-smoke'

describe('resolveSmokeBaseUrl', () => {
  it('prefers SMOKE_BASE_URL and trims trailing slash', () => {
    expect(
      resolveSmokeBaseUrl({
        SMOKE_BASE_URL: 'http://localhost:3000/',
        PROD_BASE_URL: 'https://example.com',
      }),
    ).toBe('http://localhost:3000')
  })

  it('falls back to PROD_BASE_URL', () => {
    expect(resolveSmokeBaseUrl({ PROD_BASE_URL: 'https://app.example.com/' })).toBe(
      'https://app.example.com',
    )
  })

  it('returns null when unset', () => {
    expect(resolveSmokeBaseUrl({})).toBeNull()
  })
})

describe('runSmoke', () => {
  it('passes when health, auth gate, and login respond as expected', async () => {
    const called: string[] = []
    const fetchImpl: typeof fetch = async (input, init) => {
      called.push(String(input))
      const url = String(input)
      if (url.endsWith('/api/health')) {
        return new Response(JSON.stringify({ ok: true, checks: { app: 'ok', db: 'ok' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.endsWith('/studio') && init?.redirect === 'manual') {
        return new Response(null, {
          status: 307,
          headers: { location: 'http://localhost:3000/login?next=%2Fstudio' },
        })
      }
      if (url.includes('/api/studio/costs') && init?.redirect === 'manual') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.endsWith('/login')) {
        return new Response('<html>login</html>', { status: 200 })
      }
      if (url === 'http://localhost:3000/' || url.endsWith('localhost:3000/')) {
        return new Response('<html>landing</html>', { status: 200 })
      }
      return new Response('missing', { status: 404 })
    }

    const results = await runSmoke('http://localhost:3000', fetchImpl)
    expect(results.every((r) => r.ok)).toBe(true)
    expect(results.some((r) => r.name === 'api_auth_json')).toBe(true)
    expect(called.every((url) => !/postiz|:4007/i.test(url))).toBe(true)
  })

  it('fails health when db check is not ok', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ ok: false, checks: { app: 'ok', db: 'error' } }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })

    const results = await runSmoke('http://localhost:3000', fetchImpl)
    expect(results.find((r) => r.name === 'health')?.ok).toBe(false)
  })
})
