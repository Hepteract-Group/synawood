/** Wave 2J / #586 — HTTP parse + error map for analyze (same core as analyze_asset). */

import { z } from 'zod'
import { MISSING_THUMBS_ANALYZE_ERROR } from './analyze-asset'
import { analyzeKindSchema } from './analyze-schema'

const jsonSchemaObject = z
  .object({
    type: z.string().optional(),
    properties: z.record(z.string(), z.unknown()).optional(),
    required: z.array(z.string()).optional(),
  })
  .passthrough()

export const analyzePostBodySchema = z
  .object({
    productId: z.string().trim().min(1),
    projectId: z.string().uuid().nullable().optional(),
    modelProfileId: z.string().trim().min(1).optional(),
    prompt: z.string().trim().min(1).max(2000),
    schema: jsonSchemaObject.optional(),
    kind: analyzeKindSchema.optional(),
    schemaId: z.string().trim().min(1).max(64).optional(),
    shotId: z.string().uuid().optional(),
    startMs: z.number().int().nonnegative().optional(),
    endMs: z.number().int().nonnegative().optional(),
    confirmSpend: z.boolean().optional(),
  })
  .strict()

export const analyzeGetQuerySchema = z
  .object({
    productId: z.string().trim().min(1),
    kind: analyzeKindSchema.optional(),
  })
  .strict()

export const parseAnalyzePostBody = (input: unknown) => analyzePostBodySchema.parse(input)

export const parseAnalyzeGetQuery = (input: unknown) => analyzeGetQuerySchema.parse(input)

export type AnalyzeHttpError = { status: number; message: string }

export const mapAnalyzeHttpError = (error: unknown): AnalyzeHttpError | null => {
  if (error instanceof z.ZodError) {
    return { status: 400, message: error.issues.map((issue) => issue.message).join('; ') }
  }
  if (!(error instanceof Error)) return null
  const message = error.message
  if (/confirmSpend|Estimated £|soft cap|monthly cap/i.test(message)) {
    return { status: 402, message }
  }
  if (message === MISSING_THUMBS_ANALYZE_ERROR || message.startsWith('Keyframe thumbs missing')) {
    return { status: 400, message }
  }
  if (/^No asset .+ in this product$/.test(message)) {
    return { status: 404, message }
  }
  return null
}
