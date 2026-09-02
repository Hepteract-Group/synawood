import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { defaultFunctionalRole, hasFeature } from './functional-roles'

const sql = readFileSync(
  path.join(process.cwd(), '../supabase/migrations/0046_founder_functional_roles.sql'),
  'utf8',
)

describe('founder default functional roles (#271)', () => {
  it('backfills owners to founder and makes the column required', () => {
    expect(sql).toContain("when 'owner' then 'founder'")
    expect(sql).toContain('alter column functional_role set not null')
  })
})

describe('defaultFunctionalRole', () => {
  it('maps owner to founder', () => {
    expect(defaultFunctionalRole('owner')).toBe('founder')
    expect(defaultFunctionalRole('editor')).toBe('editor')
    expect(defaultFunctionalRole('viewer')).toBe('analyst')
  })
})

describe('hasFeature (#264)', () => {
  it('lets founders do every job function and analysts only outcomes', () => {
    expect(hasFeature('founder', 'members.manage')).toBe(true)
    expect(hasFeature('editor', 'studio.edit')).toBe(true)
    expect(hasFeature('editor', 'members.manage')).toBe(false)
    expect(hasFeature('analyst', 'outcomes.write')).toBe(true)
    expect(hasFeature('analyst', 'studio.publish')).toBe(false)
    expect(hasFeature(null, 'studio.edit')).toBe(false)
  })
})
