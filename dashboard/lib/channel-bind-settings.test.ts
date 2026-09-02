import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ADS_POSTIZ_BIND_COPY } from '@synawood/channels/postiz-channel-bind'

const root = process.cwd()
const nav = readFileSync(join(root, 'app/(app)/settings/settings-local-nav.tsx'), 'utf8')
const overview = readFileSync(join(root, 'app/(app)/settings/page.tsx'), 'utf8')
const panel = readFileSync(join(root, 'app/(app)/settings/channels/channel-bind-panel.tsx'), 'utf8')
const route = readFileSync(join(root, 'app/api/studio/channel-integrations/route.ts'), 'utf8')
const ux = readFileSync(join(root, '../docs/ux/schedule-and-publish.md'), 'utf8')

describe('Postiz channel bind settings (#798, #1109)', () => {
  it('puts organic pickers on Settings and rejects ads in the API', () => {
    expect(nav).toContain('/settings/channels')
    expect(overview).toContain('/settings/channels')
    expect(panel).toContain('These channels have no Postiz account')
    expect(panel).toContain('No Postiz accounts connected')
    expect(ADS_POSTIZ_BIND_COPY).toMatch(/Paid ads/)
    expect(ADS_POSTIZ_BIND_COPY).toMatch(/Work board/)
    expect(panel).toContain('{POSTIZ_ORGANIC_SCOPE_NOTE}')
    expect(panel).toContain('Open Postiz')
    expect(panel).toContain('Postiz is not configured')
    expect(panel).toContain('Unbind')
    expect(panel).toContain('Bound to')
    expect(panel).not.toContain('Demo accounts')
    expect(panel).toContain('integrationsForOrganicChannel')
    expect(panel).toContain('/api/studio/channel-integrations')
    expect(panel).not.toContain('google_search_ads')
    expect(route).toContain("minRole: 'editor'")
    expect(route).toContain('isChannelBindError')
    expect(route).toContain('isMissingChannelIntegrationsSchema')
    expect(route).toContain('postizAppUrlFromApiRoot')
    expect(ux).toContain('/settings/channels')
    expect(ux).toContain('Paid ads')
    expect(ux).toContain('Open Postiz')
    expect(ux).toContain('Unbind')
  })
})
