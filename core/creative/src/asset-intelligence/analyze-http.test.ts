import { describe, expect, it } from 'vitest'
import { MISSING_THUMBS_ANALYZE_ERROR } from './analyze-asset'
import { mapAnalyzeHttpError, parseAnalyzeGetQuery, parseAnalyzePostBody } from './analyze-http'

const assetId = '11111111-1111-4111-8111-111111111111'
const schema = {
  type: 'object',
  properties: { summary: { type: 'string' } },
  required: ['summary'],
}

describe('parseAnalyzePostBody (#586)', () => {
  it('accepts editor body with product, prompt, and schema', () => {
    expect(
      parseAnalyzePostBody({
        productId: 'demo',
        prompt: 'Summarize the still',
        schema,
      }),
    ).toMatchObject({
      productId: 'demo',
      prompt: 'Summarize the still',
      schema,
    })
  })

  it('accepts shotId / startMs / endMs window fields', () => {
    expect(
      parseAnalyzePostBody({
        productId: 'demo',
        prompt: 'Summarize the still',
        schema,
        shotId: assetId,
        startMs: 0,
        endMs: 2000,
      }),
    ).toMatchObject({ shotId: assetId, startMs: 0, endMs: 2000 })
  })

  it('rejects missing productId', () => {
    expect(() =>
      parseAnalyzePostBody({
        prompt: 'Summarize the still',
        schema,
      }),
    ).toThrow(/productId/)
  })

  it('rejects missing prompt', () => {
    expect(() =>
      parseAnalyzePostBody({
        productId: 'demo',
        schema,
      }),
    ).toThrow(/prompt/)
  })

  it('accepts kind=compliance without a caller schema (#660)', () => {
    expect(
      parseAnalyzePostBody({
        productId: 'demo',
        prompt: 'scan this take',
        kind: 'compliance',
      }),
    ).toMatchObject({ productId: 'demo', kind: 'compliance' })
  })

  it('rejects a non-object schema', () => {
    expect(() =>
      parseAnalyzePostBody({
        productId: 'demo',
        prompt: 'Summarize',
        schema: 'not-json-schema',
      }),
    ).toThrow()
  })
})

describe('parseAnalyzeGetQuery (#586)', () => {
  it('requires productId', () => {
    expect(() => parseAnalyzeGetQuery({})).toThrow(/productId/)
  })

  it('accepts productId without kind', () => {
    expect(parseAnalyzeGetQuery({ productId: 'demo' })).toEqual({
      productId: 'demo',
    })
    expect(parseAnalyzeGetQuery({ productId: 'demo', kind: undefined })).toEqual({
      productId: 'demo',
    })
  })

  it('accepts optional kind', () => {
    expect(parseAnalyzeGetQuery({ productId: 'demo', kind: 'custom' })).toEqual({
      productId: 'demo',
      kind: 'custom',
    })
  })
})

describe('mapAnalyzeHttpError (#586)', () => {
  it('maps unconfirmed spend to 402', () => {
    expect(
      mapAnalyzeHttpError(
        new Error('Estimated £0.0123 needs confirmSpend=true before analyze_asset.'),
      ),
    ).toEqual({
      status: 402,
      message: 'Estimated £0.0123 needs confirmSpend=true before analyze_asset.',
    })
  })

  it('maps missing thumbs to 400', () => {
    expect(mapAnalyzeHttpError(new Error(MISSING_THUMBS_ANALYZE_ERROR))).toEqual({
      status: 400,
      message: MISSING_THUMBS_ANALYZE_ERROR,
    })
  })

  it('maps missing asset to 404', () => {
    expect(mapAnalyzeHttpError(new Error(`No asset ${assetId} in this product`))).toEqual({
      status: 404,
      message: `No asset ${assetId} in this product`,
    })
  })
})
