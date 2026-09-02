import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, afterEach } from 'vitest'
import { buildPublicTree, PUBLIC_DENYLIST } from './oss-public-tree'

const dirs: string[] = []
const tmp = () => {
  const dir = mkdtempSync(join(tmpdir(), 'oss-public-'))
  dirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('oss public tree (#904)', () => {
  it('lists the minimum denylist from the ticket', () => {
    expect(PUBLIC_DENYLIST).toEqual(
      expect.arrayContaining([
        'products/demo',
        '.github/workflows/post-merge.yml',
        'thought_dumps',
        'cloud',
        'docs/adr/0082-hosted-billing-wallet-entitlements.md',
        'docs/adr/0083-trial-path-to-first-approve.md',
        'docs/system-design/billing.md',
        'docs/architecture/billing.md',
        'docs/ux/billing.md',
        'docs/ui/billing.md',
        '.cursor',
        'AGENTS.md',
        'core/runbooks/postiz-hosting.md',
        'core/runbooks/weekly-founder-content-batch.md',
        'docs/oss',
        'docs/adr/0094-hosted-studio-workers-on-fly.md',
        'docs/architecture/studio-workers.md',
        'docs/architecture/vercel-deploy.md',
      ]),
    )
  })

  it('deletes denylist paths and strips leftover leaks from a fixture tree', () => {
    const src = tmp()
    mkdirSync(join(src, 'products/demo'), { recursive: true })
    writeFileSync(join(src, 'products/demo/secret.md'), 'the private example ICP')
    mkdirSync(join(src, '.github/workflows'), { recursive: true })
    writeFileSync(join(src, '.github/workflows/post-merge.yml'), 'hosted-vercel-team\n')
    writeFileSync(join(src, '.github/workflows/mr-checks.yml'), 'name: mr-checks\n')
    const legacyScope = ['@', 'mos/creative'].join('')
    writeFileSync(
      join(src, 'README.md'),
      `the private example at example.com ref REDACTED_PROJECT_REF [redacted-db-url] OS and Synawood talk to ${legacyScope}.\n`,
    )
    writeFileSync(join(src, 'clean.md'), 'Demo Product kit\n')
    mkdirSync(join(src, 'docs/system-design'), { recursive: true })
    writeFileSync(join(src, 'docs/system-design/billing.md'), 'Studio £79 hosted catalog\n')
    mkdirSync(join(src, '.cursor/plans'), { recursive: true })
    writeFileSync(join(src, '.cursor/plans/secret.md'), 'private plan\n')
    writeFileSync(join(src, 'AGENTS.md'), 'private agents folklore\n')
    mkdirSync(join(src, 'core/runbooks'), { recursive: true })
    writeFileSync(join(src, 'core/runbooks/postiz-hosting.md'), 'mos-postiz fly secrets\n')
    writeFileSync(join(src, 'core/runbooks/weekly-founder-content-batch.md'), 'founder cadence\n')
    writeFileSync(join(src, 'core/runbooks/approval-chain.md'), 'generic runbook\n')

    const dest = join(tmp(), 'out')
    const result = buildPublicTree({ src, dest })

    expect(existsSync(join(dest, 'docs/system-design/billing.md'))).toBe(false)
    expect(existsSync(join(dest, 'products/demo'))).toBe(false)
    expect(existsSync(join(dest, '.github/workflows/post-merge.yml'))).toBe(false)
    expect(existsSync(join(dest, '.cursor'))).toBe(false)
    expect(existsSync(join(dest, 'AGENTS.md'))).toBe(false)
    expect(existsSync(join(dest, 'core/runbooks/postiz-hosting.md'))).toBe(false)
    expect(existsSync(join(dest, 'core/runbooks/weekly-founder-content-batch.md'))).toBe(false)
    expect(existsSync(join(dest, 'core/runbooks/approval-chain.md'))).toBe(true)
    expect(existsSync(join(dest, '.github/workflows/mr-checks.yml'))).toBe(true)
    expect(readFileSync(join(dest, 'clean.md'), 'utf8')).toBe('Demo Product kit\n')
    const readme = readFileSync(join(dest, 'README.md'), 'utf8')
    expect(readme).not.toMatch(/demo/i)
    expect(readme).not.toMatch(/demoreader/i)
    expect(readme).not.toMatch(/REDACTED_PROJECT_REF/)
    expect(readme).not.toMatch(/postgres:\/\//)
    expect(readme).not.toMatch(/Synawood/i)
    expect(readme).not.toMatch(/\bMOS\b/)
    expect(readme).not.toMatch(new RegExp(['@', 'mos/'].join('')))
    expect(readme).toMatch(/Synawood/)
    expect(result.leaks).toEqual([])
    expect(result.removed).toEqual(
      expect.arrayContaining(['products/demo', '.github/workflows/post-merge.yml']),
    )
  })

  it('reports leaks when a forbidden token survives strip', () => {
    const src = tmp()
    writeFileSync(join(src, 'notes.md'), 'Keep the private example secret\n')
    const dest = join(tmp(), 'out')
    const result = buildPublicTree({ src, dest, strip: false })
    expect(result.leaks.some((leak) => leak.path === 'notes.md')).toBe(true)
  })
})
describe('oss public overlay (#1381)', () => {
  it('overlays docs/oss onto docs and restores a public AGENTS.md', () => {
    const src = tmp()
    writeFileSync(join(src, 'AGENTS.md'), 'private operator folklore\n')
    mkdirSync(join(src, 'docs/system-design'), { recursive: true })
    writeFileSync(join(src, 'docs/system-design/overview.md'), 'private overview with the private example\n')
    mkdirSync(join(src, 'docs/oss/system-design'), { recursive: true })
    writeFileSync(
      join(src, 'docs/oss/AGENTS.md'),
      'Public Apache core. File issues on the private SoT.\n',
    )
    writeFileSync(
      join(src, 'docs/oss/system-design/overview.md'),
      'Synawood is a GTM operating system you can self-host.\n',
    )
    mkdirSync(join(src, 'docs/architecture'), { recursive: true })
    writeFileSync(join(src, 'docs/architecture/vercel-deploy.md'), 'hosted-vercel-team\n')

    const dest = join(tmp(), 'out')
    const result = buildPublicTree({ src, dest })

    expect(existsSync(join(dest, 'docs/oss'))).toBe(false)
    expect(existsSync(join(dest, 'docs/architecture/vercel-deploy.md'))).toBe(false)
    expect(readFileSync(join(dest, 'AGENTS.md'), 'utf8')).toMatch(/Public Apache core/)
    expect(readFileSync(join(dest, 'docs/system-design/overview.md'), 'utf8')).toMatch(/self-host/)
    expect(readFileSync(join(dest, 'docs/system-design/overview.md'), 'utf8')).not.toMatch(/the private example/)
    expect(result.leaks).toEqual([])
  })
})

it('does not copy nested .next build output', () => {
  const src = tmp()
  mkdirSync(join(src, 'dashboard/.next/cache'), { recursive: true })
  writeFileSync(join(src, 'dashboard/.next/cache/pack'), 'AccountKey=fake')
  writeFileSync(join(src, 'keep.md'), 'ok\n')
  const dest = join(tmp(), 'out')
  buildPublicTree({ src, dest })
  expect(existsSync(join(dest, 'dashboard/.next'))).toBe(false)
  expect(existsSync(join(dest, 'keep.md'))).toBe(true)
})

it('does not copy gitignored env files into the snapshot (#906)', () => {
  const src = tmp()
  writeFileSync(join(src, '.env'), 'SUPABASE_SERVICE_ROLE_KEY=secret\n')
  writeFileSync(join(src, '.env.local'), 'AZURE_STORAGE_CONNECTION_STRING=secret\n')
  writeFileSync(join(src, '.env.example'), 'SUPABASE_SERVICE_ROLE_KEY=\n')
  mkdirSync(join(src, 'dashboard'), { recursive: true })
  writeFileSync(join(src, 'dashboard/.env.local'), 'NEXT_PUBLIC_SUPABASE_ANON_KEY=secret\n')
  writeFileSync(join(src, 'keep.md'), 'ok\n')
  const dest = join(tmp(), 'out')
  buildPublicTree({ src, dest })
  expect(existsSync(join(dest, '.env'))).toBe(false)
  expect(existsSync(join(dest, '.env.local'))).toBe(false)
  expect(existsSync(join(dest, 'dashboard/.env.local'))).toBe(false)
  expect(existsSync(join(dest, '.env.example'))).toBe(true)
  expect(existsSync(join(dest, 'keep.md'))).toBe(true)
})
