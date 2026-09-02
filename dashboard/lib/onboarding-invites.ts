import type { InviteFunctionalRole } from './functional-roles'
import { isInviteFunctionalRole } from './functional-roles'

export const MAX_ONBOARDING_INVITES = 5

export type OnboardingInviteDraft = {
  email: string
  jobFunction: InviteFunctionalRole
}

const looksLikeEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

export const emptyInviteDraft = (): OnboardingInviteDraft => ({
  email: '',
  jobFunction: 'editor',
})

/** Drops blank rows. Invalid emails stay so the UI can flag them. */
export const filledInviteDrafts = (rows: OnboardingInviteDraft[]): OnboardingInviteDraft[] =>
  rows
    .map((row) => ({
      email: row.email.trim().toLowerCase(),
      jobFunction: isInviteFunctionalRole(row.jobFunction) ? row.jobFunction : 'editor',
    }))
    .filter((row) => row.email.length > 0)

export const partitionInviteDrafts = (
  rows: OnboardingInviteDraft[],
): { valid: OnboardingInviteDraft[]; invalid: OnboardingInviteDraft[] } => {
  const filled = filledInviteDrafts(rows).slice(0, MAX_ONBOARDING_INVITES)
  return {
    valid: filled.filter((row) => looksLikeEmail(row.email)),
    invalid: filled.filter((row) => !looksLikeEmail(row.email)),
  }
}
