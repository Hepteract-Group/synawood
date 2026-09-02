/** License and src gates for kit Lottie. GIF/GIPHY stay rejected (ADR-0091). */

export const isBlockedStingerSrc = (src: string): boolean =>
  /giphy\.com|media\d*\.giphy|\.gif(\?|$)/i.test(src.trim())

/** First-party kit default (no src) may omit licenseStatus. Library src fail-closes. */
export const isStingerLicenseCleared = (
  licenseStatus: string | undefined,
  source?: string,
  src?: string,
): boolean => {
  if (source === 'first-party' || licenseStatus === 'first-party') return true
  if (licenseStatus === 'cleared') return true
  if (licenseStatus === undefined && !src) return true
  return false
}
