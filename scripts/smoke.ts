/**
 * Post-deploy / local smoke — no AI spend, does not call Postiz.
 *
 * Usage:
 *   SMOKE_BASE_URL=http://localhost:3000 npm run smoke
 *   SMOKE_BASE_URL=https://… npm run smoke   # post-merge (PROD_BASE_URL secret)
 *
 * Optional live Postiz (Docker localhost:4007) is operator-only — see
 * core/runbooks/postiz-hosting.md. CI uses POSTIZ_ADAPTER=mock and has no key.
 */

import { resolveSmokeBaseUrl, runSmoke } from '../dashboard/lib/post-deploy-smoke.ts'

const main = async () => {
  const baseUrl = resolveSmokeBaseUrl(process.env)
  if (!baseUrl) {
    console.log(
      'SMOKE_BASE_URL / PROD_BASE_URL not set — skipping smoke (configure for post-merge).',
    )
    process.exit(0)
  }

  console.log(`Smoke against ${baseUrl}`)
  const results = await runSmoke(baseUrl)
  let failed = false
  for (const result of results) {
    const mark = result.ok ? 'OK' : 'FAIL'
    console.log(`[${mark}] ${result.name}: ${result.detail}`)
    if (!result.ok) failed = true
  }
  if (failed) {
    console.error('Smoke failed')
    process.exit(1)
  }
  console.log('Smoke passed')
}

void main()
