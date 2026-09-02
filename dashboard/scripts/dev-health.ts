import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import {
  devHealthFailures,
  formatDevHealthFailure,
  kbToMb,
  type DevHealthSample,
} from '../lib/dev-server-health'

const execFileAsync = promisify(execFile)

const url = process.env.SYNAWOOD_DEV_URL ?? 'http://localhost:3000/'

const measureTtfbSeconds = async (): Promise<number | null> => {
  const started = performance.now()
  try {
    const res = await fetch(url, { redirect: 'manual' })
    await res.arrayBuffer()
    return (performance.now() - started) / 1000
  } catch {
    return null
  }
}

const nextServerRssKb = async (): Promise<number | null> => {
  try {
    const { stdout } = await execFileAsync('pgrep', ['-f', 'next-server'])
    const pids = stdout
      .trim()
      .split(/\s+/)
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n) && n > 0)
    if (pids.length === 0) return null
    let maxKb = 0
    for (const pid of pids) {
      const rss = await execFileAsync('ps', ['-o', 'rss=', '-p', String(pid)])
      const kb = Number(rss.stdout.trim())
      if (Number.isFinite(kb) && kb > maxKb) maxKb = kb
    }
    return maxKb > 0 ? maxKb : null
  } catch {
    return null
  }
}

const sampleDevHealth = async (): Promise<DevHealthSample> => {
  const ttfbSeconds = await measureTtfbSeconds()
  const rssKb = await nextServerRssKb()
  return { ttfbSeconds, rssMb: rssKb === null ? null : kbToMb(rssKb) }
}

const run = async (): Promise<void> => {
  const sample = await sampleDevHealth()
  const failures = devHealthFailures(sample)
  const ttfbLabel =
    sample.ttfbSeconds === null ? 'unreachable' : `${sample.ttfbSeconds.toFixed(2)}s`
  const rssLabel = sample.rssMb === null ? 'none' : `${Math.round(sample.rssMb)} MB`
  console.log(`dev-health ${url}`)
  console.log(`  ttfb ${ttfbLabel}`)
  console.log(`  next-server RSS ${rssLabel}`)

  if (failures.length > 0) {
    for (const failure of failures) {
      console.log(`FAIL ${formatDevHealthFailure(failure)}`)
    }
    console.log('recycle: stop npm run dev, rm -rf dashboard/.next/cache/webpack, then npm run dev')
    process.exit(1)
  }

  console.log('ok')
}

void run()
