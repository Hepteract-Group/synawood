import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const repo = join(process.cwd(), '..')
const read = (name: string) => readFileSync(join(repo, name), 'utf8')

describe('public legal files (#905)', () => {
  it('ships Apache-2.0 LICENSE and NOTICE that exclude Product kits', () => {
    const license = read('LICENSE')
    const notice = read('NOTICE')
    expect(license).toMatch(/Apache License/)
    expect(license).toMatch(/Version 2\.0/)
    expect(license).toMatch(/Copyright 2026 Hepteract Group/)
    expect(notice).toMatch(/Apache License 2\.0/)
    expect(notice).toMatch(/products\//)
    expect(notice).toMatch(/not licensed for\s+public use/i)
  })

  it('points security reports at a private contact', () => {
    const security = read('SECURITY.md')
    expect(security).toMatch(/security@hepteract\.group/)
    expect(security).toMatch(/Do not open a public GitHub issue/)
  })

  it('keeps contributions on the private repo until Path B', () => {
    const contributing = read('CONTRIBUTING.md')
    expect(contributing).toMatch(/private/)
    expect(contributing).toMatch(/read-mostly mirror/)
    expect(contributing).toMatch(/Hepteract-Group\/synawood-os/)
    expect(contributing).toMatch(/formerly `marketing-os`/)
  })

  it('names founder BDFL and ADRs as the change mechanism', () => {
    const governance = read('GOVERNANCE.md')
    expect(governance).toMatch(/BDFL/)
    expect(governance).toMatch(/docs\/adr/)
    expect(governance).toMatch(/ADR-0079/)
  })
})
