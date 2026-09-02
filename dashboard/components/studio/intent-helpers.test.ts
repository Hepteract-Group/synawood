import { describe, expect, it } from 'vitest'
import {
  ageRangeFromInputs,
  hasIntentContent,
  intentPatchFromDraft,
  isEmptyIntentPatch,
  structuralDiffLines,
  styleFromIntent,
  summarizeIntentChip,
  supportingPointsFromSlots,
} from './intent-helpers'

describe('intent-helpers', () => {
  it('detects empty vs populated intent', () => {
    expect(hasIntentContent({ keywords: [] })).toBe(false)
    expect(hasIntentContent({ keywords: [], emotion: 'urgent' })).toBe(true)
    expect(hasIntentContent({ keywords: [], funnelStage: 'tof' })).toBe(true)
    expect(hasIntentContent({ keywords: [], kpi: 'trial starts' })).toBe(true)
    expect(hasIntentContent({ keywords: [], desiredBehaviour: 'start a trial' })).toBe(true)
    expect(
      hasIntentContent({
        keywords: [],
        audience: { awarenessStage: 'problem-aware', primaryPain: 'uneditable scans' },
      }),
    ).toBe(true)
    expect(hasIntentContent({ keywords: [], primaryMessage: 'Stop hunting portals' })).toBe(true)
  })

  it('summarizes the chip line', () => {
    expect(
      summarizeIntentChip({
        keywords: [],
        platform: 'tiktok',
        lengthSeconds: 15,
        emotion: 'emotional',
        cta: 'Download today',
      }),
    ).toContain('Tiktok')
  })

  it('diffs structural fields', () => {
    const lines = structuralDiffLines(
      { keywords: [], emotion: 'exciting' },
      { keywords: [], emotion: 'emotional' },
    )
    expect(lines).toEqual([{ key: 'emotion', from: 'exciting', to: 'emotional' }])
  })

  it('maps emotion to director vibe style', () => {
    expect(styleFromIntent({ keywords: [], emotion: 'urgent' })).toBe('urgent')
    expect(styleFromIntent({ keywords: [], emotion: 'trustworthy' })).toBe('premium')
  })

  it('builds delta patches and age ranges', () => {
    const patch = intentPatchFromDraft(
      { keywords: [], goal: 'signup' },
      { keywords: [], goal: 'purchase', emotion: 'urgent' },
    )
    expect(patch).toEqual({ goal: 'purchase', emotion: 'urgent' })
    expect(isEmptyIntentPatch(intentPatchFromDraft({ keywords: [] }, { keywords: [] }))).toBe(true)
    expect(ageRangeFromInputs('25', '40')).toEqual([25, 40])
    expect(ageRangeFromInputs('25', '')).toBeUndefined()
    expect(ageRangeFromInputs('40', '25')).toEqual([25, 40])
    expect(supportingPointsFromSlots('One inbox', 'Start a trial')).toEqual([
      'One inbox',
      'Start a trial',
    ])
    expect(supportingPointsFromSlots('  ', '')).toBeUndefined()
  })
})
