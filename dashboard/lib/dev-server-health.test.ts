import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  DEV_HEALTH_MAX_RSS_MB,
  DEV_HEALTH_MAX_TTFB_SECONDS,
  devHealthFailures,
  formatDevHealthFailure,
  kbToMb,
} from './dev-server-health'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '../..')

describe('local next-dev health (#1305)', () => {
  it('defaults dashboard npm run dev to Turbopack with a webpack fallback', () => {
    const pkg = JSON.parse(readFileSync(join(repoRoot, 'dashboard/package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }
    expect(pkg.scripts.dev).toMatch(/next dev --turbopack/)
    expect(pkg.scripts['dev:webpack']).toMatch(/next dev/)
    expect(pkg.scripts['dev:webpack']).not.toMatch(/--turbopack/)
    expect(pkg.scripts['dev:health']).toMatch(/dev-health/)
    const localFirst = readFileSync(join(repoRoot, 'docs/architecture/local-first.md'), 'utf8')
    expect(localFirst).toMatch(/next dev --turbopack/)
    expect(localFirst).toMatch(/npm run dev:health/)
  })

  it('flags the measured 46s / 2.7GB webpack session and accepts a healthy process', () => {
    expect(kbToMb(2_733_936)).toBeGreaterThan(DEV_HEALTH_MAX_RSS_MB)
    const sick = devHealthFailures({ ttfbSeconds: 45.9, rssMb: kbToMb(2_733_936) })
    expect(sick.map((f) => f.kind)).toEqual(['ttfb', 'rss'])
    expect(sick.map(formatDevHealthFailure)).toEqual([
      `TTFB 45.9s > ${DEV_HEALTH_MAX_TTFB_SECONDS}s`,
      `RSS ${Math.round(kbToMb(2_733_936))} MB > ${DEV_HEALTH_MAX_RSS_MB} MB`,
    ])
    expect(devHealthFailures({ ttfbSeconds: 0.8, rssMb: 410 })).toEqual([])
    expect(devHealthFailures({ ttfbSeconds: 0.06, rssMb: 1700 })).toEqual([])
  })

  it('fails closed when the dashboard is not running', () => {
    expect(
      devHealthFailures({ ttfbSeconds: null, rssMb: null }).map(formatDevHealthFailure),
    ).toEqual([
      'no TTFB (dashboard did not answer)',
      'no next-server RSS (is npm run dev running?)',
    ])
  })
})
