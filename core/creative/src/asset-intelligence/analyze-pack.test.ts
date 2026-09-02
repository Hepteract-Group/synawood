import { describe, expect, it } from 'vitest'
import { analyzeSchemaId } from './analyze-schema'
import { fixtureAnalyzePackResult, resolveAnalyzePack } from './analyze-pack'
import { COMPLIANCE_SCHEMA, HIPAA_COMPLIANCE_FIXTURE_HIT } from './compliance-pack'

describe('analyze pack fixtures (#816)', () => {
  it('pins kind=compliance to the HIPAA fixture, not generic empty arrays', () => {
    const pack = resolveAnalyzePack({
      kind: 'compliance',
      prompt: 'scan this take',
    })
    expect(pack.schemaId).toBe(analyzeSchemaId(COMPLIANCE_SCHEMA))
    expect(fixtureAnalyzePackResult({ kind: 'compliance', schema: pack.schema })).toEqual({
      hits: [HIPAA_COMPLIANCE_FIXTURE_HIT],
    })
  })

  it('keeps generic schema fixtures for custom kind', () => {
    const schema = {
      type: 'object',
      properties: { summary: { type: 'string' } },
      required: ['summary'],
    }
    expect(fixtureAnalyzePackResult({ kind: 'custom', schema })).toMatchObject({
      summary: expect.stringMatching(/ci-stub/i),
    })
  })
})
