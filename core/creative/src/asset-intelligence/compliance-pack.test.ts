import { describe, expect, it } from 'vitest'
import { lintCampaignClaims } from '../campaign/claim-lint'
import {
  COMPLIANCE_SCHEMA,
  complianceHitBreaksCatalog,
  complianceHitsFromResult,
  compliancePrompt,
  HIPAA_COMPLIANCE_FIXTURE_HIT,
  loadCompliancePromptContext,
  fixtureComplianceResult,
} from './compliance-pack'

describe('visual compliance pack (#589)', () => {
  it('flags a HIPAA-compliant on-screen quote', () => {
    const hits = complianceHitsFromResult({
      hits: [
        {
          timestampMs: 1200,
          kind: 'claim',
          quote: 'HIPAA compliant PDF editor',
          severity: 'high',
        },
      ],
    })
    expect(hits).toHaveLength(1)
    expect(complianceHitBreaksCatalog(hits[0]!)).toBe(true)
    expect(lintCampaignClaims(hits[0]!.quote).ok).toBe(false)
    expect(hits[0]).toMatchObject(HIPAA_COMPLIANCE_FIXTURE_HIT)
  })

  it('returns the HIPAA fixture as ci-stub Analyze JSON', () => {
    expect(fixtureComplianceResult()).toEqual({ hits: [HIPAA_COMPLIANCE_FIXTURE_HIT] })
  })

  it('treats a clean the private example UI still as no hit', () => {
    expect(complianceHitsFromResult({ hits: [] })).toEqual([])
    expect(complianceHitsFromResult({ hits: [{ timestampMs: 0 }] })).toEqual([])
  })

  it('loads claim skill + catalog logos into the Analyze prompt', async () => {
    expect(compliancePrompt()).toMatch(/HIPAA compliant/)
    expect(compliancePrompt()).toMatch(/Approve block/)
    expect(COMPLIANCE_SCHEMA.required).toEqual(['hits'])
    const from = (table: string) => {
      const builder: Record<string, unknown> = {}
      builder.select = () => builder
      builder.eq = () => builder
      builder.maybeSingle = async () => ({ data: table === 'products' ? null : null, error: null })
      return builder
    }
    const ctx = await loadCompliancePromptContext({
      productId: 'demo',
      supabase: { from } as never,
    })
    const prompt = compliancePrompt(ctx)
    expect(prompt).toMatch(/HIPAA compliant/)
    expect(ctx.skillExcerpts?.some((row) => /HIPAA/i.test(row))).toBe(true)
  })

  it('drops a spoken-claim hit that has no quote (#663)', () => {
    expect(
      complianceHitsFromResult({
        hits: [
          {
            timestampMs: 200,
            kind: 'claim',
            quote: '',
            visualNote: 'on-screen HIPAA badge',
            severity: 'high',
          },
        ],
      }),
    ).toEqual([])
  })

  it('keeps a logo visualNote when quote is empty (#663)', () => {
    const hits = complianceHitsFromResult({
      hits: [
        {
          timestampMs: 400,
          kind: 'logo',
          visualNote: 'competitor mark',
          severity: 'warn',
        },
      ],
    })
    expect(hits).toEqual([
      {
        timestampMs: 400,
        kind: 'logo',
        quote: '',
        visualNote: 'competitor mark',
        severity: 'warn',
      },
    ])
  })
})
