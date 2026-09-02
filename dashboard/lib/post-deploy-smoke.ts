/**
 * Post-deploy / local smoke helpers — no AI spend.
 * Used by scripts/smoke.ts and unit-tested from the dashboard package.
 */

export type SmokeResult = { name: string; ok: boolean; detail: string }

const trimSlash = (url: string): string => url.replace(/\/$/, '')

export const resolveSmokeBaseUrl = (env: Record<string, string | undefined>): string | null => {
  const raw = env.SMOKE_BASE_URL ?? env.PROD_BASE_URL
  if (!raw?.trim()) return null
  return trimSlash(raw.trim())
}

export const runSmoke = async (
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SmokeResult[]> => {
  const results: SmokeResult[] = []

  {
    const response = await fetchImpl(`${baseUrl}/api/health`)
    const body = (await response.json().catch(() => null)) as {
      ok?: boolean
      checks?: Record<string, string>
      error?: string
    } | null
    const ok = response.ok && body?.ok === true && body.checks?.db === 'ok'
    results.push({
      name: 'health',
      ok,
      detail: ok
        ? `HTTP ${response.status} checks=${JSON.stringify(body?.checks)}`
        : `HTTP ${response.status} body=${JSON.stringify(body)}`,
    })
  }

  {
    const response = await fetchImpl(`${baseUrl}/studio`, { redirect: 'manual' })
    const location = response.headers.get('location') ?? ''
    const redirected =
      (response.status === 307 || response.status === 302 || response.status === 303) &&
      location.includes('/login')
    results.push({
      name: 'auth_gate',
      ok: redirected,
      detail: redirected
        ? `HTTP ${response.status} → ${location}`
        : `expected redirect to /login, got HTTP ${response.status} location=${location || '(none)'}`,
    })
  }

  {
    // API must return JSON 401 — never HTML login (breaks response.json() clients).
    const productId = encodeURIComponent(process.env.SMOKE_PRODUCT_ID?.trim() || 'demo')
    const response = await fetchImpl(`${baseUrl}/api/studio/costs?productId=${productId}`, {
      redirect: 'manual',
    })
    const contentType = response.headers.get('content-type') ?? ''
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    const ok =
      response.status === 401 &&
      contentType.includes('application/json') &&
      typeof body?.error === 'string'
    results.push({
      name: 'api_auth_json',
      ok,
      detail: ok
        ? `HTTP ${response.status} JSON error=${body?.error}`
        : `expected JSON 401, got HTTP ${response.status} content-type=${contentType || '(none)'} body=${JSON.stringify(body)}`,
    })
  }

  {
    const response = await fetchImpl(`${baseUrl}/login`)
    results.push({
      name: 'login_page',
      ok: response.ok,
      detail: `HTTP ${response.status}`,
    })
  }

  {
    const response = await fetchImpl(`${baseUrl}/`, { redirect: 'manual' })
    results.push({
      name: 'marketing_landing',
      ok: response.status === 200,
      detail:
        response.status === 200
          ? `HTTP ${response.status} (public)`
          : `expected HTTP 200 public landing, got ${response.status}`,
    })
  }

  return results
}
