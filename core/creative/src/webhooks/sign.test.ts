import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  hashWebhookSecret,
  signWebhookPayload,
  stringifyJobWebhookPayload,
  verifyWebhookPayload,
} from './sign'

const FIXTURE_SECRET = 'whsec_fixture_test_secret'

describe('webhook payload signatures (#1079)', () => {
  it('signs a canonical body so a fixture secret can verify it', () => {
    const secretHash = hashWebhookSecret(FIXTURE_SECRET)
    const body = stringifyJobWebhookPayload({
      event: 'job.ready',
      productId: 'demo',
      jobKind: 'generation',
      jobId: 'job-1',
      status: 'ready',
    })
    const expected = `sha256=${createHmac('sha256', secretHash).update(body, 'utf8').digest('hex')}`
    const signature = signWebhookPayload(secretHash, body)
    expect(signature).toBe(expected)
    expect(verifyWebhookPayload(secretHash, body, signature)).toBe(true)
    expect(verifyWebhookPayload(secretHash, body, 'sha256=deadbeef')).toBe(false)
  })
})
