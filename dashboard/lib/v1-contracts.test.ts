import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  hashWebhookSecret,
  signWebhookPayload,
  stringifyJobWebhookPayload,
  verifyWebhookPayload,
} from '@synawood/creative/webhooks'
import { describe, expect, it } from 'vitest'
import { ProductAccessError } from './product-membership'
import { OPENAPI_V1_PATHS } from './openapi-v1'
import { handleRouteError } from './studio-server'
import { resolveStoredIdempotency } from './v1-idempotency'
import { withApiKey } from './with-api-key'

const root = process.cwd()
const v1Dir = join(root, 'app/api/v1')

const routeFolderToOpenApiPath = (folder: string): string => {
  if (folder === 'health') return '/api/v1/health'
  if (folder === 'projects/[projectId]') return '/api/v1/projects/{projectId}'
  return `/api/v1/${folder}`
}

describe('v1 contracts (#283)', () => {
  it('returns 401 without a Product API key', async () => {
    await expect(withApiKey(new Request('http://localhost/api/v1/health'))).rejects.toMatchObject({
      name: 'ProductAccessError',
      status: 401,
    })
    const response = handleRouteError(
      new ProductAccessError('Send an Authorization Bearer API key.', 401),
      'Invalid API key.',
    )
    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ error: expect.stringMatching(/API key/i) })
  })

  it('keeps OpenAPI paths aligned with first-party route folders', () => {
    const folders = existsSync(v1Dir)
      ? readdirSync(v1Dir, { recursive: true })
          .map((entry) => String(entry).replace(/\\/g, '/'))
          .filter((path) => path.endsWith('/route.ts'))
          .map((path) => path.replace(/\/route\.ts$/, ''))
      : []
    const fromRoutes = folders.map(routeFolderToOpenApiPath).sort()
    expect(fromRoutes).toEqual(OPENAPI_V1_PATHS)
  })

  it('replays the same Idempotency-Key and conflicts on a different body hash', () => {
    const stored = { request_hash: 'abc', status_code: 200, response: { tool: 'add_clip' } }
    expect(resolveStoredIdempotency(stored, 'abc')).toEqual({
      kind: 'replay',
      statusCode: 200,
      responseBody: { tool: 'add_clip' },
    })
    expect(resolveStoredIdempotency(stored, 'different')).toEqual({ kind: 'conflict' })
  })

  it('verifies a fixture webhook signature and never posts to a live customer host in CI', () => {
    const secretHash = hashWebhookSecret('whsec_fixture_test_secret')
    const body = stringifyJobWebhookPayload({
      event: 'job.failed',
      productId: 'demo',
      jobKind: 'generation',
      jobId: 'job-1',
      status: 'failed',
    })
    const signature = signWebhookPayload(secretHash, body)
    expect(verifyWebhookPayload(secretHash, body, signature)).toBe(true)

    const workerTest = readFileSync(
      join(root, '../core/creative/src/webhooks/deliver.test.ts'),
      'utf8',
    )
    expect(workerTest).toContain('post')
    expect(workerTest).toContain('https://example.test/hooks/ready')
    expect(workerTest).not.toMatch(/https?:\/\/(?!example\.test)/)
  })
})
