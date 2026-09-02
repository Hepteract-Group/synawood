import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const panel = readFileSync(join(root, 'app/(app)/settings/packs/packs-panel.tsx'), 'utf8')
const route = readFileSync(join(root, 'app/api/studio/skills/route.ts'), 'utf8')

describe('Skills catalog (#955)', () => {
  it('shows first-party skills as always-on readable markdown with no script execution', () => {
    expect(panel).toContain('First-party')
    expect(panel).toContain('Locked · cannot be removed')
    expect(panel).toContain('they do not run scripts')
    expect(route).toContain('listFirstPartySkillCatalog')
    expect(route).toContain('alwaysOn: true')
    expect(route).toContain('locked: skill.locked')
  })
})
