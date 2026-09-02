import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  API_KEY_EMPTY_COPY,
  WEBHOOK_EMPTY_COPY,
  webhookFailedDeliveryCopy,
} from './api-console-copy'

const root = process.cwd()
const keysPanel = readFileSync(join(root, 'app/(app)/settings/api/api-keys-panel.tsx'), 'utf8')
const hooksPanel = readFileSync(
  join(root, 'app/(app)/settings/api/api-webhooks-section.tsx'),
  'utf8',
)

describe('API console empty and failed-delivery states (#1083)', () => {
  it('shows empty keys copy with Create key', () => {
    expect(API_KEY_EMPTY_COPY).toBe('No API keys yet.')
    expect(keysPanel).toContain('API_KEY_EMPTY_COPY')
    expect(keysPanel).toContain('Create key')
  })

  it('shows empty webhooks copy and failed delivery as a sentence', () => {
    expect(WEBHOOK_EMPTY_COPY).toBe('No webhooks yet.')
    expect(hooksPanel).toContain('WEBHOOK_EMPTY_COPY')
    expect(hooksPanel).toContain('webhookFailedDeliveryCopy')
    expect(webhookFailedDeliveryCopy('HTTP 500')).toBe('failed — HTTP 500')
    expect(hooksPanel).not.toMatch(/className="[^"]*pill[^"]*"/)
  })
})
