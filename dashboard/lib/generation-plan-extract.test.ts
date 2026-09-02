import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const route = readFileSync(
  join(root, 'app/api/studio/projects/[projectId]/generation-plan/route.ts'),
  'utf8',
)
const modal = readFileSync(join(root, 'components/studio/GenerationPlanModal.tsx'), 'utf8')
const banners = readFileSync(join(root, 'components/studio/WorkspaceStatusBanners.tsx'), 'utf8')

describe('generation plan extract fields (#1099 / #1100)', () => {
  it('round-trips extraExtractUrls and reExtractThisTurn on PATCH', () => {
    expect(route).toMatch(/extraExtractUrls/)
    expect(route).toMatch(/reExtractThisTurn/)
  })

  it('enqueues product extract on confirm when Re-extract or extra URLs are set', () => {
    expect(route).toMatch(/enqueueExtractOnPlanConfirm/)
    expect(route).not.toMatch(/enqueueExtractJob/)
  })

  it('raises the shown estimate when Re-extract is on or extra URLs are listed', () => {
    expect(modal).toMatch(/extractCostForPlanGbp/)
    expect(modal).toMatch(/displayCostGbp/)
    expect(modal).toMatch(/existingSourceUrls/)
    expect(modal).toMatch(/Includes extract crawl/)
  })

  it('uses Dialogue or Voiceover, never Script, on the modal and plan banner', () => {
    expect(modal).toMatch(/Dialogue/)
    expect(modal).toMatch(/Voiceover/)
    expect(modal).not.toMatch(/\bScript\b/)
    expect(banners).not.toMatch(/\bScript\b/)
  })
})
