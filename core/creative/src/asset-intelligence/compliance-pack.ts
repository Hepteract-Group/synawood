/** Wave 2J / #589 — Analyze `compliance` pack (ADR-0053 §4). Does not block Approve. */

import type { SupabaseClient } from '@supabase/supabase-js'
import { listMarketingSkills } from '../agent/skills/select'
import { loadProductCatalogRow } from '../brand/product-copy-store'
import { forbiddenClaimLabels, lintCampaignClaims } from '../campaign/claim-lint'
import type { JsonSchemaObject } from './analyze-schema'
import type { ComplianceHit } from './compliance-hits'

export type { ComplianceHit } from './compliance-hits'
export { complianceHitsFromResult } from './compliance-hits'

export const COMPLIANCE_SCHEMA: JsonSchemaObject = {
  type: 'object',
  properties: {
    hits: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          timestampMs: { type: 'number' },
          kind: { type: 'string' },
          quote: { type: 'string' },
          visualNote: { type: 'string' },
          severity: { type: 'string' },
        },
        required: ['timestampMs', 'kind', 'severity'],
      },
    },
  },
  required: ['hits'],
}

export type CompliancePromptInput = {
  skillExcerpts?: string[]
  catalogLogos?: string[]
  catalogForbidden?: string[]
  overlayUnsafeVisuals?: string[]
}

export const HIPAA_COMPLIANCE_FIXTURE_HIT: ComplianceHit = {
  timestampMs: 1200,
  kind: 'claim',
  quote: 'HIPAA compliant PDF editor',
  visualNote: '',
  severity: 'high',
}

export const fixtureComplianceResult = (): Record<string, unknown> => ({
  hits: [HIPAA_COMPLIANCE_FIXTURE_HIT],
})

export const compliancePrompt = (input: CompliancePromptInput = {}): string => {
  const forbidden = [...forbiddenClaimLabels(), ...(input.catalogForbidden ?? [])]
    .map((row) => row.trim())
    .filter(Boolean)
  const logos = (input.catalogLogos ?? []).map((row) => row.trim()).filter(Boolean)
  const overlays = (input.overlayUnsafeVisuals ?? []).map((row) => row.trim()).filter(Boolean)
  const skills = (input.skillExcerpts ?? []).map((row) => row.trim()).filter(Boolean)
  return [
    'Flag on-screen or spoken claims that break the catalog.',
    `Forbidden copy patterns: ${forbidden.join(', ')}.`,
    logos.length > 0
      ? `Catalog product / logo names (flag competitor or off-brand marks): ${logos.join(', ')}.`
      : 'Also flag competitor or off-brand logos named in the catalog, and overlay-listed unsafe visuals.',
    overlays.length > 0 ? `Overlay unsafe visuals: ${overlays.join(' ')}` : '',
    skills.length > 0 ? `Claim skill:\n${skills.join('\n')}` : '',
    'Spoken-claim hits need quote. Logo/overlay hits may use visualNote without quote.',
    'Return hits only. Empty array if the footage is clean.',
    'This is a nudge for the editor, not a CCTV product and not an Approve block.',
  ]
    .filter(Boolean)
    .join(' ')
}

export const loadCompliancePromptContext = async (input: {
  productId: string
  supabase?: SupabaseClient
}): Promise<CompliancePromptInput> => {
  const [skills, catalog] = await Promise.all([
    listMarketingSkills(input.productId).catch(() => []),
    input.supabase
      ? loadProductCatalogRow(input.supabase, input.productId)
          .then((row) => row.catalog)
          .catch(() => null)
      : Promise.resolve(null),
  ])
  const claimSkills = skills.filter((skill) => skill.id === 'claim-vs-catalog')
  const overlaySkills = skills.filter((skill) => skill.id === 'privacy-claim-safety')
  const items = catalog?.items ?? []
  return {
    skillExcerpts: claimSkills.map((skill) => skill.excerpt),
    catalogLogos: items.map((item) => item.name),
    catalogForbidden: items.flatMap((item) => item.forbiddenClaims),
    overlayUnsafeVisuals: overlaySkills.map((skill) => skill.excerpt),
  }
}

export const complianceHitBreaksCatalog = (hit: ComplianceHit): boolean =>
  !lintCampaignClaims(hit.quote).ok
