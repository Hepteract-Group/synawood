import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const repo = join(process.cwd(), '..')

const read = (rel: string) => readFileSync(join(repo, rel), 'utf8')

describe('platform identity docs (#898)', () => {
  it('does not teach that Synawood is a the private example app', () => {
    const context = read('CONTEXT.md')
    const agents = read('AGENTS.md')
    const readme = read('README.md')
    const overview = read('docs/system-design/overview.md')
    for (const text of [context, agents, readme, overview]) {
      expect(text).not.toMatch(/First product context:\s*the private example/i)
      expect(text).not.toMatch(/First product:\s*\*\*the private example\*\*/i)
    }
    expect(overview).toMatch(/Example Product/)
    expect(overview).toMatch(/does not ship a marketed product pack/)
    expect(agents).toMatch(/Do not add `products\/demo\/` back/)
    expect(context).toMatch(/does \*\*not\*\* ship a the private example GTM pack/)
  })
})

describe('product name in agent docs (#1333)', () => {
  it('defines Synawood as the system name in CONTEXT.md', () => {
    const context = read('CONTEXT.md')
    expect(context).toMatch(/^# Synawood/m)
    expect(context).toMatch(/\*\*Synawood\*\*:/)
  })

  it('names Synawood in AGENTS.md and the private git slug synawood-os', () => {
    const agents = read('AGENTS.md')
    expect(agents).toMatch(/Working agreement for AI agents on Synawood/)
    expect(agents).toMatch(/\|\s*System\s*\|\s*\*\*Synawood\*\*/)
    expect(agents).toMatch(/Hepteract-Group\/synawood-os/)
    expect(agents).not.toMatch(/\|\s*Repo\s*\|\s*`Hepteract-Group\/marketing-os`/)
    expect(agents).not.toMatch(/\|\s*System\s*\|\s*\*\*Synawood\*\*/)
    expect(read('CONTRIBUTING.md')).toMatch(/Hepteract-Group\/synawood-os/)
    expect(read('package.json')).toMatch(/Hepteract-Group\/synawood-os/)
  })

  it('presents Synawood in README and names synawood as the public repo', () => {
    expect(read('README.md')).toMatch(/^# Synawood/m)
    expect(read('docs/opensource/briefing.md')).toMatch(/Hepteract-Group\/synawood/)
    expect(read('docs/opensource/README.md')).toMatch(/Hepteract-Group\/synawood/)
  })
})
