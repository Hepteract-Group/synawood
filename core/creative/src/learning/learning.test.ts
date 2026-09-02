import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { runAnalyses, type LearningRow } from './analyses'
import { draftDigest, sendInsightsDigest } from './digest'
import { mergePriors } from './merge'
import { loadPriors, writeLocalPriorsBestEffort } from './priors'
import { emptyPriors } from './schema'

const migrationSql = readFileSync(
  path.join(process.cwd(), '../../supabase/migrations/0035_insights.sql'),
  'utf8',
)

const fixtureRows = (): LearningRow[] => [
  {
    finalAssetId: 'empty',
    beatCount: 0,
    views: 40,
    clicks: 0,
    signups: 0,
    revenue: 0,
    beats: [],
  },
  {
    finalAssetId: 'thin-long',
    beatCount: 2,
    views: 2,
    clicks: 0,
    signups: 0,
    revenue: 0,
    beats: [
      { kind: 'hook', durationInFrames: 120 },
      { kind: 'body', durationInFrames: 30 },
    ],
  },
  {
    finalAssetId: 'thin',
    beatCount: 2,
    views: 1,
    clicks: 0,
    signups: 0,
    revenue: 0,
    beats: [
      { kind: 'hook', durationInFrames: 30 },
      { kind: 'body', durationInFrames: 30 },
    ],
  },
  {
    finalAssetId: 'offer',
    beatCount: 4,
    views: 90,
    clicks: 8,
    signups: 12,
    revenue: 0,
    beats: [
      { kind: 'hook', durationInFrames: 30 },
      { kind: 'body', durationInFrames: 30 },
      { kind: 'offer', durationInFrames: 30 },
      { kind: 'cta', durationInFrames: 30 },
    ],
  },
  {
    finalAssetId: 'no-offer',
    beatCount: 4,
    views: 80,
    clicks: 4,
    signups: 1,
    revenue: 0,
    beats: [
      { kind: 'hook', durationInFrames: 30 },
      { kind: 'body', durationInFrames: 30 },
      { kind: 'proof', durationInFrames: 30 },
      { kind: 'cta', durationInFrames: 30 },
    ],
  },
]

describe('insights schema (#251)', () => {
  it('creates insights with kind/status checks and open-kind unique index', () => {
    expect(migrationSql).toContain('create table public.insights')
    expect(migrationSql).toContain("'empty_structure'")
    expect(migrationSql).toContain("'offer_signups'")
    expect(migrationSql).toContain('insights_open_kind_uniq')
    expect(migrationSql).toMatch(
      /grant select, insert, update, delete on public.insights to service_role/,
    )
  })
})

describe('priors loader (#252)', () => {
  let tmp: string | null = null

  afterEach(async () => {
    if (tmp) await rm(tmp, { recursive: true, force: true })
    tmp = null
  })

  it('merges local over product over pack default', async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), 'mos-priors-'))
    const productDir = path.join(tmp, 'products', 'demo')
    await mkdir(productDir, { recursive: true })
    await writeFile(
      path.join(productDir, 'priors.json'),
      JSON.stringify({ structure: { preferredBeatCount: 5 } }),
      'utf8',
    )
    await writeFile(
      path.join(productDir, 'priors.local.json'),
      JSON.stringify({ hooks: { maxSeconds: 2 } }),
      'utf8',
    )
    const loaded = await loadPriors({ productId: 'demo', repoRoot: tmp })
    expect(loaded.source).toBe('local')
    expect(loaded.priors.structure?.preferredBeatCount).toBe(5)
    expect(loaded.priors.hooks?.maxSeconds).toBe(2)
  })

  it('writes local overlay best-effort', async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), 'mos-priors-write-'))
    const wrote = await writeLocalPriorsBestEffort(
      'demo',
      mergePriors(emptyPriors(), { structure: { requireCta: true } }),
      tmp,
    )
    expect(wrote).toBe(true)
    const raw = JSON.parse(
      await readFile(path.join(tmp, 'products', 'demo', 'priors.local.json'), 'utf8'),
    ) as { structure?: { requireCta?: boolean } }
    expect(raw.structure?.requireCta).toBe(true)
  })
})

describe('analyses (#253)', () => {
  it('emits no drafts for an empty rollup', () => {
    expect(runAnalyses([])).toEqual([])
  })

  it('emits the five v1 kinds from mixed Final rows', () => {
    const drafts = runAnalyses(fixtureRows())
    expect(drafts.map((row) => row.kind)).toEqual([
      'empty_structure',
      'missing_cta',
      'hook_length',
      'beat_count',
      'offer_signups',
    ])
    expect(drafts.find((row) => row.kind === 'hook_length')?.proposedPrior).toEqual({
      hooks: { maxSeconds: 3 },
    })
  })
})

describe('digest (#259)', () => {
  it('skips send when digest address is unset', async () => {
    const result = await sendInsightsDigest({
      productId: 'demo',
      insights: [{ title: 'Trim hooks', body: 'Hooks run longer than 3 seconds.' }],
      env: { RESEND_API_KEY: 're_test' },
    })
    expect(result.sent).toBe(false)
    if (result.sent) throw new Error('expected skip')
    expect(result.skipped).toBe(true)
    expect(result.preview.subject).toContain('demo')
  })

  it('posts to Resend when keys are set', async () => {
    const result = await sendInsightsDigest({
      productId: 'demo',
      insights: [{ title: 'Trim hooks', body: 'Hooks run longer than 3 seconds.' }],
      env: { RESEND_API_KEY: 're_test', INSIGHTS_DIGEST_TO: 'ops@example.com' },
      fetchImpl: (async () => new Response('{}', { status: 200 })) as typeof fetch,
    })
    expect(result).toMatchObject({ sent: true })
  })

  it('drafts empty-state copy', () => {
    const preview = draftDigest([], 'demo')
    expect(preview.text).toContain('No open insights')
  })
})
