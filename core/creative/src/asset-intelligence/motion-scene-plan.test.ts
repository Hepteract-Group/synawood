import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { AnalysisForMotionPlan } from './motion-scene-plan'
import { motionScenePlanContextBlock, motionScenePlanFromAnalyses } from './motion-scene-plan'

const VIDEO = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SHOT_A = '11111111-1111-4111-8111-111111111111'
const SHOT_B = '22222222-2222-4222-8222-222222222222'
const SHOT_C = '33333333-3333-4333-8333-333333333333'

const highlight = (
  moments: Array<{
    shotId?: string
    startMs: number
    endMs: number
    score: number
    label: string
  }>,
  assetId = VIDEO,
): AnalysisForMotionPlan => ({
  kind: 'highlight',
  assetId,
  result: { moments },
})

const segment = (
  shots: Array<{ startMs: number; endMs: number; label: string }>,
  assetId = VIDEO,
): AnalysisForMotionPlan => ({
  kind: 'segment',
  assetId,
  result: { shots },
})

const compliance = (
  hits: Array<{
    timestampMs: number
    kind: string
    severity: string
    quote?: string
    visualNote?: string
  }>,
  assetId = VIDEO,
): AnalysisForMotionPlan => ({
  kind: 'compliance',
  assetId,
  result: { hits },
})

const threeHighlights = () =>
  highlight([
    { shotId: SHOT_A, startMs: 0, endMs: 1200, score: 0.95, label: 'pricing' },
    { shotId: SHOT_B, startMs: 4000, endMs: 5200, score: 0.4, label: 'settings' },
    { shotId: SHOT_C, startMs: 8000, endMs: 9400, score: 0.7, label: 'export' },
  ])

describe('motionScenePlanFromAnalyses (#1200)', () => {
  it('returns empty when there are no highlight or segment rows', () => {
    expect(motionScenePlanFromAnalyses({ analyses: [], motionSeed: 'seed-a' })).toEqual([])
    expect(
      motionScenePlanFromAnalyses({
        analyses: [compliance([{ timestampMs: 10, kind: 'claim', severity: 'high', quote: 'x' }])],
        motionSeed: 'seed-a',
      }),
    ).toEqual([])
    expect(
      motionScenePlanFromAnalyses({
        analyses: [{ kind: 'custom', assetId: VIDEO, result: { summary: 'ok' } }],
        motionSeed: 'seed-a',
      }),
    ).toEqual([])
  })

  it('places the seed-picked highlight first as device-hero, then other highlights by score', () => {
    const plan = motionScenePlanFromAnalyses({
      analyses: [threeHighlights()],
      motionSeed: 'seed-a',
    })
    expect(plan[0]?.kind).toBe('device-hero')
    expect(plan[0]?.plateAssetId).toBe(VIDEO)
    expect(plan.map((row) => row.shotId).sort()).toEqual([SHOT_A, SHOT_B, SHOT_C].sort())
    const rest = plan.slice(1)
    expect(rest.every((row) => row.kind === 'plate' || row.kind === 'type-only')).toBe(true)
    const restScores = rest.map((row) => {
      if (row.shotId === SHOT_A) return 0.95
      if (row.shotId === SHOT_C) return 0.7
      return 0.4
    })
    expect(restScores).toEqual([...restScores].sort((a, b) => b - a))
  })

  it('picks the same hero for the same seed and can pick a non-index-0 highlight', () => {
    const again = motionScenePlanFromAnalyses({
      analyses: [threeHighlights()],
      motionSeed: 'seed-a',
    })
    const first = motionScenePlanFromAnalyses({
      analyses: [threeHighlights()],
      motionSeed: 'seed-a',
    })
    expect(first[0]?.shotId).toBe(again[0]?.shotId)

    const heroes = new Set(
      ['seed-a', 'seed-b', 'seed-c', 'seed-d', 'seed-e', 'seed-f', 'seed-g', 'seed-h'].map(
        (motionSeed) =>
          motionScenePlanFromAnalyses({ analyses: [threeHighlights()], motionSeed })[0]?.shotId,
      ),
    )
    expect(heroes.size).toBeGreaterThan(1)
  })

  it('maps leftover segments to plates (or type-only) after the hero', () => {
    const plan = motionScenePlanFromAnalyses({
      analyses: [
        highlight([{ shotId: SHOT_A, startMs: 0, endMs: 1000, score: 0.9, label: 'hook' }]),
        segment([
          { startMs: 0, endMs: 1000, label: 'same-as-hero' },
          { startMs: 5000, endMs: 6500, label: 'later-beat' },
        ]),
      ],
      motionSeed: 'seed-a',
    })
    expect(plan[0]?.kind).toBe('device-hero')
    expect(plan[0]?.shotId).toBe(SHOT_A)
    const later = plan.filter((row) => row.note.includes('later-beat'))
    expect(later).toHaveLength(1)
    expect(later[0]?.kind === 'plate' || later[0]?.kind === 'type-only').toBe(true)
    expect(later[0]?.startMs).toBe(5000)
    expect(later[0]?.plateAssetId).toBe(VIDEO)
    expect(plan.some((row) => row.note.includes('same-as-hero'))).toBe(false)
  })

  it('flags overlapping compliance logo/unsafe hits so those stills are not full-bleed', () => {
    const plan = motionScenePlanFromAnalyses({
      analyses: [
        highlight([
          { shotId: SHOT_A, startMs: 0, endMs: 2000, score: 0.9, label: 'clean' },
          { shotId: SHOT_B, startMs: 4000, endMs: 6000, score: 0.8, label: 'logo stack' },
        ]),
        compliance([
          {
            timestampMs: 4500,
            kind: 'logo',
            severity: 'high',
            visualNote: 'logo-on-logo',
          },
        ]),
      ],
      motionSeed: 'seed-always-a',
    })
    const flagged = plan.find((row) => row.shotId === SHOT_B)
    const clean = plan.find((row) => row.shotId === SHOT_A)
    expect(flagged).toBeDefined()
    expect(flagged?.note).toMatch(/do not full-bleed/i)
    expect(flagged?.kind === 'type-only' || flagged?.kind === 'device-hero').toBe(true)
    if (flagged?.kind !== 'device-hero') expect(flagged?.kind).toBe('type-only')
    expect(clean?.note).not.toMatch(/do not full-bleed/i)
  })

  it('does not import inspect/critic (analyze never stamps cut review)', () => {
    const source = readFileSync(join(__dirname, 'motion-scene-plan.ts'), 'utf8')
    expect(source).not.toMatch(/inspect-preview|stampCutReview|critic\//)
    expect(source).not.toMatch(/generation_jobs/)
  })
})

describe('motionScenePlanContextBlock (#1200)', () => {
  it('lists plan rows for the agent and stays empty when there is no plan', () => {
    expect(motionScenePlanContextBlock([])).toBe('')
    const block = motionScenePlanContextBlock(
      motionScenePlanFromAnalyses({
        analyses: [threeHighlights()],
        motionSeed: 'seed-a',
      }),
    )
    expect(block).toMatch(/## Motion scene plan/)
    expect(block).toMatch(/device-hero/)
    expect(block).toMatch(/Sequence/)
    expect(block).toMatch(SHOT_A)
  })
})

describe('analyze motion-scene wiring (#1200)', () => {
  it('runTurn injects the plan; analyze_asset returns it; inspect stays required', () => {
    const runTurn = readFileSync(join(__dirname, '../agent/run-turn.ts'), 'utf8')
    expect(runTurn).toMatch(/listAssetAnalysesForAssets/)
    expect(runTurn).toMatch(/motionScenePlanFromAnalyses/)
    expect(runTurn).toMatch(/motionScenePlanContextBlock/)

    const tools = readFileSync(join(__dirname, '../tools/studio-tools.ts'), 'utf8')
    expect(tools).toMatch(/motionScenePlanFromAnalyses/)
    expect(tools).toMatch(/motionScenePlan/)

    const prompt = readFileSync(join(__dirname, '../agent/system-prompt.ts'), 'utf8')
    expect(prompt).toMatch(/Motion scene plan/)
    expect(prompt).toMatch(/type-led/)
    expect(prompt).toMatch(/analyze_asset never marks cut review passed/)
  })

  it('does not add a generation_jobs.role for motion scenes', () => {
    const sql = readFileSync(
      join(__dirname, '../../../../supabase/migrations/0052_reframe_role.sql'),
      'utf8',
    )
    expect(sql).toMatch(/'reframe'/)
    expect(sql).not.toMatch(/motion_scene/)
  })
})
