export const LANDING_HREF = '/' as const

export type SignOutResult = { error?: { message?: string } | null } | void

export const signOutToLanding = async (params: {
  signOut: () => Promise<SignOutResult>
  assign: (url: string) => void
}): Promise<void> => {
  const result = await params.signOut()
  if (result && typeof result === 'object' && result.error) {
    throw new Error(result.error.message || 'Could not sign out. Try again.')
  }
  params.assign(LANDING_HREF)
}
