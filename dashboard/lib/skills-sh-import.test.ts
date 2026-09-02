import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const panel = readFileSync(join(process.cwd(), 'app/(app)/settings/packs/packs-panel.tsx'), 'utf8')
const route = readFileSync(
  join(process.cwd(), 'app/api/studio/packs/from-skills-sh/route.ts'),
  'utf8',
)

describe('skills.sh install (#956)', () => {
  it('exposes a Settings paste field and a server-side import route', () => {
    expect(panel).toContain('Install from skills.sh')
    expect(panel).toContain('no npx')
    expect(panel).toContain('/api/studio/packs/from-skills-sh')
    expect(route).toContain('importSkillFromSkillsSh')
    expect(route).toContain("runtime = 'nodejs'")
  })
})
