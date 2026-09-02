/** Learning Agent DTOs (ADR-0036). Client-safe. */

import { z } from 'zod'

export const insightKindSchema = z.enum([
  'empty_structure',
  'missing_cta',
  'hook_length',
  'beat_count',
  'offer_signups',
])
export type InsightKind = z.infer<typeof insightKindSchema>

export const insightStatusSchema = z.enum(['open', 'applied', 'dismissed', 'snoozed'])
export type InsightStatus = z.infer<typeof insightStatusSchema>

export const priorsSchema = z
  .object({
    structure: z
      .object({
        requireBeats: z.boolean().optional(),
        requireCta: z.boolean().optional(),
        requireOffer: z.boolean().optional(),
        preferredBeatCount: z.number().int().positive().max(12).optional(),
      })
      .strict()
      .optional(),
    hooks: z
      .object({
        maxSeconds: z.number().positive().max(15).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

export type SkillPriors = z.infer<typeof priorsSchema>

export const emptyPriors = (): SkillPriors => ({
  structure: {
    requireBeats: false,
    requireCta: false,
    requireOffer: false,
    preferredBeatCount: 4,
  },
  hooks: { maxSeconds: 3 },
})

export const parsePriors = (value: unknown): SkillPriors => {
  const parsed = priorsSchema.safeParse(value)
  return parsed.success ? parsed.data : emptyPriors()
}

export const insightDraftSchema = z
  .object({
    kind: insightKindSchema,
    title: z.string().min(1).max(160),
    body: z.string().min(1).max(2000),
    evidence: z.record(z.string(), z.unknown()).default({}),
    proposedPrior: priorsSchema,
  })
  .strict()

export type InsightDraft = z.infer<typeof insightDraftSchema>

export const insightActionSchema = z
  .object({
    action: z.enum(['apply', 'dismiss', 'snooze']),
    snoozeDays: z.number().int().positive().max(90).optional(),
  })
  .strict()
