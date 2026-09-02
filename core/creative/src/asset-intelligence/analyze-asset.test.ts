import { describe, expect, it, vi } from 'vitest'
import { analyzeAsset, MISSING_THUMBS_ANALYZE_ERROR } from './analyze-asset'
import { analyzeSchemaId } from './analyze-schema'
import { COMPLIANCE_SCHEMA, HIPAA_COMPLIANCE_FIXTURE_HIT } from './compliance-pack'

const assetId = '11111111-1111-4111-8111-111111111111'
const shotId = '22222222-2222-4222-8222-222222222222'
const schema = {
  type: 'object',
  properties: { summary: { type: 'string' } },
  required: ['summary'],
}

const thenable = (data: unknown = null, error: unknown = null) => ({
  then: (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
    Promise.resolve({ data, error }).then(resolve),
})

const analyzeClient = (opts: { thumb?: string | null; inserts?: unknown[] }) => {
  const inserts = opts.inserts ?? []
  const from = vi.fn((table: string) => {
    const builder: Record<string, unknown> = {}
    builder.select = vi.fn(() => builder)
    builder.eq = vi.fn(() => builder)
    builder.order = vi.fn(() => builder)
    builder.maybeSingle = vi.fn(async () => {
      if (table === 'assets') return { data: { id: assetId, kind: 'image' }, error: null }
      if (table === 'asset_index_state') {
        return { data: { transcript_excerpt: 'tap export', transcript_segments: [] }, error: null }
      }
      return { data: null, error: null }
    })
    builder.delete = vi.fn(() => builder)
    builder.insert = vi.fn((row: unknown) => {
      inserts.push(row)
      return thenable(null, null)
    })
    Object.assign(
      builder,
      thenable(
        table === 'asset_shots'
          ? [
              {
                id: shotId,
                start_ms: 0,
                end_ms: 2000,
                thumb_blob_key:
                  opts.thumb === undefined ? 'uploads/a/shot-0-thumb.jpg' : opts.thumb,
              },
            ]
          : [],
        null,
      ),
    )
    return builder
  })
  return { from, inserts }
}

describe('analyzeAsset (#585)', () => {
  it('returns schema-valid JSON with timestamps on ci-stub and persists a row', async () => {
    const client = analyzeClient({})
    const out = await analyzeAsset({
      supabase: client as never,
      productId: 'demo',
      modelProfileId: 'ci-stub',
      assetId,
      prompt: 'Summarise this still',
      schema,
    })
    expect(out.result.summary).toMatch(/ci-stub/i)
    expect(out.startMs).toBe(0)
    expect(out.endMs).toBe(2000)
    expect(out.shotId).toBe(shotId)
    expect(client.inserts).toHaveLength(1)
    expect(client.inserts[0]).toMatchObject({
      asset_id: assetId,
      kind: 'custom',
      model_id: 'mock-caption',
    })
  })

  it('errors with a reindex hint when thumbs are missing', async () => {
    const client = analyzeClient({ thumb: null })
    await expect(
      analyzeAsset({
        supabase: client as never,
        productId: 'demo',
        modelProfileId: 'ci-stub',
        assetId,
        prompt: 'Summarise',
        schema,
      }),
    ).rejects.toThrow(MISSING_THUMBS_ANALYZE_ERROR)
    expect(client.inserts).toHaveLength(0)
  })

  it('refuses a live profile without confirmSpend and does not write', async () => {
    const client = analyzeClient({})
    await expect(
      analyzeAsset({
        supabase: client as never,
        productId: 'demo',
        modelProfileId: 'balanced',
        assetId,
        prompt: 'Summarise',
        schema,
      }),
    ).rejects.toThrow(/confirm/i)
    expect(client.inserts).toHaveLength(0)
  })

  it('parses a live VLM JSON response when generateText is injected', async () => {
    const client = analyzeClient({})
    const generateText = vi.fn(async () => ({
      text: '```json\n{"summary":"a still of the product"}\n```',
    }))
    const out = await analyzeAsset(
      {
        supabase: client as never,
        blobEnv: {
          connectionString: 'x',
          containerName: 'c',
          useLocalPrefix: true,
          accountName: 'a',
          accountKey: 'k',
        },
        productId: 'demo',
        modelProfileId: 'balanced',
        assetId,
        prompt: 'Summarise',
        schema,
        confirmSpend: true,
      },
      {
        getBlobBytes: async () => Buffer.from('jpeg-thumb'),
        generateText: generateText as never,
      },
    )
    expect(out.result).toEqual({ summary: 'a still of the product' })
    expect(generateText).toHaveBeenCalled()
    expect(client.inserts[0]).toMatchObject({
      result: { summary: 'a still of the product' },
    })
    expect(client.inserts.some((row) => (row as { role?: string }).role === 'analyze')).toBe(true)
  })

  it('pins kind=compliance to COMPLIANCE_SCHEMA even if the caller sent a custom schema (#660)', async () => {
    const client = analyzeClient({})
    const out = await analyzeAsset({
      supabase: client as never,
      productId: 'demo',
      modelProfileId: 'ci-stub',
      assetId,
      kind: 'compliance',
      prompt: 'scan this take',
      schema: { type: 'object', properties: { summary: { type: 'string' } } },
      schemaId: 'caller-override',
    })
    expect(out.kind).toBe('compliance')
    expect(out.result).toHaveProperty('hits')
    expect(out.result.hits).toEqual([HIPAA_COMPLIANCE_FIXTURE_HIT])
    expect(out.result).not.toHaveProperty('summary')
    expect(out.schemaId).toBe(analyzeSchemaId(COMPLIANCE_SCHEMA))
    expect(client.inserts[0]).toMatchObject({
      kind: 'compliance',
      schema_id: analyzeSchemaId(COMPLIANCE_SCHEMA),
    })
  })

  it('injects COMPLIANCE_SCHEMA and catalog/skill copy into a live VLM call', async () => {
    const client = analyzeClient({})
    const generateText = vi.fn(
      async (_opts: { messages: Array<{ content: Array<{ type: string; text?: string }> }> }) => ({
        text: JSON.stringify({
          hits: [HIPAA_COMPLIANCE_FIXTURE_HIT],
        }),
      }),
    )
    await analyzeAsset(
      {
        supabase: client as never,
        blobEnv: {
          connectionString: 'x',
          containerName: 'c',
          useLocalPrefix: true,
          accountName: 'a',
          accountKey: 'k',
        },
        productId: 'demo',
        modelProfileId: 'balanced',
        assetId,
        kind: 'compliance',
        prompt: 'scan this take',
        confirmSpend: true,
      },
      {
        getBlobBytes: async () => Buffer.from('jpeg-thumb'),
        generateText: generateText as never,
      },
    )
    expect(generateText).toHaveBeenCalled()
    const text =
      generateText.mock.calls[0]?.[0].messages[0]?.content.find((part) => part.type === 'text')
        ?.text ?? ''
    expect(text).toMatch(/HIPAA compliant/)
    expect(text).toContain(JSON.stringify(COMPLIANCE_SCHEMA))
  })
})
