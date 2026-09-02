import { z } from 'zod'

/**
 * Generation Plan — ADR-0086. Structured preview before paid Gateway generate.
 * Spoken lines use `dialogue`, never `script`.
 */

export const generationPlanStatusSchema = z.enum(['draft', 'ready', 'applied', 'stale'])

export const generationPlanSceneSchema = z
  .object({
    id: z.string().min(1),
    role: z.string().min(1).max(64).optional(),
    description: z.string().min(1).max(800),
    durationSeconds: z.number().positive().max(600).optional(),
    dialogue: z.string().max(800).optional(),
    onScreenText: z.string().max(200).optional(),
  })
  .strict()

export const generationPlanSchema = z
  .object({
    id: z.string().uuid(),
    status: generationPlanStatusSchema.default('draft'),
    goal: z.string().min(1).max(240).optional(),
    angle: z.string().min(1).max(240).optional(),
    tone: z.string().min(1).max(120).optional(),
    audience: z.string().min(1).max(240).optional(),
    runtimeSeconds: z.number().positive().max(600).optional(),
    platform: z.string().min(1).max(80).optional(),
    scenes: z.array(generationPlanSceneSchema).default([]),
    assetIds: z.array(z.string().uuid()).optional(),
    extraExtractUrls: z.array(z.string().url()).optional(),
    reExtractThisTurn: z.boolean().default(false),
    reasonerModelId: z.string().min(1).optional(),
    imageModelId: z.string().min(1).optional(),
    videoModelId: z.string().min(1).optional(),
    costEstimateGbp: z.number().nonnegative(),
    projectRevision: z.number().int().positive(),
  })
  .strict()

export type GenerationPlanStatus = z.infer<typeof generationPlanStatusSchema>
export type GenerationPlanScene = z.infer<typeof generationPlanSceneSchema>
export type GenerationPlan = z.infer<typeof generationPlanSchema>

export const parseGenerationPlan = (input: unknown): GenerationPlan =>
  generationPlanSchema.parse(input)
