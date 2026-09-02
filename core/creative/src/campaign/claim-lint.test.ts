import { describe, expect, it } from 'vitest'
import { lintCampaignClaims, rewriteForbiddenClaims } from './claim-lint'

describe('claim-lint (#112)', () => {
  it('accepts safe job-to-be-done copy', () => {
    expect(lintCampaignClaims('Edit PDFs without Adobe').ok).toBe(true)
  })

  it('rejects forbidden compliance claims', () => {
    const result = lintCampaignClaims('HIPAA compliant PDF editing, guaranteed')
    expect(result.ok).toBe(false)
    expect(result.hits.map((hit) => hit.pattern)).toEqual(
      expect.arrayContaining(['HIPAA compliant', 'guaranteed']),
    )
  })

  it('rewrites forbidden phrases before ready', () => {
    const rewritten = rewriteForbiddenClaims('Bank-grade #1 tool, never fails')
    expect(rewritten.changed).toBe(true)
    expect(lintCampaignClaims(rewritten.text).ok).toBe(true)
  })
})
