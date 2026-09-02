import { describe, expect, it } from 'vitest'
import {
  emptyIntent,
  emptyScenes,
  parseDirectorPlan,
  parseIntent,
  parseScenes,
  parseSuggestion,
  sceneClipInvariantIssues,
  sceneSchema,
  intentPatchSchema,
} from './schema'

describe('intentSchema', () => {
  it('defaults empty intent and keywords', () => {
    const intent = emptyIntent()
    expect(intent).toEqual({ keywords: [] })
    expect(parseIntent({})).toEqual({ keywords: [] })
  })

  it('parses a populated intent', () => {
    const intent = parseIntent({
      goal: 'signup',
      platform: 'tiktok',
      emotion: 'emotional',
      lengthSeconds: 15,
      cta: 'Download today',
      audience: { persona: 'Parents', ageRange: [25, 40], context: 'first-time parents' },
      brandVoice: 'warm-authoritative',
      keywords: ['pdf', 'focus'],
    })
    expect(intent.platform).toBe('tiktok')
    expect(intent.audience?.ageRange).toEqual([25, 40])
  })

  it('persists funnel stage, KPI, and desired behaviour (#1219)', () => {
    const intent = parseIntent({
      goal: 'signup',
      funnelStage: 'mof',
      kpi: 'trial starts',
      desiredBehaviour: 'start a 14-day trial',
    })
    expect(intent.funnelStage).toBe('mof')
    expect(intent.kpi).toBe('trial starts')
    expect(intent.desiredBehaviour).toBe('start a 14-day trial')
    expect(() => parseIntent({ funnelStage: 'everywhere' })).toThrow()
    expect(intentPatchSchema.parse({ funnelStage: 'tof', kpi: 'signups' })).toEqual({
      funnelStage: 'tof',
      kpi: 'signups',
    })
  })

  it('persists audience awareness, language, and primary pain (#1221)', () => {
    const intent = parseIntent({
      audience: {
        persona: 'Ops leads drowning in PDFs',
        awarenessStage: 'problem-aware',
        language: 'I spend my evening merging files',
        primaryPain: 'contracts stuck as uneditable scans',
      },
    })
    expect(intent.audience?.awarenessStage).toBe('problem-aware')
    expect(intent.audience?.language).toBe('I spend my evening merging files')
    expect(intent.audience?.primaryPain).toBe('contracts stuck as uneditable scans')
    expect(() => parseIntent({ audience: { awarenessStage: 'curious' } })).toThrow()
    expect(
      intentPatchSchema.parse({
        audience: { awarenessStage: 'most-aware', primaryPain: 'need a faster close' },
      }),
    ).toEqual({
      audience: { awarenessStage: 'most-aware', primaryPain: 'need a faster close' },
    })
  })

  it('persists primaryMessage and at most two supporting points (#1223)', () => {
    const intent = parseIntent({
      primaryMessage: 'Stop hunting 14 tender portals',
      supportingPoints: ['One inbox', 'Start a trial'],
      cta: 'Start free',
    })
    expect(intent.primaryMessage).toBe('Stop hunting 14 tender portals')
    expect(intent.supportingPoints).toEqual(['One inbox', 'Start a trial'])
    expect(intent.cta).toBe('Start free')
    expect(() => parseIntent({ supportingPoints: ['a', 'b', 'c'] })).toThrow()
    expect(
      intentPatchSchema.parse({
        primaryMessage: 'Stop hunting portals',
        supportingPoints: ['One inbox'],
      }),
    ).toEqual({
      primaryMessage: 'Stop hunting portals',
      supportingPoints: ['One inbox'],
    })
  })

  it('rejects inverted ageRange', () => {
    expect(() =>
      parseIntent({
        audience: { ageRange: [40, 25] },
      }),
    ).toThrow(/ageRange/)
  })

  it('rejects unknown platform / emotion', () => {
    expect(() => parseIntent({ platform: 'reels' })).toThrow()
    expect(() => parseIntent({ emotion: 'hype' })).toThrow()
  })
})

describe('sceneSchema', () => {
  it('defaults clip/overlay arrays and locked', () => {
    const scene = sceneSchema.parse({
      id: 'sc_hook',
      role: 'hook',
      label: 'Hook',
    })
    expect(scene.clipIds).toEqual([])
    expect(scene.overlayIds).toEqual([])
    expect(scene.locked).toBe(false)
  })

  it('parses a scene list', () => {
    const scenes = parseScenes([
      {
        id: 'sc_1',
        role: 'hook',
        label: 'Hook',
        clipIds: ['c1'],
        targetDurationFrames: 90,
      },
      {
        id: 'sc_2',
        role: 'cta',
        label: 'CTA',
        clipIds: ['c2'],
        locked: true,
      },
    ])
    expect(scenes).toHaveLength(2)
    expect(emptyScenes()).toEqual([])
  })
})

describe('sceneClipInvariantIssues', () => {
  it('flags duplicate clip assignment', () => {
    const issues = sceneClipInvariantIssues([
      { id: 'sc_a', role: 'hook', label: 'A', clipIds: ['c1'], overlayIds: [], locked: false },
      { id: 'sc_b', role: 'cta', label: 'B', clipIds: ['c1'], overlayIds: [], locked: false },
    ])
    expect(issues.some((issue) => issue.includes('both'))).toBe(true)
  })

  it('flags unknown clip ids when a set is provided', () => {
    const issues = sceneClipInvariantIssues(
      [
        {
          id: 'sc_a',
          role: 'hook',
          label: 'A',
          clipIds: ['missing'],
          overlayIds: [],
          locked: false,
        },
      ],
      new Set(['c1']),
    )
    expect(issues.some((issue) => issue.includes('not on the project'))).toBe(true)
  })
})

describe('directorPlanSchema', () => {
  it('parses a draft plan stub', () => {
    const plan = parseDirectorPlan({
      id: '33333333-3333-4333-8333-333333333333',
      createdAt: '2026-08-03T12:00:00.000Z',
      projectRevision: 3,
      edits: [
        {
          id: 'e1',
          mutation: { type: 'trim_clip', clipId: 'c1', durationInFrames: 60 },
          previewText: 'Shorten hook',
        },
      ],
      rationale: 'Tighten pacing for TikTok.',
      costEstimateGbp: 0,
    })
    expect(plan.status).toBe('draft')
    expect(plan.scope).toBe('global')
    expect(plan.edits[0]?.status).toBe('proposed')
    expect(plan.edits[0]?.mutation.type).toBe('trim_clip')
  })
})

describe('suggestionSchema', () => {
  it('parses a free heuristic suggestion', () => {
    const suggestion = parseSuggestion({
      id: 's1',
      label: 'Shorten to 2.1s',
      kind: 'trim',
      tool: 'trim_clip',
      args: { clipId: 'c1', durationInFrames: 63 },
    })
    expect(suggestion.estimatedCostGbp).toBe(0)
    expect(suggestion.requiresGenerator).toBe(false)
  })
})
