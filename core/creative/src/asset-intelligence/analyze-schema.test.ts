import { describe, expect, it } from 'vitest'
import {
  ANALYZE_KINDS,
  analyzeSchemaId,
  fixtureAnalyzeResult,
  parseAnalyzeJsonResult,
  validateAnalyzeResult,
} from './analyze-schema'

describe('analyze schema (#585)', () => {
  it('pins the four analysis kinds', () => {
    expect(ANALYZE_KINDS).toEqual(['segment', 'compliance', 'highlight', 'custom'])
  })

  it('hashes the same schema to a stable schema_id', () => {
    const schema = { type: 'object', properties: { summary: { type: 'string' } } }
    expect(analyzeSchemaId(schema)).toBe(analyzeSchemaId({ ...schema }))
    expect(analyzeSchemaId(schema)).not.toBe(
      analyzeSchemaId({ type: 'object', properties: { title: { type: 'string' } } }),
    )
  })

  it('parses a JSON object from VLM text and checks required keys', () => {
    const schema = {
      type: 'object',
      properties: { summary: { type: 'string' } },
      required: ['summary'],
    }
    expect(
      validateAnalyzeResult(parseAnalyzeJsonResult('{"summary":"a still of the product"}'), schema),
    ).toEqual({ summary: 'a still of the product' })
  })

  it('rejects JSON missing required schema keys', () => {
    const schema = {
      type: 'object',
      properties: { summary: { type: 'string' } },
      required: ['summary'],
    }
    expect(() => validateAnalyzeResult({ other: 'x' }, schema)).toThrow(/summary/)
  })

  it('builds a ci-stub fixture that satisfies the summary schema', () => {
    const schema = {
      type: 'object',
      properties: { summary: { type: 'string' } },
      required: ['summary'],
    }
    const fixture = fixtureAnalyzeResult(schema)
    expect(validateAnalyzeResult(fixture, schema)).toMatchObject({
      summary: expect.stringMatching(/ci-stub/i),
    })
  })
})
