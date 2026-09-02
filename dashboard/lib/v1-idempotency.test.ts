import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ProductAccessError } from './product-membership'
import {
  hashV1Request,
  persistApiIdempotency,
  requireIdempotencyKey,
  resolveStoredIdempotency,
  v1IdempotencyReplayResponse,
} from './v1-idempotency'

const readRoute = (relative: string): string => readFileSync(join(process.cwd(), relative), 'utf8')

describe('v1 idempotency persist (#1077)', () => {
  it('requires Idempotency-Key on mutate and hashes the request', async () => {
    expect(() => requireIdempotencyKey(new Request('http://x'))).toThrow(ProductAccessError)
    expect(
      requireIdempotencyKey(new Request('http://x', { headers: { 'Idempotency-Key': 'clip-1' } })),
    ).toBe('clip-1')
    const hash = await hashV1Request('POST', '/api/v1/add_clip', '{"projectId":"a"}')
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
    expect(hash).not.toBe(await hashV1Request('PATCH', '/api/v1/add_clip', '{"projectId":"a"}'))
  })

  it('inserts api_idempotency and ignores unique conflicts', async () => {
    const inserted: unknown[] = []
    const supabase = {
      from: (table: string) => {
        expect(table).toBe('api_idempotency')
        return {
          insert: async (row: unknown) => {
            inserted.push(row)
            return { error: null }
          },
        }
      },
    }
    await persistApiIdempotency({
      supabase: supabase as never,
      access: { productId: 'demo', apiKeyId: 'key-1', supabase: supabase as never },
      idempotencyKey: 'clip-1',
      requestHash: 'abc',
      statusCode: 200,
      responseBody: { tool: 'add_clip' },
    })
    expect(inserted).toEqual([
      {
        product_id: 'demo',
        api_key_id: 'key-1',
        idempotency_key: 'clip-1',
        request_hash: 'abc',
        status_code: 200,
        response: { tool: 'add_clip' },
      },
    ])

    const conflict = {
      from: () => ({
        insert: async () => ({ error: { code: '23505', message: 'duplicate' } }),
      }),
    }
    await persistApiIdempotency({
      supabase: conflict as never,
      access: { productId: 'demo', apiKeyId: 'key-1', supabase: conflict as never },
      idempotencyKey: 'clip-1',
      requestHash: 'abc',
      statusCode: 200,
      responseBody: {},
    })
  })

  it('GET /api/v1/health and GET project do not require Idempotency-Key; PATCH and clip POST do', () => {
    const health = readRoute('app/api/v1/health/route.ts')
    const project = readRoute('app/api/v1/projects/[projectId]/route.ts')
    const addClip = readRoute('app/api/v1/add_clip/route.ts')
    expect(health).not.toContain('requireIdempotencyKey')
    expect(health).not.toContain('recordV1MutationIdempotency')
    const getBlock = project.slice(
      project.indexOf('export const GET'),
      project.indexOf('export const PATCH'),
    )
    const patchBlock = project.slice(project.indexOf('export const PATCH'))
    expect(getBlock).not.toContain('requireIdempotencyKey')
    expect(patchBlock).toContain('requireIdempotencyKey')
    expect(addClip).toContain('createV1ClipPostHandler')
  })
})

describe('v1 idempotency replay (#1078)', () => {
  it('replays the stored JSON when the hash matches', async () => {
    const first = { summary: 'Added clip', tool: 'add_clip' }
    const json = JSON.stringify(first)
    const resolved = resolveStoredIdempotency(
      { request_hash: 'abc', status_code: 200, response: JSON.parse(json) },
      'abc',
    )
    expect(resolved.kind).toBe('replay')
    if (resolved.kind !== 'replay') return
    const replay = v1IdempotencyReplayResponse(resolved.statusCode, resolved.responseBody)
    expect(replay.status).toBe(200)
    expect(await replay.text()).toBe(json)
  })

  it('conflicts when the same key has a different hash', () => {
    expect(
      resolveStoredIdempotency(
        { request_hash: 'abc', status_code: 200, response: { tool: 'add_clip' } },
        'def',
      ),
    ).toEqual({ kind: 'conflict' })
    expect(resolveStoredIdempotency(null, 'abc')).toEqual({ kind: 'miss' })
  })

  it('looks up stored rows before mutating clip POST and project PATCH', () => {
    const clip = readRoute('lib/v1-clip.ts')
    const project = readRoute('app/api/v1/projects/[projectId]/route.ts')
    expect(clip).toContain('replayIfStored')
    expect(project).toContain('replayIfStored')
    const getBlock = project.slice(
      project.indexOf('export const GET'),
      project.indexOf('export const PATCH'),
    )
    expect(getBlock).not.toContain('replayIfStored')
  })
})
