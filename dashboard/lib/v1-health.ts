import { z } from 'zod'

/** Same shape GET /api/v1/health returns after withApiKey. */
export const healthResponseSchema = z
  .object({
    ok: z.literal(true),
    productId: z.string().min(1),
  })
  .strict()
