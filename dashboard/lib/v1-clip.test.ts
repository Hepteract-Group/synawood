import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ProductAccessError } from './product-membership'
import { requireIdempotencyKey, V1_CLIP_TOOL_NAMES } from './v1-clip'

describe('v1 clip tools (#1074)', () => {
  it('requires Idempotency-Key on mutating clip routes', () => {
    expect(() => requireIdempotencyKey(new Request('http://x'))).toThrow(ProductAccessError)
    try {
      requireIdempotencyKey(new Request('http://x'))
    } catch (error) {
      expect(error).toMatchObject({ name: 'ProductAccessError', status: 400 })
    }
    expect(
      requireIdempotencyKey(new Request('http://x', { headers: { 'Idempotency-Key': 'clip-1' } })),
    ).toBe('clip-1')
  })

  it('maps 1:1 to add_clip, trim_clip, and remove_clip', () => {
    expect(V1_CLIP_TOOL_NAMES).toEqual(['add_clip', 'trim_clip', 'remove_clip'])
    for (const name of V1_CLIP_TOOL_NAMES) {
      const route = readFileSync(join(process.cwd(), `app/api/v1/${name}/route.ts`), 'utf8')
      expect(route).toContain('createV1ClipPostHandler')
      expect(route).toContain(`'${name}'`)
      expect(route).not.toMatch(/mcp:/)
      expect(route).not.toContain('requireStudioAccess')
    }
  })
})
