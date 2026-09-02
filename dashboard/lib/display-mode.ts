/** Installed PWA window vs browser tab (ADR-0078). No service worker. */

export const STANDALONE_MEDIA_QUERY = '(display-mode: standalone)'

export const isStandaloneDisplay = (input: {
  mediaMatches?: boolean
  iosStandalone?: boolean
}): boolean => input.iosStandalone === true || input.mediaMatches === true

export const readStandaloneDisplay = (): boolean => {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return isStandaloneDisplay({
    mediaMatches: window.matchMedia?.(STANDALONE_MEDIA_QUERY).matches,
    iosStandalone: nav.standalone === true,
  })
}
