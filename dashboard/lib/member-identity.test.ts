import { describe, expect, it, vi } from 'vitest'
import { hydrateMembersWithIdentity, identityFromAuthUser } from './member-identity'
import type { ProductMember } from './product-onboarding'

describe('identityFromAuthUser', () => {
  it('prefers full_name, then email local part', () => {
    expect(
      identityFromAuthUser({
        email: 'ada@hepteract.dev',
        user_metadata: { full_name: 'Ada Lovelace' },
      }),
    ).toEqual({ email: 'ada@hepteract.dev', displayName: 'Ada Lovelace', unresolved: false })
  })

  it('uses Google name when full_name is missing', () => {
    expect(
      identityFromAuthUser({
        email: 'ada@hepteract.dev',
        user_metadata: { name: 'Ada L' },
      }),
    ).toEqual({ email: 'ada@hepteract.dev', displayName: 'Ada L', unresolved: false })
  })

  it('falls back to the mailbox when metadata is empty', () => {
    expect(identityFromAuthUser({ email: 'ada@hepteract.dev', user_metadata: {} })).toEqual({
      email: 'ada@hepteract.dev',
      displayName: 'ada',
      unresolved: false,
    })
  })

  it('does not use the Auth user id as the label', () => {
    const identity = identityFromAuthUser({
      email: null,
      user_metadata: {},
    })
    expect(identity.displayName).toBe('Member')
    expect(identity.email).toBe('Unknown email')
    expect(identity.unresolved).toBe(false)
  })
})

describe('hydrateMembersWithIdentity', () => {
  it('attaches Auth email and name, not the user id', async () => {
    const members: ProductMember[] = [
      {
        userId: '11111111-1111-4111-8111-111111111111',
        role: 'owner',
        functionalRole: 'founder',
        createdAt: '2026-08-22T00:00:00.000Z',
      },
    ]
    const getUserById = vi.fn(async () => ({
      data: {
        user: { email: 'ada@hepteract.dev', user_metadata: { full_name: 'Ada Lovelace' } },
      },
      error: null,
    }))
    const supabase = { auth: { admin: { getUserById } } } as never
    const hydrated = await hydrateMembersWithIdentity(supabase, members)
    expect(hydrated[0]?.displayName).toBe('Ada Lovelace')
    expect(hydrated[0]?.email).toBe('ada@hepteract.dev')
    expect(hydrated[0]?.displayName).not.toContain('11111111')
  })

  it('marks Auth lookup failures so the UI does not fake a name', async () => {
    const members: ProductMember[] = [
      {
        userId: '11111111-1111-4111-8111-111111111111',
        role: 'owner',
        functionalRole: 'founder',
        createdAt: '2026-08-22T00:00:00.000Z',
      },
    ]
    const supabase = {
      auth: {
        admin: {
          getUserById: async () => ({ data: { user: null }, error: { message: 'not found' } }),
        },
      },
    } as never
    const hydrated = await hydrateMembersWithIdentity(supabase, members)
    expect(hydrated[0]?.unresolved).toBe(true)
    expect(hydrated[0]?.displayName).toBe('Unknown member')
  })
})
