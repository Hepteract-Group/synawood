import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = join(process.cwd(), '..')
const read = (rel: string) => readFileSync(join(repoRoot, rel), 'utf8')

describe('installable skills + inbound MCP ADRs (#961)', () => {
  it('accepts ADR-0080 with Product vs Account scope and skills.sh as a source', () => {
    const adr = read('docs/adr/0080-installable-studio-skills.md')
    const skillsArch = read('docs/architecture/marketing-skills.md')
    expect(adr).toMatch(/^# ADR-0080/)
    expect(adr).toMatch(/\*\*Status:\*\*\s*accepted/)
    expect(adr).toMatch(/Product/)
    expect(adr).toMatch(/Account/)
    expect(adr).toMatch(/skills\.sh/)
    expect(adr).toMatch(/selectMarketingSkills/)
    expect(adr).toMatch(/Hosted SaaS/)
    expect(adr).toMatch(/refuse the install/)
    expect(adr).toMatch(/First-party `core\/marketing-skills\//)
    expect(adr).toMatch(/Enabled Product-scoped/)
    expect(adr).toMatch(/Enabled Account-scoped/)
    expect(skillsArch).toMatch(/Installable skills \(ADR-0080\)/)
    expect(skillsArch).toMatch(/selectMarketingSkills/)
  })

  it('accepts ADR-0081 with inbound vs outbound doors and first-party /api/v1', () => {
    const adr = read('docs/adr/0081-inbound-mcp-tools.md')
    const mcpArch = read('docs/architecture/mcp-surface.md')
    const toolsArch = read('docs/architecture/studio-tools.md')
    const harnessArch = read('docs/architecture/agent-harness.md')
    expect(adr).toMatch(/^# ADR-0081/)
    expect(adr).toMatch(/\*\*Status:\*\*\s*accepted/)
    expect(adr).toMatch(/Inbound/)
    expect(adr).toMatch(/Outbound/)
    expect(adr).toMatch(/\/api\/v1/)
    expect(adr).toMatch(/does not proxy customer MCP/i)
    expect(adr).toMatch(/HTTPS/)
    expect(adr).toMatch(/Hosted SaaS/)
    expect(mcpArch).toMatch(/ADR-0081/)
    expect(mcpArch).toMatch(/HTTPS/)
    expect(toolsArch).toMatch(/ADR-0081/)
    expect(harnessArch).toMatch(/ADR-0081/)
    expect(harnessArch).toMatch(/ADR-0080/)
  })

  it('keeps CONTEXT glossary aligned: installable skills vs inbound MCP tools', () => {
    const context = read('CONTEXT.md')
    expect(context).toMatch(/inbound MCP/)
    expect(context).toMatch(/ADR-0081/)
    expect(context).toMatch(/ADR-0080/)
    expect(context).toMatch(/install/)
  })

  it('amends harness, skills, public API, and marketplace ADRs without collapsing MCP doors', () => {
    const harness = read('docs/adr/0001-studio-agent-harness.md')
    const skills = read('docs/adr/0008-marketing-skills-for-studio.md')
    const api = read('docs/adr/0038-public-api-v1.md')
    const marketplace = read('docs/adr/0039-agent-marketplace.md')
    expect(harness).toMatch(/ADR-0081/)
    expect(harness).toMatch(/Inbound/)
    expect(skills).toMatch(/ADR-0080/)
    expect(api).toMatch(/ADR-0081/)
    expect(api).toMatch(/first-party/)
    expect(marketplace).toMatch(/ADR-0080/)
    expect(marketplace).toMatch(/user_id/)
  })
})
