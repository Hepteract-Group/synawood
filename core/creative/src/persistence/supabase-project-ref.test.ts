import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { assertExpectedSupabaseProjectRef, SUPABASE_REF_MISMATCH } from './supabase-project-ref'

describe('assertExpectedSupabaseProjectRef (#901)', () => {
  it('allows any ref when expected is unset', () => {
    expect(() => assertExpectedSupabaseProjectRef('anything', {})).not.toThrow()
  })

  it('allows a matching expected ref', () => {
    expect(() =>
      assertExpectedSupabaseProjectRef('marketing-os', {
        EXPECTED_SUPABASE_PROJECT_REF: 'marketing-os',
      }),
    ).not.toThrow()
  })

  it('refuses a mismatch with generic copy', () => {
    expect(() =>
      assertExpectedSupabaseProjectRef('other-app', {
        EXPECTED_SUPABASE_PROJECT_REF: 'marketing-os',
      }),
    ).toThrow(SUPABASE_REF_MISMATCH)
  })
})

describe('no baked foreign project ref (#901)', () => {
  it('does not embed the historical the private example project id in persistence or env tests', () => {
    const repo = join(__dirname, '../../../..')
    const paths = [
      'core/creative/src/persistence/supabase.ts',
      'core/creative/src/persistence/supabase-project-ref.ts',
      'dashboard/lib/service-supabase-edge.ts',
      'dashboard/lib/env.test.ts',
    ]
    for (const rel of paths) {
      const abs = join(repo, rel)
      if (!existsSync(abs)) continue
      expect(readFileSync(abs, 'utf8'), rel).not.toMatch(/REDACTED_PROJECT_REF/)
      expect(readFileSync(abs, 'utf8'), rel).not.toMatch(/Refusing the private example/)
    }
  })
})
