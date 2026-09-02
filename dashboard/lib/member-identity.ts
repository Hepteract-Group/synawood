import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProductMember } from './product-onboarding'

export type MemberIdentity = {
  email: string
  displayName: string
  unresolved: boolean
}

export type MemberWithIdentity = ProductMember & MemberIdentity

type AuthUserLike = {
  email?: string | null
  user_metadata?: Record<string, unknown> | null
}

const metaString = (metadata: Record<string, unknown> | null | undefined, key: string): string => {
  const value = metadata?.[key]
  return typeof value === 'string' ? value.trim() : ''
}

/** Label a member from Auth — never the user UUID. */
export const identityFromAuthUser = (user: AuthUserLike): MemberIdentity => {
  const email = (user.email ?? '').trim()
  const metadata = user.user_metadata ?? {}
  const fromMeta =
    metaString(metadata, 'full_name') ||
    metaString(metadata, 'name') ||
    metaString(metadata, 'display_name')
  const mailbox = email.includes('@') ? (email.split('@')[0] ?? '') : ''
  return {
    email: email || 'Unknown email',
    displayName: fromMeta || mailbox || 'Member',
    unresolved: false,
  }
}

export const hydrateMembersWithIdentity = async (
  supabase: SupabaseClient,
  members: ProductMember[],
): Promise<MemberWithIdentity[]> => {
  return Promise.all(
    members.map(async (member) => {
      const { data, error } = await supabase.auth.admin.getUserById(member.userId)
      if (error || !data.user) {
        return {
          ...member,
          email: 'Unknown email',
          displayName: 'Unknown member',
          unresolved: true,
        }
      }
      return { ...member, ...identityFromAuthUser(data.user) }
    }),
  )
}
