export const authoredBannerDismissKey = (projectId: string, fingerprint: string): string =>
  `mos.studio.dismissedAuthoredBanner:${projectId}:${fingerprint}`

export const authoredBannerFingerprint = (kind: string, message: string): string =>
  `${kind}:${message.slice(0, 160)}`

export type AuthoredBannerDismissLevel = 'none' | 'banner' | 'all'

export const readAuthoredBannerDismissLevel = (
  projectId: string,
  fingerprint: string,
): AuthoredBannerDismissLevel => {
  try {
    const value = localStorage.getItem(authoredBannerDismissKey(projectId, fingerprint))
    if (value === 'all') return 'all'
    if (value === '1' || value === 'banner') return 'banner'
    return 'none'
  } catch {
    return 'none'
  }
}

export const markAuthoredBannerDismissed = (
  projectId: string,
  fingerprint: string,
  level: Exclude<AuthoredBannerDismissLevel, 'none'> = 'banner',
): void => {
  try {
    localStorage.setItem(
      authoredBannerDismissKey(projectId, fingerprint),
      level === 'all' ? 'all' : '1',
    )
  } catch {
    // Private mode — session dismiss still works.
  }
}
