import { describe, expect, it } from 'vitest'
import { INTENT_SCENES_PROMPT_MAX_CHARS, summarizeIntentScenes } from './prompt-summary'
import type { Intent, Scene } from './schema'

const fullIntent = (): Intent => ({
  goal: 'signup',
  platform: 'tiktok',
  emotion: 'emotional',
  lengthSeconds: 15,
  cta: 'Download today',
  primaryMessage: 'Stop hunting 14 tender portals',
  supportingPoints: ['One inbox', 'Start a trial'],
  funnelStage: 'mof',
  kpi: 'trial starts',
  desiredBehaviour: 'start a 14-day trial',
  brandVoice: 'warm-authoritative',
  keywords: ['pdf', 'focus'],
  audience: {
    persona: 'parents',
    ageRange: [25, 40],
    context: 'first-time parents',
    awarenessStage: 'problem-aware',
    language: 'I cannot edit this PDF',
    primaryPain: 'stuck scans',
  },
})

const scenes = (): Scene[] =>
  [
    {
      id: 'sc_001',
      role: 'hook',
      label: 'Hook',
      intentNote: 'attention-grabbing pain moment',
      targetDurationFrames: 90,
      clipIds: ['c1'],
      overlayIds: [],
      locked: false,
    },
    {
      id: 'sc_002',
      role: 'problem',
      label: 'Problem',
      intentNote: 'surface the frustration',
      targetDurationFrames: 150,
      clipIds: [],
      overlayIds: [],
      locked: false,
    },
    {
      id: 'sc_003',
      role: 'solution',
      label: 'Solution',
      targetDurationFrames: 180,
      clipIds: ['c2', 'c3'],
      overlayIds: [],
      locked: false,
    },
    {
      id: 'sc_004',
      role: 'cta',
      label: 'CTA',
      intentNote: 'download prompt',
      targetDurationFrames: 60,
      clipIds: [],
      overlayIds: [],
      locked: true,
    },
  ] as Scene[]

describe('summarizeIntentScenes', () => {
  it('renders compact INTENT and SCENES blocks', () => {
    const block = summarizeIntentScenes(fullIntent(), scenes())
    expect(block).toMatch(/## Intent and scenes/)
    expect(block).toMatch(/INTENT/)
    expect(block).toMatch(/goal: signup/)
    expect(block).toMatch(/platform: tiktok/)
    expect(block).toMatch(/emotion: emotional/)
    expect(block).toMatch(/length: 15s/)
    expect(block).toMatch(
      /audience: parents \(25-40\) - first-time parents awareness: problem-aware language: I cannot edit this PDF pain: stuck scans/,
    )
    expect(block).toMatch(/primaryMessage: Stop hunting 14 tender portals/)
    expect(block).toMatch(/supportingPoints: One inbox; Start a trial/)
    expect(block).toMatch(/CTA: Download today/)
    expect(block).toMatch(/funnelStage: mof/)
    expect(block).toMatch(/kpi: trial starts/)
    expect(block).toMatch(/desiredBehaviour: start a 14-day trial/)
    expect(block).toMatch(/SCENES/)
    expect(block).toMatch(/sc_001 hook \(targetFrames 90\)/)
    expect(block).toMatch(/attention-grabbing pain moment/)
    expect(block).toMatch(/\[locked\]/)
    expect(block.length).toBeLessThanOrEqual(INTENT_SCENES_PROMPT_MAX_CHARS)
  })

  it('shows empty placeholder when nothing is set', () => {
    const block = summarizeIntentScenes({ keywords: [] }, [])
    expect(block).toMatch(/empty/)
    expect(block).toMatch(/set_intent/)
  })

  it('does not treat a funnel-only Intent as empty', () => {
    const block = summarizeIntentScenes({ keywords: [], funnelStage: 'tof' }, [])
    expect(block).toMatch(/funnelStage: tof/)
    expect(block).not.toMatch(/\(empty/)
  })

  it('respects maxChars by dropping notes then scenes', () => {
    const many: Scene[] = Array.from({ length: 40 }, (_, i) => ({
      id: `sc_${String(i).padStart(3, '0')}`,
      role: 'custom' as const,
      label: `Scene ${i}`,
      intentNote: 'x'.repeat(80),
      targetDurationFrames: 90,
      clipIds: ['c1'],
      overlayIds: [],
      locked: false,
    }))
    const block = summarizeIntentScenes(fullIntent(), many, 400)
    expect(block.length).toBeLessThanOrEqual(400)
    expect(block).toMatch(/INTENT/)
  })
})
