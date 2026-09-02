import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationsDir = join(process.cwd(), '..', 'supabase', 'migrations')

describe('migration seed (#899)', () => {
  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort()

  it('keeps the existing SQL chain (no squash)', () => {
    expect(files.length).toBeGreaterThanOrEqual(48)
    expect(files[0]).toBe('0001_studio_core.sql')
  })

  it('does not insert a the private example products row or waitlist rows', () => {
    const studioCore = readFileSync(join(migrationsDir, '0001_studio_core.sql'), 'utf8')
    expect(studioCore).not.toMatch(/insert into public\.products/i)
    expect(studioCore).not.toMatch(/'demo'/)
    expect(studioCore).toMatch(/project ref comes from env/i)

    for (const name of files) {
      const sql = readFileSync(join(migrationsDir, name), 'utf8')
      expect(sql).not.toMatch(/insert into public\.waitlist_entries/i)
    }
  })
})
