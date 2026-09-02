/** Claim scanner over project text + policy rules (#313). */

import { authoredOnScreenText } from '../authored/on-screen-text'
import type { StudioProject } from '../project/schema'
import { lintCampaignClaims } from '../campaign/claim-lint'
import type { ClaimRule, ClaimScanHit, ClaimScanResult, GovernancePolicyBody } from './schema'

const collectProjectText = (project: StudioProject): Array<{ source: string; text: string }> => {
  const chunks: Array<{ source: string; text: string }> = []
  const intent = project.intent
  if (intent.goalNote) chunks.push({ source: 'intent.goalNote', text: intent.goalNote })
  if (intent.cta) chunks.push({ source: 'intent.cta', text: intent.cta })
  if (intent.brandVoice) chunks.push({ source: 'intent.brandVoice', text: intent.brandVoice })
  for (const keyword of intent.keywords ?? []) {
    chunks.push({ source: 'intent.keyword', text: keyword })
  }
  for (const scene of project.scenes ?? []) {
    if (scene.label) chunks.push({ source: `scene.${scene.id}.label`, text: scene.label })
    if (scene.intentNote) {
      chunks.push({ source: `scene.${scene.id}.intentNote`, text: scene.intentNote })
    }
  }
  for (const overlay of project.overlays) {
    if (overlay.text?.trim()) {
      chunks.push({ source: `overlay.${overlay.kind}`, text: overlay.text })
    }
  }
  const authoredSource = project.compositionSource?.source
  if (authoredSource) {
    for (const text of authoredOnScreenText(authoredSource)) {
      chunks.push({ source: 'compositionSource.kit', text })
    }
  }
  for (const slide of project.slideshow?.slides ?? []) {
    if (slide.headline?.trim()) {
      chunks.push({ source: `slide.${slide.order}.headline`, text: slide.headline })
    }
    if (slide.body?.trim()) {
      chunks.push({ source: `slide.${slide.order}.body`, text: slide.body })
    }
  }
  const brief = project.brief
  if (brief) {
    if (brief.product.oneLiner) {
      chunks.push({ source: 'brief.oneLiner', text: brief.product.oneLiner })
    }
    for (const [index, benefit] of brief.product.benefits.entries()) {
      chunks.push({ source: `brief.benefit.${index}`, text: benefit })
    }
    for (const [index, hook] of brief.messaging.hookCandidates.entries()) {
      chunks.push({ source: `brief.hook.${index}`, text: hook })
    }
    for (const [index, cta] of brief.messaging.ctaCandidates.entries()) {
      chunks.push({ source: `brief.cta.${index}`, text: cta })
    }
  }
  return chunks
}

const scanWithRules = (
  chunks: Array<{ source: string; text: string }>,
  rules: ClaimRule[],
): ClaimScanHit[] => {
  const hits: ClaimScanHit[] = []
  for (const rule of rules) {
    let regex: RegExp
    try {
      regex = new RegExp(rule.pattern, 'i')
    } catch {
      continue
    }
    for (const chunk of chunks) {
      const match = chunk.text.match(regex)
      if (match) {
        hits.push({
          ruleId: rule.id,
          severity: rule.severity,
          match: match[0]!,
          suggestion: rule.suggestion,
          source: chunk.source,
        })
      }
    }
  }
  return hits
}

/** Merge policy rules with campaign lint defaults (as block severity). */
export const scanProjectClaims = (
  project: StudioProject,
  policy: GovernancePolicyBody,
): ClaimScanResult => {
  const chunks = collectProjectText(project)
  const combined = chunks.map((c) => c.text).join('\n')
  const locale = project.localization?.activeLocale ?? project.localization?.defaultLocale ?? 'en'
  const applicableRules = policy.claimRules.filter(
    (rule) => !rule.locales?.length || rule.locales.includes(locale),
  )
  const policyHits = scanWithRules(chunks, applicableRules)
  const lint = lintCampaignClaims(combined)
  const defaultHits: ClaimScanHit[] = lint.hits.map((hit) => ({
    ruleId: `default:${hit.pattern}`,
    severity: 'block' as const,
    match: hit.match,
    suggestion: hit.suggestion,
    source: 'combined',
  }))

  const hits = [...policyHits]
  for (const hit of defaultHits) {
    if (!hits.some((existing) => existing.ruleId === hit.ruleId && existing.match === hit.match)) {
      hits.push(hit)
    }
  }

  const blocked = hits.some((hit) => hit.severity === 'block')
  return {
    ok: !blocked,
    hits,
    scannedAt: new Date().toISOString(),
  }
}

export const assertClaimScanClear = (scan: ClaimScanResult): void => {
  if (scan.ok) return
  const blockers = scan.hits.filter((hit) => hit.severity === 'block')
  const summary = blockers
    .slice(0, 3)
    .map((hit) => `${hit.ruleId} (“${hit.match}” @ ${hit.source ?? '?'})`)
    .join('; ')
  throw new Error(
    `Approve blocked by claim scanner (${blockers.length} finding(s)): ${summary}. ${blockers[0]?.suggestion ?? ''}`,
  )
}
