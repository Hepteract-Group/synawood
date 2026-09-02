/** Thresholds for a warm local `next dev`. Recycle when any check fails. */

export const DEV_HEALTH_MAX_TTFB_SECONDS = 5
/** Turbopack with Studio open sits near 1.7 GB; leaked webpack hit 2.7 GB. */
export const DEV_HEALTH_MAX_RSS_MB = 2560

export type DevHealthSample = {
  ttfbSeconds: number | null
  rssMb: number | null
}

export type DevHealthFailure =
  | { kind: 'no-ttfb' }
  | { kind: 'ttfb'; seconds: number; maxSeconds: number }
  | { kind: 'no-rss' }
  | { kind: 'rss'; mb: number; maxMb: number }

export const kbToMb = (rssKb: number): number => rssKb / 1024

export const formatDevHealthFailure = (failure: DevHealthFailure): string => {
  if (failure.kind === 'no-ttfb') return 'no TTFB (dashboard did not answer)'
  if (failure.kind === 'ttfb') {
    return `TTFB ${failure.seconds.toFixed(1)}s > ${failure.maxSeconds}s`
  }
  if (failure.kind === 'no-rss') return 'no next-server RSS (is npm run dev running?)'
  return `RSS ${Math.round(failure.mb)} MB > ${failure.maxMb} MB`
}

export const devHealthFailures = (
  sample: DevHealthSample,
  limits: { maxTtfbSeconds: number; maxRssMb: number } = {
    maxTtfbSeconds: DEV_HEALTH_MAX_TTFB_SECONDS,
    maxRssMb: DEV_HEALTH_MAX_RSS_MB,
  },
): DevHealthFailure[] => {
  const failures: DevHealthFailure[] = []
  if (sample.ttfbSeconds === null) {
    failures.push({ kind: 'no-ttfb' })
  } else if (sample.ttfbSeconds > limits.maxTtfbSeconds) {
    failures.push({
      kind: 'ttfb',
      seconds: sample.ttfbSeconds,
      maxSeconds: limits.maxTtfbSeconds,
    })
  }
  if (sample.rssMb === null) {
    failures.push({ kind: 'no-rss' })
  } else if (sample.rssMb > limits.maxRssMb) {
    failures.push({ kind: 'rss', mb: sample.rssMb, maxMb: limits.maxRssMb })
  }
  return failures
}
