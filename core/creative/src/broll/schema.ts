import { z } from 'zod'
import { sceneRoleSchema } from '../intent/schema'

export const brollPlanStatusSchema = z.enum(['draft', 'applied', 'rejected', 'stale'])

export const brollMomentRowSchema = z
  .object({
    kind: z.literal('moment'),
    id: z.string().min(1),
    sceneId: z.string().min(1),
    sceneRole: sceneRoleSchema.optional(),
    assetId: z.string().uuid(),
    shotId: z.string().uuid(),
    startMs: z.number().nonnegative(),
    endMs: z.number().nonnegative().nullable(),
    score: z.number(),
    caption: z.string().nullable().optional(),
    estimatedGbp: z.number().nonnegative().default(0),
  })
  .strict()

export const brollGenerateRowSchema = z
  .object({
    kind: z.literal('generate'),
    id: z.string().min(1),
    sceneId: z.string().min(1),
    sceneRole: sceneRoleSchema.optional(),
    media: z.enum(['video', 'image']).default('video'),
    prompt: z.string().min(1).max(800),
    durationSeconds: z.number().positive().max(4).optional(),
    sourceImageAssetId: z.string().uuid().optional(),
    estimatedGbp: z.number().nonnegative().default(0),
    /** Present when the active profile cannot generate (e.g. founder-edit). */
    blockedReason: z.string().max(400).optional(),
  })
  .strict()

export const brollStillRowSchema = z
  .object({
    kind: z.literal('still'),
    id: z.string().min(1),
    sceneId: z.string().min(1),
    sceneRole: sceneRoleSchema.optional(),
    prompt: z.string().min(1).max(800),
    sourceImageAssetId: z.string().uuid().optional(),
    estimatedGbp: z.number().nonnegative().default(0),
    blockedReason: z.string().max(400).optional(),
  })
  .strict()

export const brollMusicRowSchema = z
  .object({
    kind: z.literal('music'),
    id: z.string().min(1),
    prompt: z.string().min(1).max(800),
    durationSeconds: z.number().positive(),
    estimatedGbp: z.number().nonnegative().default(0),
  })
  .strict()

export const brollPlanRowSchema = z.discriminatedUnion('kind', [
  brollMomentRowSchema,
  brollGenerateRowSchema,
  brollStillRowSchema,
  brollMusicRowSchema,
])

export const brollPlanSchema = z
  .object({
    id: z.string().uuid(),
    createdAt: z.string().datetime(),
    projectRevision: z.number().int().positive(),
    sceneIds: z.array(z.string().min(1)).default([]),
    rows: z.array(brollPlanRowSchema).default([]),
    estimatedGbp: z.number().nonnegative().default(0),
    status: brollPlanStatusSchema.default('draft'),
    rationale: z.string().max(2000).default(''),
  })
  .strict()

export type BrollPlan = z.infer<typeof brollPlanSchema>
export type BrollPlanRow = z.infer<typeof brollPlanRowSchema>
export type BrollMomentRow = z.infer<typeof brollMomentRowSchema>
export type BrollGenerateRow = z.infer<typeof brollGenerateRowSchema>
export type BrollStillRow = z.infer<typeof brollStillRowSchema>
export type BrollMusicRow = z.infer<typeof brollMusicRowSchema>
