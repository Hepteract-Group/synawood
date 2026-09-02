import { describe, expect, it } from 'vitest'
import { tenancyForInviteFunctionalRole } from './functional-roles'
import { findMemberForRoleChange, type ProductMember } from './product-onboarding'

const member = (
  userId: string,
  functionalRole: ProductMember['functionalRole'],
): ProductMember => ({
  userId,
  role: functionalRole === 'analyst' ? 'viewer' : functionalRole === 'founder' ? 'owner' : 'editor',
  functionalRole,
  createdAt: '2026-08-22T00:00:00.000Z',
})

describe('findMemberForRoleChange (#267)', () => {
  it('blocks demoting the last founder', () => {
    expect(() => findMemberForRoleChange([member('u1', 'founder')], 'u1', 'editor')).toThrow(
      /one founder/,
    )
  })

  it('allows demoting a founder when another remains', () => {
    const current = findMemberForRoleChange(
      [member('u1', 'founder'), member('u2', 'founder')],
      'u1',
      'reviewer',
    )
    expect(current.userId).toBe('u1')
  })

  it('fails when the user is not a member', () => {
    expect(() => findMemberForRoleChange([member('u1', 'editor')], 'missing', 'reviewer')).toThrow(
      /not found/,
    )
  })
})

describe('tenancyForInviteFunctionalRole', () => {
  it('maps analyst to viewer and every other invite job to editor', () => {
    expect(tenancyForInviteFunctionalRole('analyst')).toBe('viewer')
    expect(tenancyForInviteFunctionalRole('reviewer')).toBe('editor')
    expect(tenancyForInviteFunctionalRole('publisher')).toBe('editor')
    expect(tenancyForInviteFunctionalRole('editor')).toBe('editor')
  })
})
