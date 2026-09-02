import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const css = readFileSync(join(root, 'app/globals.css'), 'utf8')
const workspace = readFileSync(join(root, 'components/studio/StudioWorkspace.tsx'), 'utf8')
const banners = readFileSync(join(root, 'components/studio/WorkspaceStatusBanners.tsx'), 'utf8')

describe('Studio player chrome (#1255)', () => {
  it('does not put remaining pounds under the player', () => {
    expect(banners).not.toMatch(/left this period/)
    expect(banners).not.toMatch(/is-wallet/)
  })

  it('puts Trial export on the workspace bar before Draft, not on player chrome', () => {
    expect(css).toMatch(/\.studio-trial-chip \{/)
    expect(css).not.toMatch(/\.player-trial-chip/)
    const trialIdx = workspace.indexOf('studio-trial-chip')
    const draftIdx = workspace.indexOf('studio-project-status')
    const playerChrome = workspace.indexOf('player-chrome')
    expect(trialIdx).toBeGreaterThan(0)
    expect(trialIdx).toBeLessThan(draftIdx)
    expect(trialIdx).toBeLessThan(playerChrome)
    expect(workspace).not.toMatch(/player-trial-chip/)
  })
})
