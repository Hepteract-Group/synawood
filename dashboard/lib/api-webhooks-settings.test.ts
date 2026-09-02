import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const panel = readFileSync(join(root, 'app/(app)/settings/api/api-webhooks-section.tsx'), 'utf8')
const listRoute = readFileSync(join(root, 'app/api/products/[productId]/webhooks/route.ts'), 'utf8')
const helper = readFileSync(join(root, 'lib/product-webhooks.ts'), 'utf8')

describe('Settings webhooks (#1082)', () => {
  it('adds a Webhooks section on the API page with empty copy and Add webhook', () => {
    expect(panel).toContain('WEBHOOK_EMPTY_COPY')
    expect(panel).toContain('Add webhook')
    expect(panel).toContain('HOSTED_WEBHOOK_LOCALHOST_COPY')
    expect(panel).toContain('lastDeliveryError')
    expect(panel).toContain('failed')
  })

  it('creates and revokes over product webhooks routes and refuses hosted localhost', () => {
    expect(listRoute).toContain('createProductWebhook')
    expect(listRoute).toContain('isHostedRuntime')
    expect(helper).toContain('assertWebhookUrl')
    expect(helper).toContain('HOSTED_WEBHOOK_LOCALHOST_COPY')
  })
})
