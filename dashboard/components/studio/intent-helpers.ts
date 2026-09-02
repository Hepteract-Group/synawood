import {
  intentAwarenessStageSchema,
  intentHasContent,
  type Intent,
  type IntentAwarenessStage,
  type IntentEmotion,
  type IntentFunnelStage,
  type IntentGoal,
  type IntentPlatform,
} from '@synawood/creative/intent'
export {
  formatStructuralDiffLines,
  STRUCTURAL_INTENT_KEYS,
  structuralDiffLines,
} from '@synawood/creative/intent'
export type { StructuralIntentDiff, StructuralIntentKey } from '@synawood/creative/intent'

export const INTENT_FUNNEL_STAGES: IntentFunnelStage[] = ['tof', 'mof', 'bof']

export const funnelStageLabel = (stage: IntentFunnelStage): string =>
  ({ tof: 'Top', mof: 'Middle', bof: 'Bottom' })[stage]

export const INTENT_AWARENESS_STAGES = intentAwarenessStageSchema.options

export const awarenessStageLabel = (stage: IntentAwarenessStage): string =>
  ({
    unaware: 'Unaware',
    'problem-aware': 'Problem',
    'solution-aware': 'Solution',
    'product-aware': 'Product',
    'most-aware': 'Most aware',
  })[stage]

export const audienceHasContent = (audience: Intent['audience']): boolean =>
  Boolean(
    audience?.persona ||
    audience?.context ||
    audience?.ageRange ||
    audience?.awarenessStage ||
    audience?.language ||
    audience?.primaryPain,
  )

export const INTENT_GOALS: IntentGoal[] = [
  'awareness',
  'consideration',
  'signup',
  'purchase',
  'retention',
  'custom',
]

export const INTENT_PLATFORMS: IntentPlatform[] = [
  'tiktok',
  'ig_reels',
  'yt_shorts',
  'meta_feed',
  'linkedin',
  'x',
  'youtube',
  'landing',
]

export const INTENT_EMOTIONS: IntentEmotion[] = [
  'exciting',
  'emotional',
  'trustworthy',
  'humorous',
  'urgent',
  'calm',
  'aspirational',
  'informative',
]

const INTENT_PATCH_KEYS = [
  'goal',
  'goalNote',
  'funnelStage',
  'kpi',
  'desiredBehaviour',
  'audience',
  'platform',
  'emotion',
  'lengthSeconds',
  'cta',
  'primaryMessage',
  'supportingPoints',
  'brandVoice',
  'keywords',
] as const satisfies readonly (keyof Intent)[]

export const hasIntentContent = (intent: Intent | undefined | null): boolean => {
  if (!intent) return false
  return intentHasContent(intent)
}

export const summarizeIntentChip = (intent: Intent): string => {
  const bits: string[] = []
  if (intent.platform) bits.push(labelToken(intent.platform))
  if (intent.lengthSeconds) bits.push(`${intent.lengthSeconds}s`)
  if (intent.emotion) bits.push(intent.emotion)
  if (intent.goal === 'custom' && intent.goalNote) bits.push(intent.goalNote)
  else if (intent.goal) bits.push(labelToken(intent.goal))
  if (intent.funnelStage) bits.push(funnelStageLabel(intent.funnelStage))
  if (intent.kpi) bits.push(intent.kpi)
  const audience = intent.audience?.persona
  const ages = intent.audience?.ageRange
  if (audience && ages) bits.push(`${audience} ${ages[0]}-${ages[1]}`)
  else if (audience) bits.push(audience)
  else if (ages) bits.push(`${ages[0]}-${ages[1]}`)
  if (intent.audience?.awarenessStage)
    bits.push(awarenessStageLabel(intent.audience.awarenessStage))
  if (intent.primaryMessage) bits.push(intent.primaryMessage)
  if (intent.cta) bits.push(`CTA "${intent.cta}"`)
  return bits.length > 0 ? bits.join(' · ') : 'Not set yet'
}

export const labelToken = (value: string): string =>
  value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

/** Only fields that differ — empty object means skip save (avoids no-op tool errors). */
export const intentPatchFromDraft = (baseline: Intent, draft: Intent): Partial<Intent> => {
  const patch: Partial<Intent> = {}
  for (const key of INTENT_PATCH_KEYS) {
    const before = baseline[key]
    const after = draft[key]
    if (JSON.stringify(before ?? null) === JSON.stringify(after ?? null)) continue
    Object.assign(patch, { [key]: after })
  }
  return patch
}

export const isEmptyIntentPatch = (patch: Partial<Intent>): boolean =>
  Object.keys(patch).length === 0

/** Map Intent emotion → director-vibes style hint. */
export const styleFromIntent = (intent: Intent): string | undefined => {
  if (!intent.emotion) return undefined
  const map: Partial<Record<IntentEmotion, string>> = {
    urgent: 'urgent',
    exciting: 'energetic',
    emotional: 'cinematic',
    trustworthy: 'premium',
    calm: 'premium',
    informative: 'informative',
    aspirational: 'cinematic',
    humorous: 'energetic',
  }
  return map[intent.emotion] ?? intent.emotion
}

export const parseAgeInput = (raw: string): number | undefined => {
  const trimmed = raw.trim()
  if (trimmed === '') return undefined
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n < 0 || n > 120) return undefined
  return Math.floor(n)
}

export const ageRangeFromInputs = (
  fromRaw: string,
  toRaw: string,
): [number, number] | undefined => {
  const lo = parseAgeInput(fromRaw)
  const hi = parseAgeInput(toRaw)
  if (lo == null || hi == null) return undefined
  return [Math.min(lo, hi), Math.max(lo, hi)]
}

export const supportingPointsFromSlots = (slot0: string, slot1: string): string[] | undefined => {
  const points = [slot0, slot1].map((value) => value.trim()).filter((value) => value.length > 0)
  return points.length > 0 ? points.slice(0, 2) : undefined
}
