import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const nav = readFileSync(join(root, 'app/(app)/settings/settings-local-nav.tsx'), 'utf8')
const overview = readFileSync(join(root, 'app/(app)/settings/page.tsx'), 'utf8')
const panel = readFileSync(join(root, 'app/(app)/settings/api/api-keys-panel.tsx'), 'utf8')
const listRoute = readFileSync(join(root, 'app/api/products/[productId]/api-keys/route.ts'), 'utf8')
const revokeRoute = readFileSync(
  join(root, 'app/api/products/[productId]/api-keys/[keyId]/route.ts'),
  'utf8',
)

describe('Settings API keys (#1081)', () => {
  it('puts API on Settings nav and lists keys at /settings/api', () => {
    expect(nav).toContain('/settings/api')
    expect(nav).toContain('API')
    expect(overview).toContain('/settings/api')
    expect(panel).toContain('API_KEY_EMPTY_COPY')
    expect(panel).toContain('API_KEY_OWNER_ONLY_COPY')
    expect(panel).toContain('API_KEY_SECRET_ONCE_COPY')
    expect(panel).toContain('Create key')
  })

  it('creates and revokes as owner over product api-keys routes', () => {
    expect(listRoute).toContain("minRole: 'viewer'")
    expect(listRoute).toContain('createProductApiKey')
    expect(listRoute).toContain('API_KEY_OWNER_ONLY_COPY')
    expect(revokeRoute).toContain('revokeProductApiKey')
    expect(revokeRoute).toContain("minRole: 'owner'")
    expect(panel).toContain('/api/products/')
    expect(panel).toContain('api-keys')
  })
})
