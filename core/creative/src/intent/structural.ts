import type { Intent } from './schema'

export const STRUCTURAL_INTENT_KEYS = ['goal', 'platform', 'emotion', 'lengthSeconds'] as const

export type StructuralIntentKey = (typeof STRUCTURAL_INTENT_KEYS)[number]

export type StructuralIntentDiff = {
  key: StructuralIntentKey
  from: string
  to: string
}

export const structuralDiffLines = (before: Intent, after: Intent): StructuralIntentDiff[] => {
  const lines: StructuralIntentDiff[] = []
  for (const key of STRUCTURAL_INTENT_KEYS) {
    const a = before[key]
    const b = after[key]
    if (JSON.stringify(a ?? null) === JSON.stringify(b ?? null)) continue
    lines.push({
      key,
      from: a == null ? 'unset' : String(a),
      to: b == null ? 'unset' : String(b),
    })
  }
  return lines
}

export const formatStructuralDiffLines = (diffs: StructuralIntentDiff[]): string[] =>
  diffs.map((diff) => `${diff.key}: ${diff.from} → ${diff.to}`)
