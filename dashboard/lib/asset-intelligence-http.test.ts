import { describe, expect, it } from 'vitest'
import { z } from 'zod'

/** Route-local parse seams for #170 (no Next Request in unit tests). */

const searchQuerySchema = z.object({
  productId: z.string().trim().min(1),
  q: z.string().trim().min(1).max(400),
  limit: z.coerce.number().int().min(1).max(50).optional(),
})

const tagQuerySchema = z.object({
  productId: z.string().trim().min(1),
  tag: z.string().trim().min(1).max(64),
  prefix: z
    .enum(['1', 'true', '0', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === '1' || value === 'true')),
})

const reindexBodySchema = z
  .object({
    productId: z.string().trim().min(1),
    projectId: z.string().uuid().nullable().optional(),
    modelProfileId: z.string().trim().min(1).optional(),
  })
  .strict()

describe('asset intelligence HTTP query schemas (#170)', () => {
  it('requires productId + q for search', () => {
    expect(() => searchQuerySchema.parse({ productId: 'demo' })).toThrow()
    expect(searchQuerySchema.parse({ productId: 'demo', q: 'funny', limit: '8' })).toEqual({
      productId: 'demo',
      q: 'funny',
      limit: 8,
    })
  })

  it('parses tag prefix flags', () => {
    expect(tagQuerySchema.parse({ productId: 'demo', tag: 'product', prefix: 'true' }).prefix).toBe(
      true,
    )
    expect(tagQuerySchema.parse({ productId: 'demo', tag: 'product' }).prefix).toBeUndefined()
  })

  it('accepts reindex body with optional projectId null', () => {
    expect(
      reindexBodySchema.parse({
        productId: 'demo',
        projectId: null,
      }),
    ).toEqual({ productId: 'demo', projectId: null })
  })
})
