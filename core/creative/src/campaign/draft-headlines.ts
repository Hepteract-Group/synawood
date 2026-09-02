/** Deterministic Path C headline variants from a campaign brief (#471). */

import { rewriteForbiddenClaims } from './claim-lint'

const ANGLE_TEMPLATES: Array<(seed: string) => string> = [
  (seed) => seed,
  (seed) => `What if ${uncapitalize(seed)}?`,
  (seed) => `${seed} — without the chaos`,
  (seed) => `Still stuck on ${shortNoun(seed)}?`,
  (seed) => `Try a calmer take on ${shortNoun(seed)}`,
  (seed) => `${seed}. Make it stick.`,
  (seed) => `One change: ${shortNoun(seed)}`,
  (seed) => `From overwhelm to ${shortNoun(seed)}`,
  (seed) => `${seed} for busy days`,
  (seed) => `Proof over promises: ${shortNoun(seed)}`,
  (seed) => `Keep ${shortNoun(seed)} simple`,
  (seed) => `${seed} — start here`,
]

const uncapitalize = (text: string): string => {
  if (!text) return text
  return text.charAt(0).toLowerCase() + text.slice(1)
}

const shortNoun = (seed: string): string => {
  const words = seed.split(/\s+/).filter(Boolean)
  if (words.length <= 4) return uncapitalize(seed)
  return uncapitalize(words.slice(0, 4).join(' '))
}

const sanitizeHeadline = (raw: string): string => {
  const rewritten = rewriteForbiddenClaims(raw.trim().replace(/\s+/g, ' '))
  return rewritten.text.slice(0, 120)
}

/**
 * Build up to `count` distinct headlines from the brief prompt.
 * No LLM — angles are template-based so packs stay free on ci-stub.
 */
export const draftHeadlinesFromBrief = (prompt: string, count: number): string[] => {
  const n = Math.min(12, Math.max(1, count))
  const seed = prompt.trim().replace(/\s+/g, ' ').slice(0, 80) || 'Your next creative'
  const out: string[] = []
  const seen = new Set<string>()
  for (let i = 0; i < ANGLE_TEMPLATES.length && out.length < n; i += 1) {
    const candidate = sanitizeHeadline(ANGLE_TEMPLATES[i]!(seed))
    const key = candidate.toLowerCase()
    if (!candidate || seen.has(key)) continue
    seen.add(key)
    out.push(candidate)
  }
  while (out.length < n) {
    const fallback = sanitizeHeadline(`${seed} · variant ${out.length + 1}`)
    if (!seen.has(fallback.toLowerCase())) {
      seen.add(fallback.toLowerCase())
      out.push(fallback)
    } else {
      out.push(`Variant ${out.length + 1}`)
    }
  }
  return out
}
