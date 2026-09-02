import type { ExtractedBrief } from '../brief/extracted-brief'
import type { VariantSpec } from './schema'

export type ResolvedVariantCopy = {
  hookText: string
  ctaText: string
}

const resolveIndexed = (input: {
  label: string
  override?: string
  index: number
  candidates: string[]
  fallback?: string
}): string => {
  const fromOverride = input.override?.trim()
  if (fromOverride) return fromOverride
  if (input.index >= 0 && input.index < input.candidates.length) {
    const text = input.candidates[input.index]!.trim()
    if (text) return text
  }
  const fromFallback = input.fallback?.trim()
  if (fromFallback) return fromFallback
  throw new Error(
    `Variant ${input.label} index ${input.index} is out of range (brief has ${input.candidates.length} ${input.label}s)`,
  )
}

export const resolveVariantCopy = (input: {
  spec: VariantSpec
  brief: ExtractedBrief
}): ResolvedVariantCopy => {
  const hookText = resolveIndexed({
    label: 'hook',
    override: input.spec.hookOverride,
    index: input.spec.hookIndex,
    candidates: input.brief.messaging.hookCandidates,
  })
  const ctaText = resolveIndexed({
    label: 'CTA',
    override: input.spec.ctaOverride,
    index: input.spec.ctaIndex,
    candidates: input.brief.messaging.ctaCandidates,
    fallback: input.brief.brandCandidates.defaultCta,
  })
  return { hookText, ctaText }
}
