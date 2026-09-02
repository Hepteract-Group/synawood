/** Read media duration via HTML element metadata (needs Range-capable /content for large files). */
export const measureHtmlMediaDurationFrames = (
  url: string,
  fps: number,
  kind: 'video' | 'audio',
  timeoutMs = 12_000,
): Promise<number | null> =>
  new Promise((resolve) => {
    if (typeof document === 'undefined' || !url || !(fps > 0)) {
      resolve(null)
      return
    }
    const el = document.createElement(kind === 'audio' ? 'audio' : 'video')
    el.preload = 'metadata'
    el.muted = true
    const cleanup = () => {
      el.removeAttribute('src')
      el.load()
    }
    const timer = window.setTimeout(() => {
      cleanup()
      resolve(null)
    }, timeoutMs)
    el.addEventListener(
      'loadedmetadata',
      () => {
        window.clearTimeout(timer)
        const seconds = el.duration
        cleanup()
        if (!Number.isFinite(seconds) || seconds <= 0) {
          resolve(null)
          return
        }
        resolve(Math.max(1, Math.round(seconds * fps)))
      },
      { once: true },
    )
    el.addEventListener(
      'error',
      () => {
        window.clearTimeout(timer)
        cleanup()
        resolve(null)
      },
      { once: true },
    )
    el.src = url
  })
