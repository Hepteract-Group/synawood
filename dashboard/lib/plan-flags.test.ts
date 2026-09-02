import { describe, expect, it } from 'vitest'
import { planIncludesRole, resolveProductPlan, rolesIncludedOnPlan } from './plan-flags'

describe('plan flags (#270 / ADR-0037)', () => {
  it('defaults unknown env to founding, which includes every job function', () => {
    expect(resolveProductPlan(undefined)).toBe('founding')
    expect(resolveProductPlan('nope')).toBe('founding')
    expect(rolesIncludedOnPlan('founding')).toEqual([
      'founder',
      'editor',
      'reviewer',
      'publisher',
      'analyst',
    ])
  })

  it('marks reviewer as an upsell on the local preview plan', () => {
    expect(planIncludesRole('preview', 'editor')).toBe(true)
    expect(planIncludesRole('preview', 'reviewer')).toBe(false)
    expect(planIncludesRole('preview', 'publisher')).toBe(false)
  })
})
