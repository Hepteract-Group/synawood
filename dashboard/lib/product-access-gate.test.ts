import { describe, expect, it } from 'vitest'
import {
  decideProtectedNavigation,
  resolveAppAccess,
  userMayAccessApp,
} from './product-access-gate'

const allowlist = { AUTH_ALLOWLIST_EMAILS: 'ada@studio.local', NODE_ENV: 'production' as const }

const stubSupabase = (opts: { memberships: number; inviteRows?: { id: string }[] }) => {
  let memberQueries = 0
  let inviteQueries = 0
  const client = {
    from: (table: string) => {
      if (table === 'product_members') {
        return {
          select: () => ({
            eq: async () => {
              memberQueries += 1
              return { count: opts.memberships, error: null }
            },
          }),
        }
      }
      if (table === 'product_invites') {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                or: () => ({
                  limit: async () => {
                    inviteQueries += 1
                    return { data: opts.inviteRows ?? [], error: null }
                  },
                }),
              }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }
  return {
    client: client as never,
    counts: () => ({ memberQueries, inviteQueries }),
  }
}

describe('resolveAppAccess', () => {
  it('allowlisted users still get one membership count and skip invite lookup', async () => {
    const { client, counts } = stubSupabase({ memberships: 2 })
    const access = await resolveAppAccess(
      client,
      { userId: 'u1', email: 'ada@studio.local' },
      allowlist,
    )
    expect(access).toEqual({ allowed: true, membershipCount: 2 })
    expect(counts()).toEqual({ memberQueries: 1, inviteQueries: 0 })
  })

  it('members are allowed without an invite lookup', async () => {
    const { client, counts } = stubSupabase({ memberships: 1 })
    const access = await resolveAppAccess(
      client,
      { userId: 'u1', email: 'ed@studio.local' },
      allowlist,
    )
    expect(access.allowed).toBe(true)
    expect(access.membershipCount).toBe(1)
    expect(counts().inviteQueries).toBe(0)
  })

  it('invite-only users are allowed with zero memberships', async () => {
    const { client, counts } = stubSupabase({
      memberships: 0,
      inviteRows: [{ id: 'inv-1' }],
    })
    const access = await resolveAppAccess(
      client,
      { userId: 'u1', email: 'guest@studio.local' },
      allowlist,
    )
    expect(access).toEqual({ allowed: true, membershipCount: 0 })
    expect(counts()).toEqual({ memberQueries: 1, inviteQueries: 1 })
  })

  it('strangers are denied after one membership and one invite lookup', async () => {
    const { client, counts } = stubSupabase({ memberships: 0, inviteRows: [] })
    const access = await resolveAppAccess(
      client,
      { userId: 'u1', email: 'stranger@example.com' },
      allowlist,
    )
    expect(access.allowed).toBe(false)
    expect(counts()).toEqual({ memberQueries: 1, inviteQueries: 1 })
  })

  it('saas mode allows strangers without an invite lookup', async () => {
    const { client, counts } = stubSupabase({ memberships: 0, inviteRows: [] })
    const access = await resolveAppAccess(
      client,
      { userId: 'u1', email: 'stranger@example.com' },
      { ...allowlist, AUTH_ACCESS_MODE: 'saas' },
    )
    expect(access).toEqual({ allowed: true, membershipCount: 0 })
    expect(counts()).toEqual({ memberQueries: 1, inviteQueries: 0 })
  })

  it('allowlist mode ignores an open invite', async () => {
    const { client, counts } = stubSupabase({
      memberships: 0,
      inviteRows: [{ id: 'inv-1' }],
    })
    const access = await resolveAppAccess(
      client,
      { userId: 'u1', email: 'guest@studio.local' },
      { ...allowlist, AUTH_ACCESS_MODE: 'allowlist' },
    )
    expect(access.allowed).toBe(false)
    expect(counts().inviteQueries).toBe(0)
  })

  it('userMayAccessApp stays a boolean wrapper', async () => {
    const { client } = stubSupabase({ memberships: 1 })
    await expect(
      userMayAccessApp(client, { userId: 'u1', email: 'ed@studio.local' }, allowlist),
    ).resolves.toBe(true)
  })
})

describe('decideProtectedNavigation', () => {
  it('sends users with no team to onboarding unless the path is exempt', () => {
    expect(
      decideProtectedNavigation({
        allowed: true,
        membershipCount: 0,
        onboardingExempt: false,
        profileComplete: true,
        profileExempt: false,
      }),
    ).toBe('onboarding')
    expect(
      decideProtectedNavigation({
        allowed: true,
        membershipCount: 0,
        onboardingExempt: true,
        profileComplete: true,
        profileExempt: false,
      }),
    ).toBe('allow')
  })

  it('sends incomplete profiles to About you before organization setup', () => {
    expect(
      decideProtectedNavigation({
        allowed: true,
        membershipCount: 0,
        onboardingExempt: false,
        profileComplete: false,
        profileExempt: false,
      }),
    ).toBe('profile')
    expect(
      decideProtectedNavigation({
        allowed: true,
        membershipCount: 0,
        onboardingExempt: true,
        profileComplete: false,
        profileExempt: true,
      }),
    ).toBe('allow')
  })

  it('lets members through and denies strangers', () => {
    expect(
      decideProtectedNavigation({
        allowed: true,
        membershipCount: 1,
        onboardingExempt: false,
        profileComplete: true,
        profileExempt: false,
      }),
    ).toBe('allow')
    expect(
      decideProtectedNavigation({
        allowed: false,
        membershipCount: 0,
        onboardingExempt: false,
        profileComplete: false,
        profileExempt: false,
      }),
    ).toBe('deny')
  })
})
