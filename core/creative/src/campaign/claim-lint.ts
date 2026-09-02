/** Claim lint for Campaign Pack copy (#112). */

export type ClaimLintHit = {
  pattern: string
  match: string
  suggestion: string
}

const FORBIDDEN: Array<{ pattern: RegExp; label: string; suggestion: string }> = [
  {
    pattern: /\bhipaa[\s-]?compliant\b/i,
    label: 'HIPAA compliant',
    suggestion: 'Drop compliance claims unless listed in product marketing.',
  },
  {
    pattern: /\bsoc\s*2\b/i,
    label: 'SOC 2',
    suggestion: 'Do not claim SOC 2 unless verified in product marketing.',
  },
  {
    pattern: /\bguaranteed\b/i,
    label: 'guaranteed',
    suggestion: 'Replace "guaranteed" with a concrete, honest benefit.',
  },
  {
    pattern: /#\s*1\b|\bnumber\s+one\b|\bworld'?s\s+best\b/i,
    label: 'superlative ranking',
    suggestion: "Avoid unverified rankings (#1 / world's best).",
  },
  {
    pattern: /\bnever\s+fails\b|\b100%\s+safe\b/i,
    label: 'absolute safety',
    suggestion: 'Avoid absolute safety claims.',
  },
  {
    pattern: /\bcures?\b|\bdiagnos(?:e|is|es)\b/i,
    label: 'medical claim',
    suggestion: 'Remove medical cure/diagnosis language.',
  },
]

export const forbiddenClaimLabels = (): string[] => FORBIDDEN.map((row) => row.label)

export const lintCampaignClaims = (text: string): { ok: boolean; hits: ClaimLintHit[] } => {
  const hits: ClaimLintHit[] = []
  for (const row of FORBIDDEN) {
    const match = text.match(row.pattern)
    if (match) {
      hits.push({
        pattern: row.label,
        match: match[0]!,
        suggestion: row.suggestion,
      })
    }
  }
  return { ok: hits.length === 0, hits }
}

/** Soft rewrite: strip known forbidden phrases; caller should re-lint. */
export const rewriteForbiddenClaims = (text: string): { text: string; changed: boolean } => {
  let next = text
  let changed = false
  for (const row of FORBIDDEN) {
    if (row.pattern.test(next)) {
      next = next
        .replace(row.pattern, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
      changed = true
    }
  }
  return { text: next, changed }
}
