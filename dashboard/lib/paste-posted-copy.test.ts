import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PASTE_URL_ALWAYS_AVAILABLE_HINT } from './paste-posted-copy'

const here = dirname(fileURLToPath(import.meta.url))
const dashboardRoot = join(here, '..')

const readDashboard = (relative: string): string =>
  readFileSync(join(dashboardRoot, relative), 'utf8')

describe('paste URL path (#809)', () => {
  it('documents that paste stays available beside Postiz', () => {
    expect(PASTE_URL_ALWAYS_AVAILABLE_HINT).toMatch(/even if Postiz is connected/)
    expect(PASTE_URL_ALWAYS_AVAILABLE_HINT).toMatch(/Blog, email, and ads/)
  })

  it('keeps PastePostedUrl on Work board, Studio, and failed-card surfaces', () => {
    expect(readDashboard('components/content/WorkSlotDetailModal.tsx')).toContain('PastePostedUrl')
    expect(readDashboard('components/studio/PublishPanel.tsx')).toContain('PastePostedUrl')
    expect(readDashboard('components/content/PublishRecordsBoard.tsx')).toContain('PastePostedUrl')
  })

  it('PATCH posted URL uses recordManualPosted, not the Postiz schedule adapter', () => {
    const route = readDashboard('app/api/studio/publish/[publishId]/route.ts')
    expect(route).toContain('recordManualPosted')
    const patch = route.slice(route.indexOf('export const PATCH'))
    expect(patch).toContain('recordManualPosted')
    expect(patch).not.toContain('createPostizPublishAdapter')
    expect(patch).not.toContain('adapter.schedule')
  })

  it('POST prepare stays on the manual adapter so paste can create a ready row', () => {
    const route = readDashboard('app/api/studio/publish/route.ts')
    expect(route).toContain('createManualPublishAdapter')
    expect(route).not.toContain('createPostizPublishAdapter')
  })

  it('shows Paste URL on the Work board card actions', () => {
    expect(readDashboard('components/content/WorkSlotPublishActions.tsx')).toContain('Paste URL')
    expect(readDashboard('app/(app)/content/page.tsx')).toMatch(/paste a live URL/i)
  })

  it('puts the always-available copy on Work board and Studio publish', () => {
    expect(readDashboard('components/content/WorkSlotDetailModal.tsx')).toContain(
      'PASTE_URL_ALWAYS_AVAILABLE_HINT',
    )
    expect(readDashboard('components/studio/PublishPanel.tsx')).toContain(
      'PASTE_URL_ALWAYS_AVAILABLE_HINT',
    )
    expect(readDashboard('components/content/PublishRecordsBoard.tsx')).toContain(
      'PASTE_URL_ALWAYS_AVAILABLE_HINT',
    )
  })
})
